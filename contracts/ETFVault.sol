// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title  ETFVault — ArcIndex Vault
/// @notice Users deposit native tokens OR whitelisted stablecoins (USDC / USDT)
///         and receive AETF LP receipt tokens proportional to their deposit value.
///         A 0.5% protocol fee is collected on every deposit and forwarded to the owner.
/// @dev    Deployed on Arc Testnet (Chain ID 5042002).
///         After deploying, update CONTRACT_ADDRESS in app/vault-abi.ts.
contract ETFVault is ERC20, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Constants ──────────────────────────────────────────────────────────
    uint256 public constant FEE_BPS        = 50;      // 0.5% in basis points
    uint256 public constant BPS_DENOM      = 10_000;
    uint8   public constant STABLE_DECIMALS = 6;      // USDC / USDT decimals
    uint256 public constant PRICE_PRECISION = 1e18;   // USD precision for mock prices

    // ─── Storage ─────────────────────────────────────────────────────────────
    /// @notice Returns true if the token is whitelisted for ERC-20 deposit.
    mapping(address => bool) public acceptedTokens;

    /// @dev Iterable list of accepted tokens for UI enumeration.
    address[] private _tokenList;

    /// @notice Optional mock USD prices (1e18 precision) for test tokens.
    ///         Example: tETH = 3000e18, tUSDT = 1e18.
    ///         If value > 0, depositERC20 treats token as "mock routed" and mints
    ///         shares from mock USD value instead of assuming stablecoin parity.
    mapping(address => uint256) public mockTokenUsdPriceE18;

    // ─── Events ──────────────────────────────────────────────────────────────
    event Deposited(
        address indexed user,
        uint256 amountIn,
        uint256 fee,
        uint256 sharesMinted
    );

    event DepositedERC20(
        address indexed user,
        address indexed token,
        uint256 amountIn,
        uint256 feeInToken,
        uint256 sharesMinted
    );

    event Withdrawn(
        address indexed user,
        uint256 sharesIn,
        uint256 amountOut
    );

    event TokenAdded(address indexed token);
    event TokenRemoved(address indexed token);
    event MockTokenPriceUpdated(address indexed token, uint256 usdPriceE18);

    // ─── Constructor ─────────────────────────────────────────────────────────
    /// @param initialOwner Address that receives protocol fees and owns the vault.
    constructor(address initialOwner)
        ERC20("ArcIndex Vault", "AETF")
        Ownable(initialOwner)
    {}

    // ─── Owner — token whitelist ──────────────────────────────────────────────

    /// @notice Whitelist a stablecoin token for ERC-20 deposits.
    function addAcceptedToken(address token) external onlyOwner {
        require(token != address(0), "ETFVault: zero address");
        require(!acceptedTokens[token], "ETFVault: already accepted");
        acceptedTokens[token] = true;
        _tokenList.push(token);
        emit TokenAdded(token);
    }

    /// @notice Remove a token from the whitelist.
    function removeAcceptedToken(address token) external onlyOwner {
        require(acceptedTokens[token], "ETFVault: not accepted");
        acceptedTokens[token] = false;
        uint256 len = _tokenList.length;
        for (uint256 i = 0; i < len; i++) {
            if (_tokenList[i] == token) {
                _tokenList[i] = _tokenList[len - 1];
                _tokenList.pop();
                break;
            }
        }
        emit TokenRemoved(token);
    }

    /// @notice Set mock oracle USD price for a token (1e18 precision).
    /// @dev    Setting price to 0 disables mock pricing for that token.
    function setMockTokenPrice(address token, uint256 usdPriceE18) external onlyOwner {
        require(token != address(0), "ETFVault: zero address");
        mockTokenUsdPriceE18[token] = usdPriceE18;
        emit MockTokenPriceUpdated(token, usdPriceE18);
    }

    // ─── Write — native deposit ───────────────────────────────────────────────

    /// @notice Deposit native tokens (ETH on Arc) and receive AETF shares.
    ///         0.5% fee forwarded to owner. Shares minted 1:1 with net amount.
    function deposit() external payable nonReentrant {
        require(msg.value > 0, "ETFVault: zero deposit");

        uint256 fee       = (msg.value * FEE_BPS) / BPS_DENOM;
        uint256 netAmount = msg.value - fee;

        (bool feeSent, ) = owner().call{value: fee}("");
        require(feeSent, "ETFVault: fee transfer failed");

        _mint(msg.sender, netAmount);
        emit Deposited(msg.sender, msg.value, fee, netAmount);
    }

    // ─── Write — ERC-20 stablecoin deposit ───────────────────────────────────

    /// @notice Deposit a whitelisted ERC-20 and receive AETF.
    ///         - Stable path: if no mock price is configured, token is treated as $1
    ///           and normalized by token decimals.
    ///         - Mock path: if mockTokenUsdPriceE18[token] > 0, shares are minted from
    ///           simulated USD value (no DEX swap / no liquidity dependency).
    ///         Caller must approve this contract for at least `amount` before calling.
    ///
    /// @param token  ERC-20 token address (must be in whitelist)
    /// @param amount Amount in token decimals (e.g. 1_000_000 = 1 USDC)
    function depositERC20(address token, uint256 amount) external nonReentrant {
        require(acceptedTokens[token], "ETFVault: token not whitelisted");
        require(amount > 0, "ETFVault: zero amount");

        // Fee stays in the stablecoin denomination
        uint256 feeInToken = (amount * FEE_BPS) / BPS_DENOM;
        uint256 netInToken = amount - feeInToken;

        // Pull full amount from caller, forward fee to owner
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        IERC20(token).safeTransfer(owner(), feeInToken);

        uint8 tokenDecimals = IERC20Metadata(token).decimals();
        uint256 mockPrice = mockTokenUsdPriceE18[token];
        uint256 sharesMinted;

        if (mockPrice > 0) {
            // Mock routing path:
            // 1 token unit (10^decimals) is worth mockPrice USD (1e18 precision).
            // Shares are denominated as 1e18 per 1 USD.
            sharesMinted = (netInToken * mockPrice) / (10 ** tokenDecimals);
        } else {
            // Stable/token parity path: assume 1 token == 1 USD.
            // Normalize token decimals into 18-decimal share units.
            if (tokenDecimals < 18) {
                sharesMinted = netInToken * (10 ** (18 - tokenDecimals));
            } else if (tokenDecimals > 18) {
                sharesMinted = netInToken / (10 ** (tokenDecimals - 18));
            } else {
                sharesMinted = netInToken;
            }
        }
        require(sharesMinted > 0, "ETFVault: zero shares");
        _mint(msg.sender, sharesMinted);

        emit DepositedERC20(msg.sender, token, amount, feeInToken, sharesMinted);
    }

    // ─── Write — withdraw ────────────────────────────────────────────────────

    /// @notice Burn AETF shares and receive proportional native token from vault.
    /// @param  shares Amount of AETF LP tokens to redeem.
    function withdraw(uint256 shares) external nonReentrant {
        require(shares > 0, "ETFVault: zero shares");
        require(balanceOf(msg.sender) >= shares, "ETFVault: insufficient balance");

        uint256 vaultBal = address(this).balance;
        uint256 supply   = totalSupply();
        require(supply > 0, "ETFVault: empty vault");

        uint256 payout = (shares * vaultBal) / supply;
        require(payout > 0, "ETFVault: zero payout");

        _burn(msg.sender, shares);

        (bool paid, ) = msg.sender.call{value: payout}("");
        require(paid, "ETFVault: payout failed");

        emit Withdrawn(msg.sender, shares, payout);
    }

    // ─── View ────────────────────────────────────────────────────────────────

    /// @notice Returns the vault's native token balance.
    function vaultBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /// @notice Returns all whitelisted token addresses.
    function getTokenList() external view returns (address[] memory) {
        return _tokenList;
    }

    // ─── Fallback ────────────────────────────────────────────────────────────
    receive() external payable {}
}
