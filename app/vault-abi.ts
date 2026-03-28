// Typed ABI for ETFVault (ArcIndex Vault) — wagmi v2 / viem compatible.
// Update CONTRACT_ADDRESS after each new deployment (run: node scripts/deploy.js).
export const CONTRACT_ADDRESS =
  "0xaF915b1F96C95D32C50b50139535eCcAB513d1F4" as const;

// ─── Arc Testnet stablecoin addresses ────────────────────────────────────────
export const STABLECOIN_ADDRESSES = {
  USDC: "0x0000000000000000000000000000000000000001" as `0x${string}`, // TODO: real Arc USDC
  USDT: "0x0000000000000000000000000000000000000002" as `0x${string}`, // TODO: real Arc USDT
} as const;

// ─── Mock faucet token addresses ─────────────────────────────────────────────
// Fill these in after running: node scripts/deployMocks.js
export const MOCK_TOKEN_ADDRESSES = {
  tETH:  "0x849b25CE8944D40840e612B8815D2E6a0dF9e624" as `0x${string}`, // TODO: replace after deployMocks
  tUSDT: "0xa4F59f533214C6326EaA4D9317D97b71D49f4178" as `0x${string}`, // TODO: replace after deployMocks
} as const;

// ─── MockERC20 faucet ABI (mint + standard ERC-20 reads) ─────────────────────
export const mockErc20Abi = [
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount",  type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner",   type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// ─── Minimal ERC-20 ABI (approve + allowance) ────────────────────────────────
export const erc20Abi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount",  type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner",   type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// ─── ETFVault ABI ─────────────────────────────────────────────────────────────
export const vaultAbi = [
  // ── Write: native deposit ───────────────────────────────────────────────────
  {
    type: "function",
    name: "deposit",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
  // ── Write: ERC-20 stablecoin deposit ────────────────────────────────────────
  {
    type: "function",
    name: "depositERC20",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token",  type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  // ── Write: withdraw ─────────────────────────────────────────────────────────
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [{ name: "shares", type: "uint256" }],
    outputs: [],
  },
  // ── Owner: whitelist ────────────────────────────────────────────────────────
  {
    type: "function",
    name: "addAcceptedToken",
    stateMutability: "nonpayable",
    inputs: [{ name: "token", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "removeAcceptedToken",
    stateMutability: "nonpayable",
    inputs: [{ name: "token", type: "address" }],
    outputs: [],
  },
  // ── View ────────────────────────────────────────────────────────────────────
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "totalSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "vaultBalance",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "acceptedTokens",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "getTokenList",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address[]" }],
  },
  // ── Events ──────────────────────────────────────────────────────────────────
  {
    type: "event",
    name: "Deposited",
    inputs: [
      { indexed: true,  name: "user",         type: "address" },
      { indexed: false, name: "amountIn",      type: "uint256" },
      { indexed: false, name: "fee",           type: "uint256" },
      { indexed: false, name: "sharesMinted",  type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "DepositedERC20",
    inputs: [
      { indexed: true,  name: "user",          type: "address" },
      { indexed: true,  name: "token",         type: "address" },
      { indexed: false, name: "amountIn",      type: "uint256" },
      { indexed: false, name: "feeInToken",    type: "uint256" },
      { indexed: false, name: "sharesMinted",  type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "Withdrawn",
    inputs: [
      { indexed: true,  name: "user",      type: "address" },
      { indexed: false, name: "sharesIn",  type: "uint256" },
      { indexed: false, name: "amountOut", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { indexed: true,  name: "from",  type: "address" },
      { indexed: true,  name: "to",    type: "address" },
      { indexed: false, name: "value", type: "uint256" },
    ],
  },
] as const;
