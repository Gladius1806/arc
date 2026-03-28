"use client";

import React, { useMemo, useState } from "react";
import { WagmiProvider, http } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { mainnet, sepolia } from "wagmi/chains";
import { defineChain } from "viem";

import "@rainbow-me/rainbowkit/styles.css";

// Arc Testnet — official RPC + chain ID published by Circle.
export const arcMainnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  // Arc Testnet's native gas token is USDC (Circle's own L2).
  // 18 decimals — Arc normalises to wei-scale internally.
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.network"] },
    public:  { http: ["https://rpc.testnet.arc.network"] },
  },
  blockExplorers: {
    default: { name: "Arc Explorer", url: "https://explorer.testnet.arc.network" },
  },
  testnet: true,
});

// WalletConnect Project ID — set NEXT_PUBLIC_WC_PROJECT_ID in .env.local
const wcProjectId =
  process.env.NEXT_PUBLIC_WC_PROJECT_ID || "MISSING_WC_PROJECT_ID";

// Explicit per-chain transports ensure usePublicClient always uses the correct
// RPC endpoint even before the user connects their wallet.
const config = getDefaultConfig({
  appName: "ArcIndex",
  projectId: wcProjectId,
  chains: [arcMainnet, mainnet, sepolia],
  transports: {
    [arcMainnet.id]: http("https://rpc.testnet.arc.network"),
    [mainnet.id]:   http(),
    [sepolia.id]:   http(),
  },
  ssr: true,
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  const rkTheme = useMemo(
    () =>
      darkTheme({
        accentColor: "#6366f1",
        accentColorForeground: "#ffffff",
        borderRadius: "large",
        overlayBlur: "small",
      }),
    []
  );

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={rkTheme} modalSize="compact">
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
