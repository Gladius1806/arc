import "@nomicfoundation/hardhat-ethers";
import "dotenv/config";

const pk = process.env.PRIVATE_KEY
  ? [`0x${process.env.PRIVATE_KEY.replace(/^0x/, "")}`]
  : [];

/** @type {import("hardhat/config").HardhatUserConfig} */
const config = {
  solidity: {
    version: "0.8.20",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    arcTestnet: {
      type: "http",
      url: "https://rpc.testnet.arc.network",
      chainId: 5042002,
      accounts: pk,
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config;
