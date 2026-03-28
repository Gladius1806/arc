"use client";

import React, { useState } from "react";

const FAQ_ITEMS = [
  {
    q: "How does the ArcIndex Vault actually work? Will I get 3 different tokens?",
    a: [
      "No, you won't get multiple tokens — that is the magic of ArcIndex! Here is exactly what happens:",
      "1. You deposit a single asset (like ETH or USDC).",
      "2. Our smart contract automatically splits it and acquires the underlying basket assets (WETH, WBTC, SOL) according to your target allocation, locking them safely in the vault.",
      "3. In return, you receive a single receipt token: AETF.",
      "4. Your AETF acts like a stock share representing your entire portfolio. As the basket grows in value, so does your AETF.",
      "5. When you want to exit, simply return your AETF — the contract pays out your total proportional value in the native token.",
      "No wallet clutter, no multiple gas fees, no complexity. One deposit, one token, full index exposure.",
    ].join("\n\n"),
  },
  {
    q: "What is ArcIndex?",
    a: "ArcIndex is a decentralized index vault protocol built on Arc Network. You deposit assets (native tokens or stablecoins) and the vault mints AETF receipt tokens that represent your proportional share.",
  },
  {
    q: "How does the vault work?",
    a: "When you deposit, the smart contract mints AETF LP tokens 1:1 with your net deposit value. To exit, burn your AETF tokens and receive a pro-rata share of the vault's native balance back to your wallet.",
  },
  {
    q: "What is the 0.5% protocol fee?",
    a: "A 0.5% fee (50 basis points) is deducted from each deposit and sent to the vault owner address. This funds ongoing protocol development and maintenance. There is no fee on withdrawals.",
  },
  {
    q: "How do I redeem my AETF tokens?",
    a: "Go to the Portfolio Dashboard and use the Withdraw tab. Enter the number of AETF tokens you want to burn. Your wallet will receive the proportional share of native tokens held in the vault.",
  },
  {
    q: "Which assets can I deposit?",
    a: "ArcIndex accepts Arc's native token (ETH on Arc) plus whitelisted stablecoins (USDC and USDT). Stablecoin deposits are normalized to 18 decimals when minting shares, keeping the LP price consistent.",
  },
  {
    q: "What is Arc Network?",
    a: "Arc is a high-performance EVM-compatible blockchain developed by Circle (the company behind USDC). It is designed for fast, low-cost transactions with native stablecoin support at the protocol level.",
  },
  {
    q: "Is this contract audited?",
    a: "ArcIndex is currently in testnet phase. The contract has not yet undergone a formal security audit. Do not deposit more than you are willing to lose while the project is in early access.",
  },
];

export function FaqDrawer() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  const toggle = (i: number) => setExpanded((prev) => (prev === i ? null : i));

  return (
    <>
      {/* Floating trigger */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open FAQ"
        className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-900/50 ring-1 ring-white/20 transition hover:bg-indigo-500 hover:scale-105 active:scale-95"
      >
        <span className="text-sm font-bold">?</span>
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer — slides up from bottom on mobile, from right on desktop */}
      <div
        className={[
          "fixed bottom-0 right-0 z-50 w-full sm:bottom-0 sm:right-0 sm:w-[420px] sm:h-full",
          "bg-slate-900 ring-1 ring-white/10 shadow-2xl",
          "transition-transform duration-300 ease-in-out",
          "flex flex-col max-h-[85vh] sm:max-h-screen rounded-t-2xl sm:rounded-none",
          open ? "translate-y-0 sm:translate-x-0" : "translate-y-full sm:translate-x-full",
        ].join(" ")}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <div className="font-semibold text-zinc-100">Frequently Asked Questions</div>
            <div className="text-xs text-zinc-500 mt-0.5">Everything you need to know about ArcIndex</div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="grid h-8 w-8 place-items-center rounded-lg text-zinc-400 transition hover:bg-white/10 hover:text-zinc-100"
            aria-label="Close FAQ"
          >
            ✕
          </button>
        </div>

        {/* Accordion list */}
        <div className="flex-1 overflow-y-auto divide-y divide-white/5 px-2 py-2">
          {FAQ_ITEMS.map((item, i) => (
            <div key={i} className="rounded-xl overflow-hidden">
              <button
                onClick={() => toggle(i)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-white/5"
              >
                <span className="text-sm font-medium text-zinc-200">{item.q}</span>
                <span
                  className={`flex-shrink-0 text-indigo-400 transition-transform duration-200 ${
                    expanded === i ? "rotate-45" : ""
                  }`}
                >
                  +
                </span>
              </button>
              {expanded === i && (
                <div className="px-4 pb-4 text-sm leading-relaxed text-zinc-400 space-y-2">
                  {item.a.split("\n\n").map((para, j) => (
                    <p key={j}>{para}</p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 px-5 py-3 text-center text-[11px] text-zinc-600">
          Built with Arc · ArcIndex Protocol · Testnet Phase
        </div>
      </div>
    </>
  );
}
