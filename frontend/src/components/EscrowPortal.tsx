import React, { useState } from "react";
import { ShieldCheck, Plus, Send, Gavel, Scale, Lock, RefreshCw, XCircle } from "lucide-react";
import axios from "axios";

interface Escrow {
  id: number;
  buyer: string;
  seller: string;
  amount: number;
  asset: string;
  status: string; // ACTIVE, RELEASED, REFUNDED, DISPUTED, RESOLVED
  resolution: string | null;
  details: string;
  created_at: string;
  disputes: Array<{
    reason: string;
    status: string;
    created_at: string;
  }>;
}

interface EscrowPortalProps {
  token: string;
  escrows: Escrow[];
  refreshData: () => void;
  userRole: string; // admin, user, etc.
}

export default function EscrowPortal({ token, escrows, refreshData, userRole }: EscrowPortalProps) {
  const [activeTab, setActiveTab] = useState<"escrow" | "create">("escrow");
  
  // Create Escrow Form State
  const [sellerId, setSellerId] = useState("");
  const [amount, setAmount] = useState("");
  const [details, setDetails] = useState("");
  const [depositing, setDepositing] = useState(false);

  // Dispute Form State
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeEscrowId, setDisputeEscrowId] = useState<number | null>(null);

  const handleCreateEscrow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sellerId || !amount || !details) return;

    setDepositing(true);
    try {
      const res = await axios.post(
        `http://localhost:8000/api/escrow?seller_zpay_id=${encodeURIComponent(sellerId)}&amount=${amount}&details=${encodeURIComponent(details)}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        setSellerId("");
        setAmount("");
        setDetails("");
        setActiveTab("escrow");
        alert(`Successfully deposited ${amount} XLM into Escrow Hold Wallet!`);
        refreshData();
      }
    } catch (e: any) {
      alert("Escrow deposit failed: " + (e.response?.data?.detail || e.message));
    } finally {
      setDepositing(false);
    }
  };

  const handleReleaseEscrow = async (escrowId: number) => {
    if (!confirm("Are you sure you want to release these funds to the seller?")) return;
    try {
      const res = await axios.post(
        `http://localhost:8000/api/escrow/${escrowId}/release`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        alert("Funds successfully released to seller!");
        refreshData();
      }
    } catch (e: any) {
      alert("Release failed: " + (e.response?.data?.detail || e.message));
    }
  };

  const handleRefundEscrow = async (escrowId: number) => {
    if (!confirm("Are you sure you want to refund these funds back to the buyer?")) return;
    try {
      const res = await axios.post(
        `http://localhost:8000/api/escrow/${escrowId}/refund`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        alert("Funds successfully refunded to buyer!");
        refreshData();
      }
    } catch (e: any) {
      alert("Refund failed: " + (e.response?.data?.detail || e.message));
    }
  };

  const handleDisputeEscrow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (disputeEscrowId === null || !disputeReason) return;
    try {
      const res = await axios.post(
        `http://localhost:8000/api/escrow/${disputeEscrowId}/dispute?reason=${encodeURIComponent(disputeReason)}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        alert("Escrow status changed to DISPUTED. Arbiter review has been initialized.");
        setDisputeEscrowId(null);
        setDisputeReason("");
        refreshData();
      }
    } catch (e: any) {
      alert("Dispute request failed: " + (e.response?.data?.detail || e.message));
    }
  };

  return (
    <div className="space-y-8">
      {/* Subnav Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-900 pb-5">
        <div className="flex items-center space-x-4">
          <div className="bg-indigo-600/10 text-indigo-400 p-3 rounded-xl border border-indigo-500/20">
            <Scale className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Smart Escrow</h1>
            <p className="text-xs text-slate-400">Lock funds for freelancers or agents with secure arbitrated dispute resolution.</p>
          </div>
        </div>

        <div className="flex space-x-1 bg-slate-900/50 p-1 rounded-xl border border-slate-900 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab("escrow")}
            className={`flex-1 sm:flex-none px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === "escrow" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Escrow hold list
          </button>
          <button
            onClick={() => setActiveTab("create")}
            className={`flex-1 sm:flex-none px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === "create" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Deposit in escrow
          </button>
        </div>
      </div>

      {activeTab === "create" ? (
        /* DEPOSIT FORM */
        <div className="max-w-xl glass-panel p-8 rounded-2xl border-slate-800 space-y-6 mx-auto">
          <h2 className="text-lg font-bold">Lock Funds in Escrow</h2>
          <form onSubmit={handleCreateEscrow} className="space-y-4 text-left">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Seller Zpay ID</label>
              <input
                type="text"
                required
                placeholder="e.g. merchant@Zp or freelancer@Zp"
                value={sellerId}
                onChange={(e) => setSellerId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm focus:outline-none focus:border-indigo-500 text-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Lock Amount (XLM)</label>
              <input
                type="number"
                step="0.1"
                required
                placeholder="0.0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-slate-955 border border-slate-800 rounded-lg p-2.5 text-sm focus:outline-none focus:border-indigo-500 text-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Contract / Delivery Details</label>
              <textarea
                required
                placeholder="Describe the deliverables required for release..."
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm focus:outline-none focus:border-indigo-500 text-white h-24 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={depositing}
              className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white rounded-lg font-bold text-xs cursor-pointer disabled:cursor-not-allowed transition-all shadow-md shadow-indigo-500/10 flex items-center justify-center space-x-1.5"
            >
              <Lock className="h-4 w-4" />
              <span>{depositing ? "Transferring to hold wallet..." : "Deposit to hold"}</span>
            </button>
          </form>
        </div>
      ) : (
        /* ESCROW LIST */
        <div className="space-y-6">
          {/* Dispute Input Modal Panel if active */}
          {disputeEscrowId !== null && (
            <div className="glass-panel p-6 rounded-2xl border-rose-500/20 bg-rose-500/5 max-w-xl mx-auto space-y-4">
              <div className="flex items-center space-x-2 text-rose-400">
                <Gavel className="h-5 w-5" />
                <span className="font-bold text-sm">Raise Escrow Dispute (Hold ID: {disputeEscrowId})</span>
              </div>
              <form onSubmit={handleDisputeEscrow} className="space-y-4 text-left">
                <textarea
                  required
                  placeholder="Provide reason for dispute to the arbiter..."
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs focus:outline-none focus:border-rose-500 text-white h-20"
                />
                <div className="flex space-x-2">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    Initialize Dispute
                  </button>
                  <button
                    type="button"
                    onClick={() => setDisputeEscrowId(null)}
                    className="px-4 py-2 bg-slate-900 border border-slate-850 hover:bg-slate-800 text-slate-400 text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {escrows.length === 0 ? (
              <div className="col-span-full text-center py-20 text-slate-500 italic">No escrows active or recorded.</div>
            ) : (
              escrows.map((escrow) => (
                <div key={escrow.id} className="glass-panel p-6 rounded-2xl border-slate-800 text-left flex flex-col justify-between space-y-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Hold ID: #{escrow.id}</span>
                        <h4 className="text-sm font-extrabold text-slate-200 mt-0.5">{escrow.details}</h4>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase border 
                        ${escrow.status === "ACTIVE" ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" : ""}
                        ${escrow.status === "RELEASED" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : ""}
                        ${escrow.status === "REFUNDED" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : ""}
                        ${escrow.status === "DISPUTED" ? "bg-rose-500/10 text-rose-400 border-rose-500/20" : ""}
                      `}>
                        {escrow.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-slate-500 block">Buyer</span>
                        <span className="font-semibold text-slate-300">{escrow.buyer}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Seller</span>
                        <span className="font-semibold text-slate-300">{escrow.seller}</span>
                      </div>
                    </div>

                    {escrow.status === "DISPUTED" && escrow.disputes.length > 0 && (
                      <div className="p-3 bg-rose-500/5 border border-rose-500/10 rounded-lg text-xs">
                        <span className="font-bold text-rose-400 block mb-1">Dispute Reason:</span>
                        <span className="text-slate-400 italic">"{escrow.disputes[0].reason}"</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-slate-900 flex justify-between items-center">
                    <span className="text-lg font-black text-indigo-400">{escrow.amount} {escrow.asset}</span>

                    {/* Action buttons */}
                    <div className="flex space-x-2">
                      {escrow.status === "ACTIVE" && (
                        <>
                          <button
                            onClick={() => handleReleaseEscrow(escrow.id)}
                            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold rounded-lg text-white cursor-pointer transition-all"
                            title="Release funds to Seller"
                          >
                            Release
                          </button>
                          <button
                            onClick={() => handleRefundEscrow(escrow.id)}
                            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-xs font-semibold rounded-lg text-slate-300 cursor-pointer border border-slate-800 transition-all"
                            title="Refund funds to Buyer"
                          >
                            Refund
                          </button>
                          <button
                            onClick={() => setDisputeEscrowId(escrow.id)}
                            className="px-3.5 py-1.5 bg-rose-600/10 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/20 text-xs font-semibold rounded-lg cursor-pointer transition-all"
                            title="Raise Dispute"
                          >
                            Dispute
                          </button>
                        </>
                      )}

                      {escrow.status === "DISPUTED" && userRole === "admin" && (
                        <>
                          <button
                            onClick={() => handleReleaseEscrow(escrow.id)}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold rounded-lg text-white cursor-pointer transition-all"
                            title="Resolve: Release to Seller"
                          >
                            Arbiter Release
                          </button>
                          <button
                            onClick={() => handleRefundEscrow(escrow.id)}
                            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-xs font-semibold rounded-lg text-white cursor-pointer transition-all"
                            title="Resolve: Refund to Buyer"
                          >
                            Arbiter Refund
                          </button>
                        </>
                      )}

                      {escrow.status === "DISPUTED" && userRole !== "admin" && (
                        <div className="flex items-center space-x-1 text-slate-500 text-xs italic">
                          <Scale className="h-4.5 w-4.5 text-slate-600" />
                          <span>Under Arbiter Review</span>
                        </div>
                      )}

                      {(escrow.status === "RELEASED" || escrow.status === "REFUNDED") && (
                        <div className="flex items-center space-x-1 text-emerald-400 text-xs font-semibold">
                          <ShieldCheck className="h-4.5 w-4.5" />
                          <span>Settled ✓</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
