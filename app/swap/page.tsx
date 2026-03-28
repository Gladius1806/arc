"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { arcMainnet } from "../providers";
import { FaqDrawer } from "../components/FaqDrawer";

// ─── Token registry ───────────────────────────────────────────────────────────
type TokenKey = "ETH" | "USDC" | "USDT" | "WETH" | "WBTC" | "SOL";

const TOKENS: {
  key: TokenKey;
  label: string;
  sub: string;
  icon: string;
  iconBg: string;
  decimals: number;
  // Indicative USD price for rate estimation
  price: number;
}[] = [
  { key: "ETH",   label: "ETH",   sub: "Native",       icon: "Ξ",  iconBg: "bg-indigo-500",  decimals: 18, price: 3200   },
  { key: "USDC",  label: "USDC",  sub: "USD Coin",      icon: "$",  iconBg: "bg-blue-500",    decimals: 6,  price: 1      },
  { key: "USDT",  label: "USDT",  sub: "Tether USD",    icon: "₮",  iconBg: "bg-teal-500",    decimals: 6,  price: 1      },
  { key: "WETH",  label: "WETH",  sub: "Wrapped ETH",   icon: "Ξ",  iconBg: "bg-indigo-400",  decimals: 18, price: 3200   },
  { key: "WBTC",  label: "WBTC",  sub: "Wrapped BTC",   icon: "₿",  iconBg: "bg-amber-500",   decimals: 8,  price: 65000  },
  { key: "SOL",   label: "SOL",   sub: "Solana",        icon: "◎",  iconBg: "bg-violet-500",  decimals: 9,  price: 150    },
];

function getToken(key: TokenKey) {
  return TOKENS.find((t) => t.key === key)!;
}

// ─── Token selector modal ─────────────────────────────────────────────────────
function TokenModal({
  title,
  current,
  exclude,
  onSelect,
  onClose,
}: {
  title: string;
  current: TokenKey;
  exclude: TokenKey;
  onSelect: (k: TokenKey) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = TOKENS.filter(
    (t) => t.key !== exclude && (
      t.label.toLowerCase().includes(query.toLowerCase()) ||
      t.sub.toLowerCase().includes(query.toLowerCase())
    )
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-3xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="font-semibold text-gray-900">{title}</div>
          <button
            onClick={onClose}
            className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            ✕
          </button>
        </div>
        {/* Search */}
        <div className="px-4 py-3">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search token…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        {/* Token list */}
        <div className="max-h-72 overflow-y-auto px-3 pb-4">
          {filtered.map((t) => (
            <button
              key={t.key}
              onClick={() => { onSelect(t.key); onClose(); }}
              className={[
                "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition",
                t.key === current
                  ? "bg-indigo-50 ring-1 ring-indigo-200"
                  : "hover:bg-slate-50",
              ].join(" ")}
            >
              <span className={`grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl text-sm font-bold text-white ${t.iconBg}`}>
                {t.icon}
              </span>
              <div className="min-w-0">
                <div className="font-semibold text-gray-900">{t.label}</div>
                <div className="text-xs text-slate-400">{t.sub}</div>
              </div>
              <div className="ml-auto text-right">
                <div className="text-xs text-slate-400">
                  ~${t.price.toLocaleString()}
                </div>
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="py-8 text-center text-sm text-slate-400">No tokens found.</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Token input box ──────────────────────────────────────────────────────────
function TokenBox({
  label,
  amount,
  token,
  readOnly,
  onAmountChange,
  onTokenClick,
  usdValue,
  highlight,
}: {
  label: string;
  amount: string;
  token: TokenKey;
  readOnly?: boolean;
  onAmountChange?: (v: string) => void;
  onTokenClick: () => void;
  usdValue?: number | null;
  highlight?: boolean;
}) {
  const t = getToken(token);
  return (
    <div
      className={[
        "rounded-2xl border p-4 transition",
        highlight
          ? "border-indigo-300 bg-indigo-50/60 ring-2 ring-indigo-100"
          : "border-slate-200 bg-slate-50",
      ].join(" ")}
    >
      <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
        <span>{label}</span>
        {usdValue != null && usdValue > 0 && (
          <span className="font-medium text-slate-500">
            ≈ {usdValue.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 })}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <input
          value={amount}
          readOnly={readOnly}
          onChange={(e) => onAmountChange?.(e.target.value)}
          inputMode="decimal"
          placeholder="0.00"
          className={[
            "min-w-0 flex-1 bg-transparent text-2xl font-bold outline-none placeholder:text-slate-300",
            readOnly ? "text-slate-700 cursor-default" : "text-gray-900",
          ].join(" ")}
        />
        <button
          onClick={onTokenClick}
          className="flex flex-shrink-0 items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-sm ring-1 ring-slate-200 transition hover:ring-indigo-300 active:scale-95"
        >
          <span className={`grid h-6 w-6 place-items-center rounded-lg text-xs font-bold text-white ${t.iconBg}`}>
            {t.icon}
          </span>
          <span className="text-sm font-bold text-gray-900">{t.label}</span>
          <span className="text-xs text-slate-400">▾</span>
        </button>
      </div>
    </div>
  );
}

// ─── ArcLogo ──────────────────────────────────────────────────────────────────
function ArcLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <path d="M10 2L18 7V13L10 18L2 13V7L10 2Z" stroke="white" strokeWidth="1.6" strokeLinejoin="round"/>
      <path d="M10 7V13M7 8.5L13 11.5" stroke="white" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  );
}

// ─── Wrong chain banner ───────────────────────────────────────────────────────
function WrongChainBanner() {
  const { isConnected }            = useAccount();
  const chainId                    = useChainId();
  const { switchChain, isPending } = useSwitchChain();
  const didAutoSwitch = useRef(false);
  useEffect(() => {
    if (isConnected && chainId !== arcMainnet.id && !didAutoSwitch.current) {
      didAutoSwitch.current = true;
      const t = setTimeout(() => switchChain({ chainId: arcMainnet.id }), 800);
      return () => clearTimeout(t);
    }
    if (!isConnected) didAutoSwitch.current = false;
  }, [isConnected, chainId, switchChain]);
  if (!isConnected || chainId === arcMainnet.id) return null;
  return (
    <div className="border-b border-amber-300 bg-amber-50">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-2.5">
        <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
          <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
          Wrong network — switch to Arc Testnet (Chain ID {arcMainnet.id})
        </div>
        <button
          onClick={() => switchChain({ chainId: arcMainnet.id })}
          disabled={isPending}
          className="flex-shrink-0 rounded-lg bg-amber-500 px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600 disabled:opacity-60"
        >
          {isPending ? "Switching…" : "Switch to Arc"}
        </button>
      </div>
    </div>
  );
}

// ─── Swap page ────────────────────────────────────────────────────────────────
export default function SwapPage() {
  const { isConnected } = useAccount();

  const [fromToken, setFromToken] = useState<TokenKey>("ETH");
  const [toToken,   setToToken]   = useState<TokenKey>("USDC");
  const [fromAmt,   setFromAmt]   = useState("");
  const [slippage,  setSlippage]  = useState(0.5);
  const [modal,     setModal]     = useState<"from" | "to" | null>(null);
  const [swapping,  setSwapping]  = useState(false);
  const [swapMsg,   setSwapMsg]   = useState<{ text: string; ok: boolean } | null>(null);

  const fromMeta = getToken(fromToken);
  const toMeta   = getToken(toToken);

  // Estimated output based on hardcoded price ratios
  const toAmt = useMemo(() => {
    const n = parseFloat(fromAmt);
    if (!isFinite(n) || n <= 0) return "";
    const rate = fromMeta.price / toMeta.price;
    return (n * rate * (1 - slippage / 100)).toFixed(6);
  }, [fromAmt, fromMeta.price, toMeta.price, slippage]);

  const fromUsd = useMemo(() => {
    const n = parseFloat(fromAmt);
    return isFinite(n) && n > 0 ? n * fromMeta.price : null;
  }, [fromAmt, fromMeta.price]);

  const toUsd = useMemo(() => {
    const n = parseFloat(toAmt);
    return isFinite(n) && n > 0 ? n * toMeta.price : null;
  }, [toAmt, toMeta.price]);

  const priceImpact = useMemo(() => {
    const n = parseFloat(fromAmt);
    if (!isFinite(n) || n <= 0) return null;
    // Simulate price impact: grows with size (UI only)
    return Math.min(n * fromMeta.price * 0.00001, 3).toFixed(3);
  }, [fromAmt, fromMeta.price]);

  const exchangeRate = useMemo(() => {
    const rate = fromMeta.price / toMeta.price;
    return `1 ${fromToken} ≈ ${rate.toLocaleString("en-US", { maximumFractionDigits: 6 })} ${toToken}`;
  }, [fromToken, toToken, fromMeta.price, toMeta.price]);

  const flip = useCallback(() => {
    setFromToken(toToken);
    setToToken(fromToken);
    setFromAmt(toAmt !== "" ? toAmt : "");
    setSwapMsg(null);
  }, [fromToken, toToken, toAmt]);

  const handleSwap = async () => {
    if (!isConnected || !fromAmt) return;
    setSwapping(true);
    setSwapMsg(null);
    // Simulate a 1.5s "swap" (real integration requires a deployed AMM)
    await new Promise((r) => setTimeout(r, 1500));
    setSwapping(false);
    setSwapMsg({
      text: `Swap submitted: ${fromAmt} ${fromToken} → ${toAmt} ${toToken}. (AMM routing coming soon — this is a UI demo on Arc Testnet.)`,
      ok: true,
    });
    setFromAmt("");
  };

  const canSwap = isConnected && Boolean(fromAmt) && parseFloat(fromAmt) > 0 && fromToken !== toToken;

  const ctaLabel = !isConnected
    ? "Connect Wallet"
    : !fromAmt || parseFloat(fromAmt) <= 0
    ? "Enter an amount"
    : fromToken === toToken
    ? "Select different tokens"
    : swapping
    ? "Swapping…"
    : `Swap ${fromToken} → ${toToken}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/40 to-white text-gray-900">
      {/* ── Navbar ────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md shadow-indigo-200">
                <ArcLogo />
              </div>
              <div>
                <div className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-base font-bold text-transparent">
                  ArcIndex
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-400">Swap</span>
                  <span className="rounded-full bg-indigo-100 px-1.5 py-px text-[9px] font-semibold text-indigo-600">
                    Built with Arc
                  </span>
                </div>
              </div>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/"
              className="hidden sm:block rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:border-indigo-300 hover:text-indigo-600">
              ← Deposit
            </Link>
            <Link href="/dashboard"
              className="hidden sm:block rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:border-indigo-300 hover:text-indigo-600">
              Dashboard
            </Link>
            <ConnectButton />
          </div>
        </div>
      </header>

      <WrongChainBanner />

      {/* ── Swap layout ──────────────────────────────────────────────────── */}
      <main className="mx-auto flex max-w-lg flex-col items-center px-4 py-12">
        {/* Page title */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight">
            <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
              Swap tokens
            </span>
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Trade any token pair on Arc Testnet · Powered by ArcIndex AMM
          </p>
        </div>

        {/* Swap card */}
        <div className="w-full rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl shadow-indigo-100/60 ring-1 ring-slate-100">
          {/* Card header */}
          <div className="mb-4 flex items-center justify-between">
            <span className="font-bold text-gray-900">Swap</span>
            {/* Slippage control */}
            <div className="flex items-center gap-1 text-xs">
              <span className="text-slate-400">Slippage:</span>
              {[0.1, 0.5, 1.0].map((s) => (
                <button
                  key={s}
                  onClick={() => setSlippage(s)}
                  className={[
                    "rounded-lg px-2 py-0.5 font-semibold transition",
                    slippage === s
                      ? "bg-indigo-100 text-indigo-600"
                      : "text-slate-400 hover:text-slate-600",
                  ].join(" ")}
                >
                  {s}%
                </button>
              ))}
              <input
                type="number"
                step="0.1"
                min="0.01"
                max="50"
                value={slippage}
                onChange={(e) => setSlippage(parseFloat(e.target.value) || 0.5)}
                className="ml-1 w-14 rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-center text-xs font-semibold text-gray-700 outline-none focus:border-indigo-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-slate-400">%</span>
            </div>
          </div>

          {/* From */}
          <TokenBox
            label="You pay"
            amount={fromAmt}
            token={fromToken}
            onAmountChange={(v) => { setFromAmt(v); setSwapMsg(null); }}
            onTokenClick={() => setModal("from")}
            usdValue={fromUsd}
            highlight={modal === "from"}
          />

          {/* Flip button */}
          <div className="relative my-1 flex justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <button
              onClick={flip}
              className="relative z-10 grid h-10 w-10 place-items-center rounded-xl border-2 border-white bg-slate-100 text-slate-500 shadow-sm transition hover:bg-indigo-50 hover:text-indigo-600 hover:rotate-180 active:scale-90"
              style={{ transition: "transform 0.25s, background 0.15s" }}
              aria-label="Flip tokens"
            >
              ↕
            </button>
          </div>

          {/* To */}
          <TokenBox
            label="You receive (estimated)"
            amount={toAmt}
            token={toToken}
            readOnly
            onTokenClick={() => setModal("to")}
            usdValue={toUsd}
          />

          {/* Rate / impact details */}
          {fromAmt && parseFloat(fromAmt) > 0 && (
            <div className="mt-3 space-y-2 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs">
              {/* Each row: label shrinks to fit, value wraps if needed */}
              {[
                {
                  label: "Exchange rate",
                  value: exchangeRate,
                  cls: "text-gray-700",
                },
                {
                  label: "Price impact",
                  value: `~${priceImpact}%`,
                  cls: Number(priceImpact) < 0.5
                    ? "text-emerald-600"
                    : Number(priceImpact) < 2
                    ? "text-amber-500"
                    : "text-rose-500",
                },
                {
                  label: "Slippage tolerance",
                  value: `${slippage}%`,
                  cls: "text-gray-700",
                },
                {
                  label: "Min. received",
                  value: toAmt
                    ? `${(parseFloat(toAmt) * (1 - slippage / 100)).toFixed(6)} ${toToken}`
                    : "—",
                  cls: "text-gray-700",
                },
                {
                  label: "Network",
                  value: "Arc Testnet",
                  cls: "text-indigo-600",
                },
              ].map(({ label, value, cls }) => (
                <div key={label} className="flex items-start justify-between gap-3">
                  <span className="flex-shrink-0 text-slate-500">{label}</span>
                  <span className={`min-w-0 break-all text-right font-semibold leading-relaxed ${cls}`}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* CTA */}
          <button
            onClick={handleSwap}
            disabled={!canSwap || swapping}
            className={[
              "mt-4 w-full rounded-2xl py-4 text-sm font-bold tracking-wide transition",
              canSwap && !swapping
                ? "bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-200 hover:brightness-110 active:scale-[0.98]"
                : "cursor-not-allowed bg-slate-100 text-slate-400",
            ].join(" ")}
          >
            <span className="inline-flex items-center justify-center gap-2">
              {swapping && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              )}
              {ctaLabel}
            </span>
          </button>

          {/* Feedback */}
          {swapMsg && (
            <div className={`mt-3 rounded-xl px-3 py-2.5 text-xs ring-1 ${
              swapMsg.ok
                ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                : "bg-rose-50 text-rose-600 ring-rose-200"
            }`}>
              {swapMsg.text}
            </div>
          )}

          {/* Notice */}
          <p className="mt-3 text-center text-[10px] text-slate-300">
            ArcIndex Swap · UI preview · AMM routing coming soon · Arc Testnet
          </p>
        </div>

        {/* Recent popular pairs */}
        <div className="mt-8 w-full">
          <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
            Popular pairs on Arc
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {([
              ["ETH",  "USDC"],
              ["WBTC", "USDC"],
              ["SOL",  "USDC"],
              ["WETH", "WBTC"],
              ["ETH",  "SOL"],
              ["USDC", "USDT"],
            ] as [TokenKey, TokenKey][]).map(([f, t]) => {
              const fm = getToken(f), tm = getToken(t);
              return (
                <button
                  key={`${f}-${t}`}
                  onClick={() => { setFromToken(f); setToToken(t); setFromAmt(""); setSwapMsg(null); }}
                  className={[
                    "flex min-w-0 items-center gap-1.5 rounded-xl border bg-white px-2.5 py-2 text-left shadow-sm transition",
                    fromToken === f && toToken === t
                      ? "border-indigo-300 ring-2 ring-indigo-100"
                      : "border-slate-200 hover:border-indigo-300",
                  ].join(" ")}
                >
                  <span className={`grid h-5 w-5 flex-shrink-0 place-items-center rounded-md text-[10px] font-bold text-white ${fm.iconBg}`}>
                    {fm.icon}
                  </span>
                  <span className="truncate text-xs font-bold text-gray-800">{f}</span>
                  <span className="flex-shrink-0 text-[10px] text-slate-400">→</span>
                  <span className={`grid h-5 w-5 flex-shrink-0 place-items-center rounded-md text-[10px] font-bold text-white ${tm.iconBg}`}>
                    {tm.icon}
                  </span>
                  <span className="truncate text-xs font-bold text-gray-800">{t}</span>
                </button>
              );
            })}
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-100 py-8 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} ArcIndex Protocol · Built with Arc Network by Circle
      </footer>

      {/* Token selection modals */}
      {modal === "from" && (
        <TokenModal
          title="Select token to pay"
          current={fromToken}
          exclude={toToken}
          onSelect={setFromToken}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "to" && (
        <TokenModal
          title="Select token to receive"
          current={toToken}
          exclude={fromToken}
          onSelect={setToToken}
          onClose={() => setModal(null)}
        />
      )}

      <FaqDrawer />
    </div>
  );
}
