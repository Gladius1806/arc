// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockERC20
 * @notice A simple faucet token for ArcIndex testnet demos.
 *         Anyone can call mint() to receive tokens — no auth required.
 *         Deploy two instances: "Test ETH" (tETH) and "Test USDT" (tUSDT).
 */
contract MockERC20 is ERC20 {
    uint8 private immutable _decimals;
    uint256 public constant MAX_MINT = 1_000 * 10 ** 18;

    constructor(string memory name_, string memory symbol_, uint8 decimals_)
        ERC20(name_, symbol_)
    {
        _decimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    /**
     * @notice Mint `amount` tokens to msg.sender.
     *         Capped at MAX_MINT per call to prevent abuse.
     */
    function mint(uint256 amount) external {
        require(amount > 0 && amount <= MAX_MINT, "MockERC20: amount out of range");
        _mint(msg.sender, amount);
    }
}
