// hardhat.config.cjs — CommonJS, required when package.json has "type":"module".
require("@nomicfoundation/hardhat-ethers");
require("dotenv").config();

const pk = process.env.PRIVATE_KEY
  ? [`0x${process.env.PRIVATE_KEY.replace(/^0x/, "")}`]
  : [];

/** @type {import('hardhat/config').HardhatUserConfig} */
module.exports = {
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
    sepolia: {
      type: "http",
      url: process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org",
      chainId: 11155111,
      accounts: pk,
    },
  },
  paths: {
    sources:   "./contracts",
    tests:     "./test",
    cache:     "./cache",
    artifacts: "./artifacts",
  },
};
