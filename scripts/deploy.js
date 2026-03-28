// scripts/deploy.js
// Deploy ETFVault to Arc Devnet using plain ethers.js (no Hardhat runner required).
// Usage: node scripts/deploy.js
// Requires: PRIVATE_KEY in .env (without the 0x prefix, or with — both handled below).

import { ethers } from "ethers";
import fs from "fs";
import "dotenv/config";

// ─── ANSI colour helpers ─────────────────────────────────────────────────────
const c = {
  reset:  "\x1b[0m",
  bold:   "\x1b[1m",
  green:  "\x1b[32m",
  cyan:   "\x1b[36m",
  yellow: "\x1b[33m",
  red:    "\x1b[31m",
  dim:    "\x1b[2m",
};
const log  = (msg) => console.log(`${c.cyan}›${c.reset} ${msg}`);
const ok   = (msg) => console.log(`${c.green}✔${c.reset} ${msg}`);
const warn = (msg) => console.log(`${c.yellow}⚠${c.reset}  ${msg}`);
const err  = (msg) => console.error(`${c.red}✖${c.reset} ${msg}`);
const bold = (s)   => `${c.bold}${s}${c.reset}`;

// ─── Config ──────────────────────────────────────────────────────────────────
const ARC_RPC  = "https://rpc.testnet.arc.network";
const ARTIFACT = "./artifacts/contracts/ETFVault.sol/ETFVault.json";
const MOCK_TETH_PRICE_E18  = ethers.parseUnits("3000", 18);
const MOCK_TUSDT_PRICE_E18 = ethers.parseUnits("1", 18);

async function main() {
  console.log(`\n${c.bold}${c.cyan}  Arc ETF — Deploy Script${c.reset}\n`);

  // 1. Private key
  const rawKey = process.env.PRIVATE_KEY;
  if (!rawKey) {
    err("PRIVATE_KEY is not set in .env");
    process.exit(1);
  }
  const privateKey = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`;

  // 2. Connect to Arc Devnet
  log(`Connecting to Arc Devnet → ${c.dim}${ARC_RPC}${c.reset}`);
  const provider = new ethers.JsonRpcProvider(ARC_RPC);

  let chainId;
  try {
    const network = await provider.getNetwork();
    chainId = network.chainId;
    ok(`Connected  chain ID: ${bold(chainId.toString())}`);
  } catch {
    err(`Cannot reach ${ARC_RPC} — check your internet connection.`);
    process.exit(1);
  }

  // 3. Signer
  const wallet = new ethers.Wallet(privateKey, provider);
  ok(`Deployer address: ${bold(wallet.address)}`);

  const balance = await provider.getBalance(wallet.address);
  log(`Deployer balance: ${bold(ethers.formatEther(balance))} (native)`);

  // 4. Load compiled artifact
  if (!fs.existsSync(ARTIFACT)) {
    err(`Artifact not found: ${ARTIFACT}`);
    warn("Run  npx hardhat compile  first, then retry.");
    process.exit(1);
  }
  const artifact = JSON.parse(fs.readFileSync(ARTIFACT, "utf8"));
  log("Artifact loaded.");

  // 5. Deploy
  log("Deploying ETFVault…");
  const factory  = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);

  // Pass deployer address as initialOwner (receives protocol fees)
  const vault = await factory.deploy(wallet.address);
  log(`Tx sent: ${c.dim}${vault.deploymentTransaction()?.hash}${c.reset}`);

  log("Waiting for confirmation…");
  await vault.waitForDeployment();

  const address = await vault.getAddress();

  // 6. Optional post-deploy test token setup
  const tETH = process.env.MOCK_TETH_ADDRESS;
  const tUSDT = process.env.MOCK_TUSDT_ADDRESS;

  if (tETH || tUSDT) {
    log("Configuring optional mock tokens...");
  }

  if (tETH) {
    const tx1 = await vault.addAcceptedToken(tETH);
    await tx1.wait();
    const tx2 = await vault.setMockTokenPrice(tETH, MOCK_TETH_PRICE_E18);
    await tx2.wait();
    ok(`Configured tETH mock path (${tETH}) at 3000 USD`);
  }

  if (tUSDT) {
    const tx1 = await vault.addAcceptedToken(tUSDT);
    await tx1.wait();
    const tx2 = await vault.setMockTokenPrice(tUSDT, MOCK_TUSDT_PRICE_E18);
    await tx2.wait();
    ok(`Configured tUSDT mock path (${tUSDT}) at 1 USD`);
  }

  console.log(`
${c.green}${c.bold}  ✔ Deployment successful!${c.reset}

  Contract : ${bold(address)}
  Network  : Arc Devnet (chainId ${chainId})
  Deployer : ${wallet.address}

  Next steps:
  ${c.dim}1. Update CONTRACT_ADDRESS in app/vault-abi.ts
  2. Ensure mock tokens are whitelisted + priced:
     - MOCK_TETH_ADDRESS / MOCK_TUSDT_ADDRESS env vars (optional auto-setup)
  3. Re-run  npm run dev  to pick up the new address${c.reset}
`);
}

main().catch((e) => {
  err(e.message ?? e);
  process.exit(1);
});
