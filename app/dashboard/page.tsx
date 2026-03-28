"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  useAccount,
  useBalance,
  useChainId,
  useReadContract,
  useSwitchChain,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
} from "wagmi";
import { formatEther, parseEther } from "viem";
import { CONTRACT_ADDRESS, vaultAbi } from "../vault-abi";
import { arcMainnet } from "../providers";

// ─── Types ───────────────────────────────────────────────────────────────────
interface CoinData {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number;
  sparkline_in_7d: { price: number[] };
}

interface TxEvent {
  key: string;
  type: "Deposit" | "Withdraw" | "Transfer";
  address: string;
  amount: bigint;
  ts: number;
  hash: string;
}

// ─── Logo ────────────────────────────────────────────────────────────────────
function ArcLogo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M10 2L18 7V13L10 18L2 13V7L10 2Z" stroke="white" strokeWidth="1.6" strokeLinejoin="round"/>
      <path d="M10 7V13M7 8.5L13 11.5" stroke="white" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  );
}

// ─── Sparkline ───────────────────────────────────────────────────────────────
function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  if (!data || data.length < 2) return null;
  const W = 80, H = 30;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) =>
    `${(i / (data.length - 1)) * W},${H - ((v - min) / range) * H}`
  ).join(" ");
  const col = positive ? "#22c55e" : "#ef4444";
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible flex-shrink-0">
      <polyline points={pts} fill="none" stroke={col} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ─── Stat card ───────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accentCls = "text-indigo-600" }: {
  label: string; value: string; sub?: string; accentCls?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-100">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`mt-2 text-2xl font-bold tabular-nums ${accentCls}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
function fmt(val: bigint, d = 4) {
  return parseFloat(formatEther(val)).toFixed(d);
}
function fmtUsd(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

// ─── Wrong-chain banner ───────────────────────────────────────────────────────
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

// ─── Dashboard ───────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: arcMainnet.id });

  // ── Contract reads ──────────────────────────────────────────────────────
  const { data: lpBalance, refetch: refetchLp } = useReadContract({
    address: CONTRACT_ADDRESS, abi: vaultAbi,
    functionName: "balanceOf", args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });
  const { data: totalSupply, refetch: refetchSupply } = useReadContract({
    address: CONTRACT_ADDRESS, abi: vaultAbi, functionName: "totalSupply",
  });
  const { data: vaultBal, refetch: refetchVaultBal } = useReadContract({
    address: CONTRACT_ADDRESS, abi: vaultAbi, functionName: "vaultBalance",
  });

  const refetchAll = useCallback(() => {
    refetchLp(); refetchSupply(); refetchVaultBal();
  }, [refetchLp, refetchSupply, refetchVaultBal]);

  const userShare = useMemo(() => {
    if (!lpBalance || !totalSupply || (totalSupply as bigint) === BigInt(0)) return 0;
    return Number((lpBalance as bigint) * BigInt(10_000) / (totalSupply as bigint)) / 100;
  }, [lpBalance, totalSupply]);

  const userValue = useMemo(() => {
    if (!lpBalance || !vaultBal || !totalSupply || (totalSupply as bigint) === BigInt(0)) return BigInt(0);
    return ((lpBalance as bigint) * (vaultBal as bigint)) / (totalSupply as bigint);
  }, [lpBalance, vaultBal, totalSupply]);

  // ── Wallet balances ─────────────────────────────────────────────────────
  const { data: ethBalance } = useBalance({
    address,
    query: { enabled: Boolean(address) },
  });

  const handleDepositMax = useCallback(() => {
    if (!ethBalance) return;
    const GAS_RESERVE = parseEther("0.002");
    const max = ethBalance.value > GAS_RESERVE ? ethBalance.value - GAS_RESERVE : BigInt(0);
    setDepositAmt(parseFloat(formatEther(max)).toFixed(6));
  }, [ethBalance]);

  const handleWithdrawMax = useCallback(() => {
    if (!lpBalance) return;
    setWithdrawAmt(fmt(lpBalance as bigint, 6));
  }, [lpBalance]);

  // ── Deposit / Withdraw ──────────────────────────────────────────────────
  const [tab, setTab]                   = useState<"deposit" | "withdraw">("deposit");
  const [depositAmt, setDepositAmt]     = useState("");
  const [withdrawAmt, setWithdrawAmt]   = useState("");
  const parsedDeposit = useMemo(() => {
    try { const n = parseFloat(depositAmt.replace(",", ".")); return isFinite(n) && n > 0 ? parseEther(n.toFixed(18) as `${number}`) : null; }
    catch { return null; }
  }, [depositAmt]);
  const parsedWithdraw = useMemo(() => {
    try { const n = parseFloat(withdrawAmt.replace(",", ".")); return isFinite(n) && n > 0 ? parseEther(n.toFixed(18) as `${number}`) : null; }
    catch { return null; }
  }, [withdrawAmt]);

  const { writeContractAsync, isPending } = useWriteContract();
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [txMsg,  setTxMsg]  = useState<{ text: string; ok: boolean } | null>(null);
  const receipt = useWaitForTransactionReceipt({ hash: txHash ?? undefined });
  const isLoading = isPending || receipt.isLoading;

  // Session-local tx events (persists until page refresh)
  const [sessionEvents, setSessionEvents] = useState<TxEvent[]>([]);

  useEffect(() => {
    if (receipt.isSuccess) {
      setTxMsg({ text: "Transaction confirmed!", ok: true });
      refetchAll();
      // Append to session events
      const ev: TxEvent = {
        key: txHash ?? Date.now().toString(),
        type: tab === "deposit" ? "Deposit" : "Withdraw",
        address: address ?? "0x",
        amount: tab === "deposit" ? (parsedDeposit ?? BigInt(0)) : (parsedWithdraw ?? BigInt(0)),
        ts: Date.now(),
        hash: txHash ?? "0x",
      };
      setSessionEvents((p) => [ev, ...p].slice(0, 20));
    }
    if (receipt.isError) setTxMsg({ text: "Transaction failed.", ok: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt.isSuccess, receipt.isError]);

  const handleDeposit = async () => {
    if (!parsedDeposit || !address) return;
    setTxMsg(null);
    try {
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS, abi: vaultAbi,
        functionName: "deposit", value: parsedDeposit,
        account: address,
        chain: undefined,
      } as Parameters<typeof writeContractAsync>[0]);
      setTxHash(hash);
    } catch (e) {
      setTxMsg({ text: (e instanceof Error ? e.message.split("(")[0].trim() : "Error"), ok: false });
    }
  };

  const handleWithdraw = async () => {
    if (!parsedWithdraw || !address) return;
    setTxMsg(null);
    try {
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS, abi: vaultAbi,
        functionName: "withdraw", args: [parsedWithdraw],
        account: address,
        chain: undefined,
      } as Parameters<typeof writeContractAsync>[0]);
      setTxHash(hash);
    } catch (e) {
      setTxMsg({ text: (e instanceof Error ? e.message.split("(")[0].trim() : "Error"), ok: false });
    }
  };

  // ── CoinGecko prices ────────────────────────────────────────────────────
  const [prices, setPrices]           = useState<CoinData[]>([]);
  const [priceState, setPriceState]   = useState<"loading" | "ok" | "error">("loading");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchPrices = useCallback(() => {
    setPriceState("loading");
    fetch(
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd" +
      "&ids=ethereum,bitcoin,solana&sparkline=true&price_change_percentage=24h"
    )
      .then((r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then((d: CoinData[]) => {
        setPrices(d);
        setPriceState("ok");
        setLastUpdated(new Date());
      })
      .catch(() => setPriceState("error"));
  }, []);

  useEffect(() => {
    fetchPrices();
    const id = setInterval(fetchPrices, 60_000); // auto-refresh every 60s
    return () => clearInterval(id);
  }, [fetchPrices]);

  // ── On-chain event history (+ session merge) ─────────────────────────────
  const [chainEvents, setChainEvents]     = useState<TxEvent[]>([]);
  const [eventsState, setEventsState]     = useState<"loading" | "ok" | "empty" | "error">("loading");

  useEffect(() => {
    if (!publicClient) { setEventsState("empty"); return; }
    setEventsState("loading");

    const TRANSFER_EVENT = {
      type: "event" as const, name: "Transfer",
      inputs: [
        { indexed: true,  name: "from",  type: "address" },
        { indexed: true,  name: "to",    type: "address" },
        { indexed: false, name: "value", type: "uint256" },
      ],
    };

    // Fetch with a limited block window (last 2000 blocks) to avoid RPC timeout.
    // Falls back to empty state (not error) so the UI stays friendly.
    const fetchWithRange = async (fromBlock: bigint | "earliest") => {
      const logs = await publicClient.getLogs({
        address: CONTRACT_ADDRESS,
        event: TRANSFER_EVENT,
        fromBlock,
        toBlock: "latest",
      });
      return logs;
    };

    const run = async () => {
      try {
        // Try limited range first (avoids RPC block-range limits on testnet)
        let logs;
        try {
          const latest = await publicClient.getBlockNumber();
          const from = latest > BigInt(2000) ? latest - BigInt(2000) : BigInt(0);
          logs = await fetchWithRange(from);
        } catch {
          // If even limited range fails, resolve to empty — never show error state
          setChainEvents([]);
          setEventsState("empty");
          return;
        }

        const parsed: TxEvent[] = logs.slice(-30).reverse().map((log, i) => {
          const from  = (log.args as { from: string }).from ?? "0x";
          const to    = (log.args as { to: string }).to   ?? "0x";
          const value = (log.args as { value: bigint }).value ?? BigInt(0);
          const isMint = from === "0x0000000000000000000000000000000000000000";
          const isBurn = to   === "0x0000000000000000000000000000000000000000";
          return {
            key:     `${log.transactionHash ?? ""}-${i}`,
            type:    isMint ? "Deposit" : isBurn ? "Withdraw" : "Transfer",
            address: isMint ? to : from,
            amount:  value,
            ts:      0,
            hash:    log.transactionHash ?? "0x",
          };
        });
        setChainEvents(parsed);
        setEventsState(parsed.length > 0 ? "ok" : "empty");
      } catch {
        // Any unexpected failure → gracefully show empty, not broken
        setChainEvents([]);
        setEventsState("empty");
      }
    };

    run();
  }, [publicClient]);

  // Merge session events on top of chain events, deduplicate by hash
  const allEvents = useMemo(() => {
    const seen = new Set<string>();
    const merged: TxEvent[] = [];
    for (const ev of [...sessionEvents, ...chainEvents]) {
      if (!seen.has(ev.key)) { seen.add(ev.key); merged.push(ev); }
    }
    return merged.slice(0, 20);
  }, [sessionEvents, chainEvents]);

  // ── Allocation visual ───────────────────────────────────────────────────
  const ALLOC = [
    { label: "WETH", pct: 50, bar: "bg-indigo-500",  dot: "bg-indigo-500" },
    { label: "WBTC", pct: 30, bar: "bg-amber-400",   dot: "bg-amber-400"  },
    { label: "SOL",  pct: 20, bar: "bg-violet-500",  dot: "bg-violet-500" },
  ];

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/40 to-white text-gray-900">
      {/* ── Navbar ────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
          <Link href="/" className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md shadow-indigo-200">
              <ArcLogo />
            </div>
            <div>
              <div className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-base font-bold text-transparent">
                ArcIndex
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400">Portfolio Dashboard</span>
                <span className="rounded-full bg-indigo-100 px-1.5 py-px text-[9px] font-semibold text-indigo-600">
                  Built with Arc
                </span>
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/swap"
              className="hidden sm:block rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:border-indigo-300 hover:text-indigo-600">
              Swap
            </Link>
            <Link href="/"
              className="hidden sm:block rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:border-indigo-300 hover:text-indigo-600">
              ← Deposit
            </Link>
            <ConnectButton />
          </div>
        </div>
      </header>

      <WrongChainBanner />

      <main className="mx-auto max-w-7xl px-6 py-10 space-y-8">
        {/* ── Stat row ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            label="Vault Balance"
            value={vaultBal !== undefined ? `${fmt(vaultBal as bigint, 4)} USDC` : "—"}
            sub="Total native in vault"
            accentCls="text-indigo-600"
          />
          <StatCard
            label="Your LP Balance"
            value={lpBalance !== undefined ? `${fmt(lpBalance as bigint, 4)} AETF` : "—"}
            sub="Receipt tokens"
            accentCls="text-violet-600"
          />
          <StatCard
            label="Your Share"
            value={isConnected ? `${userShare.toFixed(2)}%` : "—"}
            sub="of total vault"
            accentCls="text-amber-600"
          />
          <StatCard
            label="Redeemable"
            value={userValue > BigInt(0) ? `${fmt(userValue, 4)} USDC` : "—"}
            sub="Estimated native value"
            accentCls="text-emerald-600"
          />
        </div>

        {/* ── Two-column row ────────────────────────────────────────────── */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* ── Deposit / Withdraw card ──────────────────────────────────── */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm ring-1 ring-slate-100">
            {/* Tabs */}
            <div className="mb-6 flex rounded-xl border border-slate-200 bg-slate-50 p-1 gap-1">
              {(["deposit", "withdraw"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setTxMsg(null); }}
                  className={[
                    "flex-1 rounded-lg py-2 text-sm font-semibold capitalize transition",
                    tab === t
                      ? "bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200"
                      : "text-slate-400 hover:text-slate-600",
                  ].join(" ")}
                >
                  {t}
                </button>
              ))}
            </div>

            {tab === "deposit" ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-gray-800">Amount (USDC Native)</label>
                  {ethBalance && (
                    <span className="text-[11px] text-slate-400">
                      Balance:{" "}
                      <span className="font-semibold text-slate-600">
                        {parseFloat(formatEther(ethBalance.value)).toFixed(4)}{" "}
                        {ethBalance.symbol}
                      </span>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 transition focus-within:border-indigo-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-100">
                  <input
                    value={depositAmt}
                    onChange={(e) => setDepositAmt(e.target.value)}
                    inputMode="decimal" placeholder="0.00"
                    className="min-w-0 flex-1 bg-transparent text-lg font-bold outline-none placeholder:text-slate-300"
                  />
                  {isConnected && (
                    <button
                      onClick={handleDepositMax}
                      className="flex-shrink-0 rounded-lg bg-indigo-50 px-2 py-1 text-[11px] font-bold text-indigo-600 ring-1 ring-indigo-200 transition hover:bg-indigo-100 active:scale-95"
                    >
                      MAX
                    </button>
                  )}
                  <span className="flex-shrink-0 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 shadow-sm ring-1 ring-slate-200">USDC</span>
                </div>
                <p className="text-xs text-slate-400">0.5% fee deducted · AETF minted 1:1 with net USDC</p>
                <button
                  onClick={handleDeposit}
                  disabled={!isConnected || !parsedDeposit || isLoading}
                  className={[
                    "w-full rounded-2xl py-3.5 text-sm font-bold transition",
                    isConnected && parsedDeposit && !isLoading
                      ? "bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-200 hover:brightness-110 active:scale-[0.98]"
                      : "cursor-not-allowed bg-slate-100 text-slate-400",
                  ].join(" ")}
                >
                  <span className="inline-flex items-center gap-2">
                    {isLoading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
                    {isLoading ? "Confirming…" : "Deposit USDC"}
                  </span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-gray-800">Shares to redeem (AETF)</label>
                  {lpBalance !== undefined && (
                    <span className="text-[11px] text-slate-400">
                      Balance:{" "}
                      <span className="font-semibold text-slate-600">
                        {fmt(lpBalance as bigint, 4)} AETF
                      </span>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 transition focus-within:border-indigo-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-100">
                  <input
                    value={withdrawAmt}
                    onChange={(e) => setWithdrawAmt(e.target.value)}
                    inputMode="decimal" placeholder="0.00"
                    className="min-w-0 flex-1 bg-transparent text-lg font-bold outline-none placeholder:text-slate-300"
                  />
                  {isConnected && lpBalance !== undefined && (
                    <button
                      onClick={handleWithdrawMax}
                      className="flex-shrink-0 rounded-lg bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-500 ring-1 ring-rose-200 transition hover:bg-rose-100 active:scale-95"
                    >
                      MAX
                    </button>
                  )}
                  <span className="flex-shrink-0 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 shadow-sm ring-1 ring-slate-200">AETF</span>
                </div>
                <p className="text-xs text-slate-400">Burns AETF and returns proportional USDC (native) from vault.</p>
                <button
                  onClick={handleWithdraw}
                  disabled={!isConnected || !parsedWithdraw || isLoading}
                  className={[
                    "w-full rounded-2xl py-3.5 text-sm font-bold transition",
                    isConnected && parsedWithdraw && !isLoading
                      ? "bg-gradient-to-r from-rose-500 to-orange-500 text-white shadow-md hover:brightness-110 active:scale-[0.98]"
                      : "cursor-not-allowed bg-slate-100 text-slate-400",
                  ].join(" ")}
                >
                  <span className="inline-flex items-center gap-2">
                    {isLoading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
                    {isLoading ? "Confirming…" : "Withdraw USDC"}
                  </span>
                </button>
              </div>
            )}

            {txMsg && (
              <div className={`mt-4 rounded-xl px-3 py-2.5 text-sm ring-1 ${
                txMsg.ok
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                  : "bg-rose-50 text-rose-600 ring-rose-200"
              }`}>{txMsg.text}</div>
            )}
            {txHash && (
              <p className="mt-2 break-all font-mono text-[11px] text-slate-400">Tx: {txHash}</p>
            )}
          </section>

          {/* ── Market Prices ──────────────────────────────────────────────── */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm ring-1 ring-slate-100">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="font-semibold text-gray-900">Market Prices</div>
              <div className="flex items-center gap-2">
                {lastUpdated && (
                  <span className="text-[11px] text-slate-400">
                    {lastUpdated.toLocaleTimeString()}
                  </span>
                )}
                <button
                  onClick={fetchPrices}
                  disabled={priceState === "loading"}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-500 shadow-sm transition hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-40"
                >
                  {priceState === "loading" ? "…" : "↻ Refresh"}
                </button>
              </div>
            </div>

            {priceState === "loading" && (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
                ))}
              </div>
            )}

            {priceState === "error" && (
              <div className="rounded-xl bg-rose-50 p-4 text-sm text-rose-600 ring-1 ring-rose-200">
                Could not load prices from CoinGecko.{" "}
                <button onClick={fetchPrices} className="font-semibold underline">Retry</button>
              </div>
            )}

            {priceState === "ok" && prices.length > 0 && (
              <div className="space-y-3">
                {prices.map((coin) => {
                  const pos = coin.price_change_percentage_24h >= 0;
                  return (
                    <div
                      key={coin.id}
                      className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 transition hover:border-indigo-200 hover:bg-indigo-50/40"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-bold uppercase text-gray-900">{coin.symbol}</div>
                        <div className="text-xs text-slate-400">{coin.name}</div>
                      </div>
                      <div className="hidden sm:block">
                        <Sparkline data={coin.sparkline_in_7d?.price ?? []} positive={pos} />
                      </div>
                      <div className="text-right">
                        <div className="font-bold tabular-nums text-gray-900">
                          {fmtUsd(coin.current_price)}
                        </div>
                        <div className={`text-xs font-semibold ${pos ? "text-emerald-600" : "text-rose-500"}`}>
                          {pos ? "▲" : "▼"} {Math.abs(coin.price_change_percentage_24h).toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <p className="mt-3 text-[10px] text-slate-300 text-right">
              CoinGecko · Auto-refresh 60s
            </p>
          </section>
        </div>

        {/* ── Second row: Allocation + Activity ─────────────────────────── */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* ── Target basket allocation ──────────────────────────────────── */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm ring-1 ring-slate-100">
            <div className="mb-5 font-semibold text-gray-900">Target Basket Allocation</div>
            <div className="flex items-center gap-8">
              {/* Donut */}
              <div
                className="h-28 w-28 flex-shrink-0 rounded-full"
                style={{
                  background: `conic-gradient(
                    #6366f1 0% ${ALLOC[0].pct}%,
                    #fbbf24 ${ALLOC[0].pct}% ${ALLOC[0].pct + ALLOC[1].pct}%,
                    #8b5cf6 ${ALLOC[0].pct + ALLOC[1].pct}% 100%
                  )`,
                  WebkitMask: "radial-gradient(farthest-side, transparent 56%, black 57%)",
                  mask: "radial-gradient(farthest-side, transparent 56%, black 57%)",
                }}
              />
              <div className="space-y-2">
                {ALLOC.map((a) => (
                  <div key={a.label} className="flex items-center gap-2 text-sm">
                    <span className={`h-3 w-3 rounded-full ${a.dot}`} />
                    <span className="w-10 font-semibold text-gray-800">{a.label}</span>
                    <span className="tabular-nums text-slate-500">{a.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100">
              <div className="flex h-full w-full">
                {ALLOC.map((a) => (
                  <div key={a.label} className={`h-full ${a.bar} transition-all`} style={{ width: `${a.pct}%` }} />
                ))}
              </div>
            </div>
            <div className="mt-1.5 flex justify-between text-[11px] text-slate-400">
              {ALLOC.map((a) => <span key={a.label}>{a.label} {a.pct}%</span>)}
            </div>
            <p className="mt-4 text-xs text-slate-400">
              These are the <em>target</em> weights set at deposit time. On-chain the vault holds native ETH — the allocation represents intended off-chain index weights.
            </p>
          </section>

          {/* ── Recent vault activity ─────────────────────────────────────── */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm ring-1 ring-slate-100">
            <div className="mb-4 flex items-center justify-between">
              <div className="font-semibold text-gray-900">Recent Vault Activity</div>
              <div className="text-xs text-slate-400">
                {eventsState === "loading" && "Loading…"}
                {eventsState === "ok"      && `${chainEvents.length} on-chain`}
                {(eventsState === "empty" || eventsState === "error") && "No recent txs"}
              </div>
            </div>

            {allEvents.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <div className="text-3xl">🔍</div>
                <div className="text-sm font-medium text-gray-700">No activity yet</div>
                <div className="text-xs text-slate-400 max-w-xs">
                  Deposits and withdrawals will appear here instantly after your first transaction.
                </div>
                <Link href="/"
                  className="mt-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700">
                  Make your first deposit →
                </Link>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {allEvents.map((ev) => (
                  <div
                    key={ev.key}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-xs transition hover:border-indigo-200"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={[
                        "flex-shrink-0 rounded-full px-2 py-0.5 font-semibold",
                        ev.type === "Deposit"  ? "bg-emerald-100 text-emerald-700" :
                        ev.type === "Withdraw" ? "bg-rose-100 text-rose-600" :
                                                 "bg-indigo-100 text-indigo-600",
                      ].join(" ")}>
                        {ev.type}
                      </span>
                      <span className="font-mono text-slate-500 truncate">{shortAddr(ev.address)}</span>
                      {ev.ts > 0 && (
                        <span className="text-slate-300">{new Date(ev.ts).toLocaleTimeString()}</span>
                      )}
                    </div>
                    <div className="flex-shrink-0 font-mono font-semibold text-gray-800 tabular-nums">
                      {fmt(ev.amount, 4)} AETF
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      <footer className="mt-6 border-t border-slate-100 py-8 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} ArcIndex Protocol · Multi-asset index vaults · Built with Arc Network by Circle
      </footer>
    </div>
  );
}
