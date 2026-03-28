"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
} from "wagmi";
import { formatEther, formatUnits, parseEther, parseUnits } from "viem";
import {
  CONTRACT_ADDRESS,
  MOCK_TOKEN_ADDRESSES,
  erc20Abi,
  mockErc20Abi,
  vaultAbi,
} from "./vault-abi";
import { arcMainnet } from "./providers";
import { FaqDrawer } from "./components/FaqDrawer";

// ─── Asset config ─────────────────────────────────────────────────────────────
// Arc Testnet native gas token is USDC (18 dec). Mock ERC-20 tokens (tETH /
// tUSDT) are deployed via scripts/deployMocks.js and used for ERC-20 testing.
type AssetKey = "ETH" | "tETH" | "tUSDT";

const ASSETS: {
  key: AssetKey;
  label: string;
  sub: string;
  decimals: number;
  address: `0x${string}` | null;
  bg: string;
  ring: string;
  dotCls: string;
  icon: string;
  faucetAmount?: bigint;   // amount to mint via faucet (in wei)
  faucetLabel?: string;    // button label
}[] = [
  { key: "ETH",   label: "USDC",  sub: "Native",      decimals: 18, address: null,
    bg: "bg-indigo-50",  ring: "ring-indigo-400",  dotCls: "bg-indigo-500",  icon: "₵" },
  { key: "tETH",  label: "tETH",  sub: "Test ERC-20", decimals: 18, address: MOCK_TOKEN_ADDRESSES.tETH,
    bg: "bg-blue-50",    ring: "ring-blue-400",    dotCls: "bg-blue-500",    icon: "Ξ",
    faucetAmount: BigInt("10000000000000000000"),  faucetLabel: "Mint 10 tETH"  },
  { key: "tUSDT", label: "tUSDT", sub: "Test ERC-20", decimals: 18, address: MOCK_TOKEN_ADDRESSES.tUSDT,
    bg: "bg-teal-50",    ring: "ring-teal-400",    dotCls: "bg-teal-500",    icon: "₮",
    faucetAmount: BigInt("100000000000000000000"), faucetLabel: "Mint 100 tUSDT" },
];

// ─── Basket allocation ─────────────────────────────────────────────────────────
type AllocKey = "WETH" | "WBTC" | "SOL";
const BASKET_META: { key: AllocKey; label: string; sub: string; bar: string; dot: string }[] = [
  { key: "WETH", label: "WETH", sub: "Ethereum", bar: "bg-indigo-500", dot: "bg-indigo-500" },
  { key: "WBTC", label: "WBTC", sub: "Bitcoin",  bar: "bg-amber-400",  dot: "bg-amber-400"  },
  { key: "SOL",  label: "SOL",  sub: "Solana",   bar: "bg-violet-500", dot: "bg-violet-500" },
];
const ALLOC_KEYS = BASKET_META.map((b) => b.key) as AllocKey[];
const DEFAULT_ALLOC: Record<AllocKey, number> = { WETH: 50, WBTC: 30, SOL: 20 };

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function rebalance(
  cur: Record<AllocKey, number>,
  changed: AllocKey,
  raw: number
): Record<AllocKey, number> {
  const val = clamp(Math.round(raw), 0, 100);
  const others = ALLOC_KEYS.filter((k) => k !== changed);
  const rem = 100 - val;
  const otherSum = others.reduce((s, k) => s + cur[k], 0);
  let a = 0, b = 0;
  if (otherSum <= 0) { a = Math.floor(rem / 2); b = rem - a; }
  else { a = clamp(Math.round((rem * cur[others[0]]) / otherSum), 0, rem); b = rem - a; }
  const next: Record<AllocKey, number> = { ...cur, [changed]: val, [others[0]]: a, [others[1]]: b };
  const sum = ALLOC_KEYS.reduce((s, k) => s + next[k], 0);
  if (sum !== 100) next[others[1]] = clamp(next[others[1]] + (100 - sum), 0, 100);
  return next;
}

// ─── Shared logo ─────────────────────────────────────────────────────────────
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

  // Auto-prompt switch once per connection (with small debounce)
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
        <div className="flex items-center gap-2 text-sm text-amber-800 font-medium">
          <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          Wrong network — please switch to Arc Testnet (Chain ID {arcMainnet.id})
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

// ─── Feature item ─────────────────────────────────────────────────────────────
function Feature({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-base">
        {icon}
      </div>
      <div>
        <div className="text-sm font-semibold text-gray-900">{title}</div>
        <div className="mt-0.5 text-xs text-gray-500 leading-relaxed">{body}</div>
      </div>
    </div>
  );
}

// ─── Numeric allocation input ─────────────────────────────────────────────────
function AllocInput({
  value,
  onChange,
  dot,
}: {
  value: number;
  onChange: (v: number) => void;
  dot: string;
}) {
  const [localVal, setLocalVal] = useState(String(value));

  // Keep in sync with external value unless input is focused
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setLocalVal(String(value));
  }, [value, focused]);

  const commit = () => {
    const n = parseInt(localVal, 10);
    if (!isNaN(n)) onChange(clamp(n, 0, 100));
    setFocused(false);
  };

  return (
    <div className="relative flex items-center">
      <input
        type="number"
        min={0}
        max={100}
        value={localVal}
        onFocus={() => setFocused(true)}
        onChange={(e) => setLocalVal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); }}
        className={[
          "w-14 rounded-lg border px-2 py-1 text-center text-sm font-bold outline-none transition",
          "border-slate-200 bg-white text-gray-900 shadow-sm",
          "focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100",
          "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
        ].join(" ")}
      />
      <span className="ml-1 text-xs text-slate-400">%</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Page() {
  const { address, isConnected } = useAccount();

  const [amount, setAmount]           = useState("");
  const [asset, setAsset]             = useState<AssetKey>("ETH");
  const [alloc, setAlloc]             = useState<Record<AllocKey, number>>(DEFAULT_ALLOC);
  const [txHash, setTxHash]           = useState<`0x${string}` | null>(null);
  const [txError, setTxError]         = useState<string | null>(null);
  const [txSuccess, setTxSuccess]     = useState<string | null>(null);
  const [mintHash, setMintHash]       = useState<`0x${string}` | null>(null);
  const [mintMsg,  setMintMsg]        = useState<{ text: string; ok: boolean } | null>(null);

  // Track what type of tx is in-flight so the receipt handler doesn't rely on
  // potentially-stale `needsApprove` (which depends on an unrefetched allowance).
  const pendingTxType = useRef<"approve" | "deposit" | null>(null);

  const assetMeta  = ASSETS.find((a) => a.key === asset)!;
  const isStable   = asset !== "ETH";   // true when a mock ERC-20 is selected
  const allocSum   = ALLOC_KEYS.reduce((s, k) => s + alloc[k], 0);
  const allocValid = allocSum === 100;

  const parsedAmount = useMemo(() => {
    try {
      const n = parseFloat(amount.replace(",", "."));
      if (!isFinite(n) || n <= 0) return null;
      return asset === "ETH"
        ? parseEther(n.toFixed(18) as `${number}`)
        : parseUnits(n.toFixed(assetMeta.decimals), assetMeta.decimals);
    } catch { return null; }
  }, [amount, asset, assetMeta.decimals]);

  // LP balance
  const { data: lpBalance, refetch: refetchLp } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: vaultAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  // ERC-20 allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: assetMeta.address ?? "0x0000000000000000000000000000000000000000",
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, CONTRACT_ADDRESS] : undefined,
    query: { enabled: Boolean(address) && isStable },
  });

  const needsApprove = useMemo(() => {
    if (!isStable || !parsedAmount) return false;
    return (allowance ?? BigInt(0)) < parsedAmount;
  }, [isStable, parsedAmount, allowance]);

  // ── Wallet balances (for MAX button) ────────────────────────────────────
  const { data: ethBalance } = useBalance({
    address,
    query: { enabled: Boolean(address) && asset === "ETH" },
  });

  const { data: tokenBalance } = useReadContract({
    address: assetMeta.address ?? "0x0000000000000000000000000000000000000000",
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) && isStable },
  });

  const handleMax = useCallback(() => {
    if (!address) return;
    if (asset === "ETH" && ethBalance) {
      // Reserve 0.002 ETH for gas fees
      const GAS_RESERVE = parseEther("0.002");
      const max = ethBalance.value > GAS_RESERVE ? ethBalance.value - GAS_RESERVE : BigInt(0);
      setAmount(parseFloat(formatEther(max)).toFixed(6));
    } else if (isStable && tokenBalance !== undefined) {
      const bal = tokenBalance as bigint;
      setAmount(parseFloat(formatUnits(bal, assetMeta.decimals)).toFixed(assetMeta.decimals));
    }
  }, [address, asset, ethBalance, isStable, tokenBalance, assetMeta.decimals]);

  const { writeContractAsync, isPending } = useWriteContract();
  const receipt  = useWaitForTransactionReceipt({ hash: txHash ?? undefined });
  const isLoading = isPending || receipt.isLoading;

  // ── Faucet (mock ERC-20 mint) ────────────────────────────────────────────
  const { writeContractAsync: writeMint, isPending: isMinting } = useWriteContract();
  const mintReceipt = useWaitForTransactionReceipt({ hash: mintHash ?? undefined });
  const isMintLoading = isMinting || mintReceipt.isLoading;

  useEffect(() => {
    if (mintReceipt.isSuccess) {
      setMintMsg({ text: `${assetMeta.faucetLabel?.replace("Mint", "Minted")} to your wallet!`, ok: true });
      setMintHash(null);
    }
    if (mintReceipt.isError) setMintMsg({ text: "Mint failed.", ok: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mintReceipt.isSuccess, mintReceipt.isError]);

  const handleMint = async () => {
    if (!address || !assetMeta.address || !assetMeta.faucetAmount) return;
    setMintMsg(null);
    try {
      const hash = await writeMint({
        address: assetMeta.address,
        abi: mockErc20Abi,
        functionName: "mint",
        args: [assetMeta.faucetAmount],
        account: address,
        chain: undefined,
      } as Parameters<typeof writeMint>[0]);
      setMintHash(hash);
    } catch (e) {
      setMintMsg({ text: (e instanceof Error ? e.message : String(e)).split("(")[0].trim(), ok: false });
    }
  };

  useEffect(() => {
    if (receipt.isSuccess) {
      if (pendingTxType.current === "approve") {
        // Approve confirmed → refetch allowance, button will flip to "Deposit"
        setTxSuccess("Approval confirmed — now click Deposit.");
        refetchAllowance();
      } else {
        setTxSuccess("Deposit confirmed! AETF tokens minted to your wallet.");
        setAmount("");
        refetchLp();
      }
      pendingTxType.current = null;
    }
    if (receipt.isError) {
      setTxError("Transaction failed on-chain.");
      pendingTxType.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt.isSuccess, receipt.isError]);

  const canSubmit = isConnected && Boolean(parsedAmount) && !isLoading && allocValid;

  const ctaLabel = useMemo(() => {
    if (!isConnected)    return "Connect Wallet";
    if (isLoading)       return "Confirming…";
    if (!allocValid)     return `Allocation must equal 100% (now ${allocSum}%)`;
    if (!parsedAmount)   return "Enter an amount";
    if (isStable && needsApprove) return `Approve ${assetMeta.label}`;
    return `Deposit ${assetMeta.label}`;
  }, [isConnected, isLoading, allocValid, allocSum, parsedAmount, isStable, needsApprove, assetMeta.label]);

  const handleAction = async () => {
    setTxError(null); setTxSuccess(null); setTxHash(null);
    try {
      let hash: `0x${string}`;
      if (asset === "ETH") {
        pendingTxType.current = "deposit";
        hash = await writeContractAsync({
          address: CONTRACT_ADDRESS, abi: vaultAbi,
          functionName: "deposit", value: parsedAmount!,
          account: address, chain: undefined,
        } as Parameters<typeof writeContractAsync>[0]);
      } else if (needsApprove) {
        pendingTxType.current = "approve";
        hash = await writeContractAsync({
          address: assetMeta.address!, abi: erc20Abi,
          functionName: "approve", args: [CONTRACT_ADDRESS, parsedAmount!],
          account: address, chain: undefined,
        } as Parameters<typeof writeContractAsync>[0]);
      } else {
        pendingTxType.current = "deposit";
        hash = await writeContractAsync({
          address: CONTRACT_ADDRESS, abi: vaultAbi,
          functionName: "depositERC20", args: [assetMeta.address!, parsedAmount!],
          account: address, chain: undefined,
        } as Parameters<typeof writeContractAsync>[0]);
      }
      setTxHash(hash!);
    } catch (e) {
      pendingTxType.current = null;
      setTxError((e instanceof Error ? e.message : String(e)).split("(")[0].trim());
    }
  };

  const changeAsset = (k: AssetKey) => {
    setAsset(k);
    setAmount("");
    setTxError(null);
    setTxSuccess(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/50 to-white text-gray-900">
      {/* ── Navbar ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md shadow-indigo-200">
              <ArcLogo />
            </div>
            <div>
              <div className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-base font-bold text-transparent">
                ArcIndex
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400">Multi-asset vaults</span>
                <span className="rounded-full bg-indigo-100 px-1.5 py-px text-[9px] font-semibold text-indigo-600">
                  Built with Arc
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isConnected && lpBalance !== undefined && (
              <div className="hidden sm:flex items-center gap-1.5 rounded-xl bg-indigo-50 px-3 py-1.5 text-xs ring-1 ring-indigo-200">
                <span className="text-slate-400">LP:</span>
                <span className="font-mono font-semibold text-indigo-600">
                  {parseFloat(formatEther(lpBalance as bigint)).toFixed(4)} AETF
                </span>
              </div>
            )}
            <Link href="/swap"
              className="hidden sm:block rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:border-indigo-300 hover:text-indigo-600">
              Swap
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

      {/* ── Two-column hero ─────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-7xl px-6 py-12 lg:py-16">
        <div className="grid items-start gap-14 lg:grid-cols-[1fr_480px] xl:gap-20">

          {/* ── LEFT: hero ──────────────────────────────────────────────────── */}
          <div>
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-500" />
              Live on Arc Testnet · Powered by Circle
            </div>

            <h1 className="mt-5 text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-[54px] lg:leading-[1.08]">
              Index vaults,{" "}
              <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 bg-clip-text text-transparent">
                built on Arc.
              </span>
            </h1>

            <p className="mt-4 max-w-lg text-lg text-slate-500 leading-relaxed">
              Deposit USDC (Arc native) or testnet tokens. Set your basket
              allocation across WETH, WBTC &amp; SOL. Receive{" "}
              <span className="font-semibold text-indigo-600">AETF</span> LP
              tokens — redeemable any time, no lock-up.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              <Feature icon="⚡" title="Instant minting"  body="AETF minted 1:1 with net deposit in a single tx." />
              <Feature icon="🔓" title="Permissionless"   body="No KYC. Connect any EVM wallet and start immediately." />
              <Feature icon="💱" title="Multi-asset"       body="USDC (native), tETH or tUSDT — vault normalises to 18-dec AETF shares." />
              <Feature icon="🛡️" title="Auditable"        body="Open-source Solidity, ReentrancyGuard, 0.5% fee on-chain." />
            </div>

            <div className="mt-10 flex flex-wrap gap-8 divide-x divide-slate-200">
              {[
                { v: "0.5%",      l: "Protocol fee"  },
                { v: "3",         l: "Basket assets"  },
                { v: "5042002",   l: "Arc Chain ID"   },
              ].map((s) => (
                <div key={s.l} className="pl-8 first:pl-0">
                  <div className="text-2xl font-extrabold text-indigo-600">{s.v}</div>
                  <div className="mt-0.5 text-xs text-slate-400">{s.l}</div>
                </div>
              ))}
            </div>

            <div className="mt-10 flex flex-wrap gap-3">
              <Link href="/dashboard"
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-200 transition hover:bg-indigo-700 active:scale-95">
                Portfolio Dashboard →
              </Link>
              <Link href="/swap"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-indigo-300 hover:text-indigo-600 active:scale-95">
                Swap Tokens →
              </Link>
            </div>
          </div>

          {/* ── RIGHT: deposit card ──────────────────────────────────────────── */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl shadow-indigo-100/80 ring-1 ring-slate-100 lg:sticky lg:top-[76px]">
            {/* Card header */}
            <div className="mb-5 flex items-center justify-between">
              <div className="font-bold text-gray-900">Create vault position</div>
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 ring-1 ring-emerald-200">
                ● Live
              </span>
            </div>

            {/* Asset selector */}
            <div className="mb-5">
              <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
                Deposit asset
              </div>
              <div className="grid grid-cols-3 gap-2">
                {ASSETS.map((a) => (
                  <button
                    key={a.key}
                    onClick={() => changeAsset(a.key)}
                    className={[
                      "flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition select-none",
                      asset === a.key
                        ? `${a.bg} ${a.ring} ring-2 shadow-sm`
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    <span className={`grid h-7 w-7 place-items-center rounded-lg text-sm font-bold text-white ${a.dotCls}`}>
                      {a.icon}
                    </span>
                    <span className="text-xs font-bold text-gray-800">{a.label}</span>
                    <span className="text-[10px] text-slate-400">{a.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Amount */}
            <div className="mb-5">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                  Amount
                </div>
                {/* Wallet balance display */}
                {isConnected && (
                  <div className="text-[11px] text-slate-400">
                    {asset === "ETH" && ethBalance && (
                      <span>
                        Balance:{" "}
                        <span className="font-semibold text-slate-600">
                          {parseFloat(formatEther(ethBalance.value)).toFixed(4)}{" "}
                          {ethBalance.symbol}
                        </span>
                      </span>
                    )}
                    {isStable && tokenBalance !== undefined && (
                      <span>
                        Balance:{" "}
                        <span className="font-semibold text-slate-600">
                          {parseFloat(formatUnits(tokenBalance as bigint, assetMeta.decimals)).toFixed(4)} {assetMeta.label}
                        </span>
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 transition focus-within:border-indigo-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-100">
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="decimal"
                  placeholder="0.00"
                  className="min-w-0 flex-1 bg-transparent text-xl font-bold text-gray-900 outline-none placeholder:text-slate-300"
                />
                {/* MAX button */}
                {isConnected && (
                  <button
                    type="button"
                    onClick={handleMax}
                    className="flex-shrink-0 rounded-lg bg-indigo-50 px-2 py-1 text-[11px] font-bold text-indigo-600 ring-1 ring-indigo-200 transition hover:bg-indigo-100 active:scale-95"
                  >
                    MAX
                  </button>
                )}
                <span className="flex-shrink-0 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-slate-200">
                  {assetMeta.label}
                </span>
              </div>
              {isStable && isConnected && parsedAmount && (
                <div className="mt-1.5 flex items-center gap-2 text-[11px]">
                  {needsApprove ? (
                    <>
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-600 ring-1 ring-blue-200">Step 1</span>
                      <span className="text-slate-400">Approve {assetMeta.label}</span>
                      <span className="text-slate-300">→</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-400">Step 2</span>
                      <span className="text-slate-400">Deposit</span>
                    </>
                  ) : (
                    <>
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-600 ring-1 ring-emerald-200">✓ Approved</span>
                      <span className="text-slate-400">Ready to deposit</span>
                    </>
                  )}
                </div>
              )}
              {!isStable && (
                <p className="mt-1.5 text-[11px] text-slate-400">
                  0.5% protocol fee · AETF minted 1:1 with net USDC amount
                </p>
              )}

              {/* ── Faucet button (mock ERC-20 assets only) ─────────────────── */}
              {isStable && isConnected && assetMeta.faucetLabel && (
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleMint}
                    disabled={isMintLoading}
                    className={[
                      "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition",
                      isMintLoading
                        ? "cursor-not-allowed bg-slate-100 text-slate-400"
                        : "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-sm hover:brightness-110 active:scale-95",
                    ].join(" ")}
                  >
                    {isMintLoading && (
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    )}
                    {isMintLoading ? "Minting…" : `🪙 ${assetMeta.faucetLabel}`}
                  </button>
                  <span className="text-[10px] text-slate-400">Free testnet tokens</span>
                </div>
              )}
              {mintMsg && (
                <div className={`mt-1.5 rounded-xl px-3 py-1.5 text-xs ring-1 ${
                  mintMsg.ok
                    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                    : "bg-rose-50 text-rose-600 ring-rose-200"
                }`}>
                  {mintMsg.text}
                </div>
              )}
            </div>

            {/* Basket allocation */}
            <div className="mb-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                  Basket allocation
                </div>
                <span className={[
                  "rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums transition",
                  allocValid
                    ? "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200"
                    : "bg-rose-50 text-rose-500 ring-1 ring-rose-200",
                ].join(" ")}>
                  {allocSum}% / 100%
                </span>
              </div>

              <div className="space-y-4">
                {BASKET_META.map((t) => (
                  <div key={t.key}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${t.dot}`} />
                        <span className="text-sm font-semibold text-gray-800">{t.label}</span>
                        <span className="text-xs text-slate-400">{t.sub}</span>
                      </div>
                      <AllocInput
                        value={alloc[t.key]}
                        onChange={(v) => setAlloc((p) => rebalance(p, t.key, v))}
                        dot={t.dot}
                      />
                    </div>
                    <input
                      type="range" min={0} max={100}
                      value={alloc[t.key]}
                      onChange={(e) =>
                        setAlloc((p) => rebalance(p, t.key, Number(e.target.value)))
                      }
                      className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-indigo-500"
                    />
                  </div>
                ))}
              </div>

              {/* Distribution bar */}
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div className="flex h-full w-full">
                  {BASKET_META.map((t) => (
                    <div
                      key={t.key}
                      className={`h-full transition-all ${t.bar}`}
                      style={{ width: `${alloc[t.key]}%` }}
                    />
                  ))}
                </div>
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-slate-400">
                {BASKET_META.map((t) => (
                  <span key={t.key}>{t.label} {alloc[t.key]}%</span>
                ))}
              </div>

              {!allocValid && (
                <div className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600 ring-1 ring-rose-200">
                  Allocation must sum to exactly 100%. Current: {allocSum}%. Adjust the sliders or type exact values.
                </div>
              )}
            </div>

            {/* Reset */}
            <button
              onClick={() => setAlloc(DEFAULT_ALLOC)}
              className="mb-4 w-full rounded-xl border border-slate-200 py-2 text-xs font-medium text-slate-500 transition hover:border-indigo-300 hover:text-indigo-600"
            >
              Reset allocation (50 / 30 / 20)
            </button>

            {/* CTA */}
            <button
              onClick={handleAction}
              disabled={!canSubmit}
              className={[
                "w-full rounded-2xl px-5 py-4 text-sm font-bold tracking-wide transition",
                canSubmit
                  ? isStable && needsApprove
                    ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-indigo-200 hover:brightness-110 active:scale-[0.98]"
                    : "bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-200 hover:brightness-110 active:scale-[0.98]"
                  : "cursor-not-allowed bg-slate-100 text-slate-400",
              ].join(" ")}
            >
              <span className="inline-flex items-center justify-center gap-2">
                {isLoading && (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                )}
                {ctaLabel}
              </span>
            </button>

            {/* Feedback */}
            <div className="mt-3 space-y-2 text-xs">
              {txError && (
                <div className="rounded-xl bg-rose-50 px-3 py-2 text-rose-600 ring-1 ring-rose-200">
                  {txError}
                </div>
              )}
              {txSuccess && (
                <div className="rounded-xl bg-emerald-50 px-3 py-2 text-emerald-600 ring-1 ring-emerald-200">
                  {txSuccess}
                </div>
              )}
              {txHash && (
                <p className="break-all font-mono text-[10px] text-slate-400">Tx: {txHash}</p>
              )}
              {!isConnected && (
                <p className="text-center text-slate-400">Connect your wallet above to get started.</p>
              )}
            </div>

            <div className="mt-4 flex items-center justify-center gap-1.5 text-[10px] text-slate-300">
              ArcIndex Protocol · Testnet · Built with Arc
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-100 py-8 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} ArcIndex Protocol · Multi-asset index vaults on Arc Network by Circle
      </footer>

      <FaqDrawer />
    </div>
  );
}
