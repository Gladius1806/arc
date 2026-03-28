# ArcIndex | Multi-Asset ETF Vault

![Built on Arc](https://img.shields.io/badge/Built%20on-Arc%20Testnet-6366f1?style=flat-square&logo=ethereum)
![Testnet Live](https://img.shields.io/badge/Status-Testnet%20Live-22c55e?style=flat-square)
![Solidity](https://img.shields.io/badge/Solidity-0.8.20-363636?style=flat-square&logo=solidity)
![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=nextdotjs)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)

> **One deposit. One token. Full index exposure.**
> ArcIndex is a permissionless, decentralized ETF vault protocol running on Arc Testnet (Chain ID: 5042002) — the high-performance EVM L2 built by Circle.

---

## 🚀 Overview

ArcIndex lets users deposit a **single base asset** (USDC — Arc's native gas token) and receive **$AETF** — a single receipt token that represents an entire on-chain basket (e.g. 50% WETH · 30% WBTC · 20% SOL).

Here's the magic:

1. 🏦 **You deposit** USDC (or a testnet ERC-20 token like tETH / tUSDT).
2. ⚙️ **The vault smart contract** automatically routes and locks the underlying basket assets according to your chosen allocation weights.
3. 🪙 **You receive $AETF** — a single LP receipt token minted 1:1 with your net deposit (minus 0.5% protocol fee).
4. 📈 **Your AETF appreciates** as the underlying basket grows in value.
5. 💸 **Withdraw any time** — burn your AETF, receive proportional USDC back. No lock-up, no KYC, no wallet clutter.

**No juggling three different tokens. No multiple gas fees. One transaction in, one token out.**

---

## ✨ Key Features

- **⚡ One-Click Zap-In** — Deposit USDC (native) or testnet ERC-20s in a single transaction
- **🎯 Dynamic Basket Allocation** — Drag sliders or type exact percentages for WETH / WBTC / SOL; validation enforces 100% total
- **📊 Live CoinGecko Price Feeds** — Real-time ETH, BTC, SOL prices with 7-day sparkline charts on the Dashboard (auto-refreshes every 60s)
- **💱 AMM Swap Interface** — Uniswap-style token swap UI (visual demo, full AMM routing coming soon)
- **🪙 Built-in Faucet** — One-click "Mint 10 tETH" / "Mint 100 tUSDT" buttons so beta testers can get started immediately
- **🔒 ERC-20 Approve → Deposit Flow** — Full two-step approval flow for stablecoin deposits with state-aware buttons
- **🌐 Auto Network Switch** — Detects wrong chain and auto-prompts wallet to switch to Arc Testnet
- **❓ FAQ Drawer** — Slide-up FAQ accordion with detailed explanations of how the vault works

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | [Next.js 15](https://nextjs.org) (App Router) + TypeScript |
| **Styling** | [Tailwind CSS v3](https://tailwindcss.com) — white/indigo light theme |
| **Web3 Hooks** | [Wagmi v2](https://wagmi.sh) + [Viem](https://viem.sh) |
| **Wallet UI** | [RainbowKit](https://www.rainbowkit.com) |
| **Smart Contracts** | [Solidity 0.8.20](https://soliditylang.org) + [OpenZeppelin](https://openzeppelin.com) |
| **Contract Dev** | [Hardhat](https://hardhat.org) |
| **Price Data** | [CoinGecko API](https://www.coingecko.com/en/api) (free tier) |

---

## 🌐 Network Details

| Property | Value |
|---|---|
| **Network Name** | Arc Testnet |
| **Chain ID** | `5042002` |
| **Native Currency** | USDC (18 decimals) |
| **RPC URL** | `https://rpc.testnet.arc.network` |
| **Block Explorer** | `https://explorer.testnet.arc.network` |
| **Vault Contract** | `0xbdd3E53593E209931000c7A79812526d9E923fF4` |

> Arc is a high-performance EVM-compatible L2 blockchain developed by Circle (creators of USDC), designed for fast, low-cost transactions with native stablecoin support at the protocol level.

---

## 📁 Project Structure

```
arc/
├── app/
│   ├── page.tsx              # Main deposit page (vault entry)
│   ├── dashboard/page.tsx    # Portfolio dashboard (stats, prices, history)
│   ├── swap/page.tsx         # AMM Swap interface (UI demo)
│   ├── components/
│   │   └── FaqDrawer.tsx     # Slide-up FAQ accordion
│   ├── providers.tsx         # Wagmi + RainbowKit config (Arc chain definition)
│   └── vault-abi.ts          # Typed ABI + contract/token addresses
├── contracts/
│   ├── ETFVault.sol          # Core vault: deposit, withdraw, AETF minting
│   └── MockERC20.sol         # Faucet token for testnet testing
├── scripts/
│   ├── deploy.js             # Deploy ETFVault to Arc Testnet
│   └── deployMocks.js        # Deploy tETH + tUSDT mock tokens
└── hardhat.config.cjs        # Hardhat network config
```

---

## 💻 Getting Started

### Prerequisites

- Node.js ≥ 18
- A Web3 wallet (MetaMask, Coinbase Wallet, etc.)
- Arc Testnet added to your wallet (Chain ID: 5042002)

### 1. Clone & Install

```bash
git clone https://github.com/your-username/arcindex.git
cd arcindex
npm install
```

### 2. Environment Setup

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Required for WalletConnect modal
NEXT_PUBLIC_WC_PROJECT_ID=your_walletconnect_project_id

# Required for contract deployment only
PRIVATE_KEY=your_deployer_private_key
```

> ⚠️ **Never commit your `.env` file.** It is already excluded by `.gitignore`.

### 3. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Deploy Mock Tokens (Optional — for testnet faucet)

```bash
# First compile contracts
npx hardhat compile

# Then deploy mock ERC-20 faucet tokens to Arc Testnet
node scripts/deployMocks.js
```

Copy the printed addresses into `app/vault-abi.ts` → `MOCK_TOKEN_ADDRESSES`.

### 5. Deploy the Vault Contract (Optional)

```bash
node scripts/deploy.js
```

Update `CONTRACT_ADDRESS` in `app/vault-abi.ts` with the printed address.

---

## 🔄 How the Vault Works

```
User deposits USDC (native)
         │
         ▼
   ETFVault.sol
   ├── Deducts 0.5% protocol fee → owner address
   ├── Calculates shares = netDeposit (1:1 with net amount)
   ├── Mints AETF receipt tokens to depositor
   └── Locks funds in vault (tracks vaultBalance)
         │
         ▼
   User holds AETF
   (represents % share of entire vault)
         │
         ▼
   Withdraw any time:
   burn AETF → receive proportional USDC
```

---

## 🗺 Roadmap

- [x] Core deposit/withdraw vault
- [x] ERC-20 stablecoin deposits (tETH, tUSDT)
- [x] Dynamic basket allocation UI
- [x] Live CoinGecko price feeds
- [x] Transaction history (on-chain events)
- [x] AMM Swap interface (UI)
- [x] Built-in faucet for testnet tokens
- [ ] Real AMM router integration (on-chain swaps)
- [ ] Chainlink price oracle feeds
- [ ] Vault rebalancing mechanism
- [ ] Mainnet deployment

---

## 🛡 Security

- ArcIndex is currently in **testnet phase** and has **not undergone a formal security audit**.
- Smart contracts use OpenZeppelin's battle-tested `ERC20`, `Ownable`, and `ReentrancyGuard`.
- **Do not deposit more than you are willing to lose** during early access.

---

## 🤝 Contributing

PRs and issues are welcome! Please open an issue first to discuss major changes.

---

## 📄 License

MIT © ArcIndex Protocol

---

<p align="center">
  <strong>Built with ❤️ on Arc · Powered by Circle</strong><br/>
  <a href="https://arc.circle.com">arc.circle.com</a>
</p>
