/**
 * deployMocks.js — Deploy two MockERC20 faucet tokens on Arc Testnet.
 *
 * Usage:
 *   node scripts/deployMocks.js
 *
 * Requires:
 *   .env  →  PRIVATE_KEY=0x...
 *
 * After running, copy the printed addresses into app/vault-abi.ts:
 *   MOCK_TOKEN_ADDRESSES.tETH  = "<tETH address>"
 *   MOCK_TOKEN_ADDRESSES.tUSDT = "<tUSDT address>"
 */

import "dotenv/config";
import { ethers } from "ethers";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const ARC_RPC    = "https://rpc.testnet.arc.network";
const CHAIN_ID   = 5042002;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!PRIVATE_KEY) {
  console.error("❌  PRIVATE_KEY not set in .env");
  process.exit(1);
}

// ── Minimal MockERC20 ABI + bytecode (compiled with solc 0.8.20 + OZ 5) ──────
// Re-compile contracts/MockERC20.sol with Hardhat and paste the artifact here,
// OR run this script via Hardhat:  npx hardhat run scripts/deployMocks.js --network arcTestnet
//
// For a quick node-only deploy, use the artifact produced by:
//   npx hardhat compile
// and load it below:

let artifact;
try {
  artifact = JSON.parse(
    readFileSync(
      join(__dirname, "../artifacts/contracts/MockERC20.sol/MockERC20.json"),
      "utf8"
    )
  );
} catch {
  console.error(
    "❌  Artifact not found. Run `npx hardhat compile` first, then re-run this script."
  );
  process.exit(1);
}

const { abi, bytecode } = artifact;

async function deployToken(wallet, name, symbol, decimals) {
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  console.log(`\n🚀  Deploying ${name} (${symbol})…`);
  const contract = await factory.deploy(name, symbol, decimals);
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log(`✅  ${symbol} deployed at: \x1b[32m${address}\x1b[0m`);
  return address;
}

async function main() {
  const provider = new ethers.JsonRpcProvider(ARC_RPC, CHAIN_ID);
  const wallet   = new ethers.Wallet(PRIVATE_KEY, provider);

  console.log(`\n🔗  Arc Testnet  ·  Chain ID ${CHAIN_ID}`);
  console.log(`👛  Deployer: ${wallet.address}`);

  const balance = await provider.getBalance(wallet.address);
  console.log(`💰  Balance: ${ethers.formatEther(balance)} USDC (native)\n`);

  const tEthAddr  = await deployToken(wallet, "Test ETH",  "tETH",  18);
  const tUsdtAddr = await deployToken(wallet, "Test USDT", "tUSDT", 18);

  console.log("\n\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m");
  console.log("\x1b[1mNext step — update app/vault-abi.ts:\x1b[0m");
  console.log(`  tETH:  "${tEthAddr}"`);
  console.log(`  tUSDT: "${tUsdtAddr}"`);
  console.log("\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\n");
}

main().catch((err) => {
  console.error("❌  Deployment failed:", err.message);
  process.exit(1);
});
