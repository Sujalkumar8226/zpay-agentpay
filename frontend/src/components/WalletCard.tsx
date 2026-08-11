import React, { useState } from "react";
import { Wallet, Send, ArrowDownLeft, ArrowUpRight, Copy, Check, ShieldCheck, Key } from "lucide-react";
import axios from "axios";
import { API_BASE_URL } from "../config";

interface Transaction {
  tx_hash: string;
  amount: number;
  asset: string;
  fee: number;
  sender: string;
  receiver: string;
  status: string;
  memo: string;
  created_at: string;
}

interface WalletCardProps {
  token: string;
  walletData: {
    id: number;
    public_key: string;
    zpay_id: string;
    label: string;
    balances: Record<string, number>;
    transactions: Transaction[];
  };
  refreshData: () => void;
}

export default function WalletCard({ token, walletData, refreshData }: WalletCardProps) {
  const [copied, setCopied] = useState(false);
  
  // Transfer Form State
  const [recipientId, setRecipientId] = useState("");
  const [amount, setAmount] = useState("");
  const [asset, setAsset] = useState("XLM");
  const [pin, setPin] = useState("");
  const [transferring, setTransferring] = useState(false);

  const xlmBalance = walletData.balances?.XLM || 0.0;
  const usdcBalance = walletData.balances?.USDC || 0.0;

  const copyAddress = () => {
    navigator.clipboard.writeText(walletData.public_key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientId || !amount || !pin) return;
    
    setTransferring(true);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/wallet/send?to_zpay_id=${encodeURIComponent(recipientId)}&amount=${amount}&asset=${asset}&pin=${pin}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        setRecipientId("");
        setAmount("");
        setPin("");
        alert(`Successfully transferred ${amount} ${asset} to ${recipientId}!`);
        refreshData();
      }
    } catch (e: any) {
      alert("Transfer failed: " + (e.response?.data?.detail || e.message));
    } finally {
      setTransferring(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Wallet details & form (2 cols) */}
      <div className="lg:col-span-2 space-y-6">
        {/* Stellar Card */}
        <div className="bg-gradient-to-br from-indigo-900/60 to-purple-900/40 border border-indigo-500/20 p-8 rounded-3xl text-left relative overflow-hidden glow-indigo">
          <div className="absolute top-[-20%] right-[-10%] w-[40%] h-[80%] rounded-full bg-indigo-500/10 blur-[80px]" />
          
          <div className="flex justify-between items-center mb-10">
            <div className="flex items-center space-x-2">
              <Wallet className="h-6 w-6 text-indigo-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Stellar Custodial Account</span>
            </div>
            <span className="text-xs bg-emerald-500/15 text-emerald-400 font-bold px-3 py-1 rounded-full border border-emerald-500/20 uppercase">
              Stellar Testnet
            </span>
          </div>

          <div className="space-y-6">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Universal Zpay ID</span>
              <div className="text-2xl font-black text-white mt-1">{walletData.zpay_id}</div>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Horizon Wallet Address</span>
              <div className="flex items-center space-x-2 mt-1">
                <span className="font-mono text-slate-300 text-xs bg-slate-950/60 p-2.5 rounded-lg border border-slate-900 break-all select-all flex-1">
                  {walletData.public_key}
                </span>
                <button
                  onClick={copyAddress}
                  className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-850 text-slate-400 transition cursor-pointer"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Asset balances */}
            <div className="grid grid-cols-2 gap-6 pt-4 border-t border-indigo-500/10">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">XLM Balance</span>
                <div className="text-xl font-bold text-white mt-0.5">{xlmBalance.toFixed(3)} XLM</div>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">USDC Balance (Simulated)</span>
                <div className="text-xl font-bold text-white mt-0.5">${usdcBalance.toFixed(2)} USDC</div>
              </div>
            </div>
          </div>
        </div>

        {/* Transfer Form */}
        <div className="glass-panel p-8 rounded-2xl border-slate-800 text-left space-y-6">
          <div>
            <h2 className="text-lg font-bold">Initiate Instant Payment</h2>
            <p className="text-xs text-slate-400">Transfer Stellar assets instantly to any user or agent Zpay ID.</p>
          </div>

          <form onSubmit={handleTransfer} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Recipient Zpay ID</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. sujal@Zp or researchbot@Zp"
                  value={recipientId}
                  onChange={(e) => setRecipientId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm focus:outline-none focus:border-indigo-500 text-white placeholder-slate-700"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Amount</label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    placeholder="0.0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-800 rounded-lg p-2.5 text-sm focus:outline-none focus:border-indigo-500 text-white placeholder-slate-700"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Asset</label>
                  <select
                    value={asset}
                    onChange={(e) => setAsset(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm focus:outline-none text-white cursor-pointer"
                  >
                    <option value="XLM">XLM</option>
                    <option value="USDC">USDC</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="max-w-xs">
              <label className="text-xs font-semibold text-slate-400 block mb-1">Transaction PIN</label>
              <div className="relative">
                <input
                  type="password"
                  maxLength={4}
                  required
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="w-full bg-slate-955 border border-slate-800 rounded-lg p-2.5 pl-9 text-sm focus:outline-none focus:border-indigo-500 text-white tracking-widest"
                />
                <Key className="h-4 w-4 text-slate-600 absolute left-3 top-3.5" />
              </div>
            </div>

            <button
              type="submit"
              disabled={transferring}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white rounded-lg font-bold text-xs cursor-pointer disabled:cursor-not-allowed transition-all shadow-md shadow-indigo-500/10 flex items-center space-x-1.5"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{transferring ? "Submitting to Horizon..." : "Submit Transaction"}</span>
            </button>
          </form>
        </div>
      </div>

      {/* Transactions Audit Ledger (1 col) */}
      <div className="glass-panel p-6 rounded-2xl border-slate-800 flex flex-col space-y-6 text-left">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-400">Horizon Audit Ledger</h3>
          <p className="text-xs text-slate-400">Verifiable transaction logs index from Stellar Horizon.</p>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 max-h-[460px] pr-2">
          {walletData.transactions?.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 py-20 space-y-2">
              <ShieldCheck className="h-8 w-8 text-slate-600" />
              <span className="text-xs">No ledger history found</span>
            </div>
          ) : (
            walletData.transactions?.map((tx, idx) => {
              const isOutgoing = tx.sender === walletData.public_key;
              return (
                <div key={idx} className="flex justify-between items-start py-3 border-b border-slate-900 last:border-0">
                  <div className="flex items-start space-x-2.5">
                    <div className={`p-2 rounded-xl border mt-0.5 ${
                      isOutgoing 
                        ? "bg-indigo-600/10 border-indigo-500/20 text-indigo-400" 
                        : "bg-emerald-600/10 border-emerald-500/20 text-emerald-400"
                    }`}>
                      {isOutgoing ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-200">{tx.memo || "Transfer"}</div>
                      <div className="text-[9px] font-mono text-slate-500 break-all max-w-[140px] mt-0.5">
                        Hash: {tx.tx_hash.slice(0, 16)}...
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-xs font-black ${isOutgoing ? "text-indigo-400" : "text-emerald-400"}`}>
                      {isOutgoing ? "-" : "+"}{tx.amount.toFixed(3)} {tx.asset}
                    </div>
                    <span className="text-[8px] text-slate-500">{tx.created_at.split("T")[0] || tx.created_at}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
