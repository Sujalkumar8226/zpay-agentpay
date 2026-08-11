import React, { useState } from "react";
import { Plus, Users, DollarSign, Send, ShieldCheck, CheckCircle } from "lucide-react";
import axios from "axios";
import { API_BASE_URL } from "../config";

interface SplitMember {
  zpay_id: string;
  amount: number;
  status: string; // PENDING, PAID
}

interface Split {
  id: number;
  description: string;
  total_amount: number;
  creator: string;
  status: string; // PENDING, SETTLED
  user_amount: number;
  user_status: string;
  created_at: string;
  members: SplitMember[];
}

interface BillSplitterProps {
  token: string;
  splits: Split[];
  refreshData: () => void;
  allZpayIds: string[]; // For populating options if needed
}

export default function BillSplitter({ token, splits, refreshData, allZpayIds }: BillSplitterProps) {
  const [activeTab, setActiveTab] = useState<"splits" | "create">("splits");
  
  // Create Split Form State
  const [description, setDescription] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [memberList, setMemberList] = useState(""); // Comma separated IDs
  const [submitting, setSubmitting] = useState(false);

  // Pay Split State
  const [payingSplitId, setPayingSplitId] = useState<number | null>(null);

  const handleCreateSplit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !totalAmount || !memberList) return;

    setSubmitting(true);
    // Parse members
    const members = memberList.split(",").map((m) => m.trim()).filter((m) => m.length > 0);

    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/split?description=${encodeURIComponent(description)}&total_amount=${totalAmount}`,
        members,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        setDescription("");
        setTotalAmount("");
        setMemberList("");
        setActiveTab("splits");
        alert(`Bill split created! Shares have been assigned at ₹${res.data.amount_per_person.toFixed(2)} per member.`);
        refreshData();
      }
    } catch (e: any) {
      alert("Failed to create split: " + (e.response?.data?.detail || e.message));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePaySplit = async (splitId: number) => {
    setPayingSplitId(splitId);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/split/${splitId}/pay`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        alert("Split paid successfully!");
        refreshData();
      }
    } catch (e: any) {
      alert("Payment failed: " + (e.response?.data?.detail || e.message));
    } finally {
      setPayingSplitId(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Subnav Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-900 pb-5">
        <div className="flex items-center space-x-4">
          <div className="bg-indigo-600/10 text-indigo-400 p-3 rounded-xl border border-indigo-500/20">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Group Payments</h1>
            <p className="text-xs text-slate-400">Split dinner or service bills instantly. Settle directly with conversion on Stellar.</p>
          </div>
        </div>

        <div className="flex space-x-1 bg-slate-900/50 p-1 rounded-xl border border-slate-900 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab("splits")}
            className={`flex-1 sm:flex-none px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === "splits" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Bill splits
          </button>
          <button
            onClick={() => setActiveTab("create")}
            className={`flex-1 sm:flex-none px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === "create" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Create split
          </button>
        </div>
      </div>

      {activeTab === "create" ? (
        /* CREATE SPLIT FORM */
        <div className="max-w-xl glass-panel p-8 rounded-2xl border-slate-800 space-y-6 mx-auto">
          <h2 className="text-lg font-bold">Split Group Expense</h2>
          <form onSubmit={handleCreateSplit} className="space-y-4 text-left">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Description</label>
              <input
                type="text"
                required
                placeholder="e.g. Dinner at Cyber Hub"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm focus:outline-none focus:border-indigo-500 text-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Total Bill Amount (INR)</label>
              <input
                type="number"
                required
                placeholder="0"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                className="w-full bg-slate-955 border border-slate-800 rounded-lg p-2.5 text-sm focus:outline-none focus:border-indigo-500 text-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                Members Zpay IDs (Comma Separated)
              </label>
              <input
                type="text"
                required
                placeholder="e.g. rahul@Zp, priya@Zp, aman@Zp"
                value={memberList}
                onChange={(e) => setMemberList(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm focus:outline-none focus:border-indigo-500 text-white placeholder-slate-700"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white rounded-lg font-bold text-xs cursor-pointer disabled:cursor-not-allowed transition-all shadow-md shadow-indigo-500/10 flex items-center justify-center space-x-1.5"
            >
              <Plus className="h-4 w-4" />
              <span>{submitting ? "Creating Split..." : "Initialize Split"}</span>
            </button>
          </form>
        </div>
      ) : (
        /* LIST OF EXPENSES */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {splits.length === 0 ? (
            <div className="col-span-full text-center py-20 text-slate-500 italic">No bill splits active or recorded.</div>
          ) : (
            splits.map((split) => (
              <div key={split.id} className="glass-panel p-6 rounded-2xl border-slate-800 text-left flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-base font-extrabold text-slate-200">{split.description}</h4>
                      <span className="text-[10px] text-slate-500 block mt-0.5">Creator: {split.creator}</span>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase border 
                      ${split.status === "PENDING" ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" : ""}
                      ${split.status === "SETTLED" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : ""}
                    `}>
                      {split.status}
                    </span>
                  </div>

                  <div className="space-y-2 border-y border-slate-900 py-3.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Members checklist</span>
                    <div className="space-y-2.5 max-h-[120px] overflow-y-auto pr-1">
                      {split.members.map((m, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs">
                          <span className="text-slate-400 font-medium">{m.zpay_id}</span>
                          <div className="flex items-center space-x-2">
                            <span className="text-slate-500">₹{m.amount.toFixed(2)}</span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                              m.status === "PAID" ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-900 text-slate-600"
                            }`}>
                              {m.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <div>
                    <span className="text-[9px] text-slate-500 block">Your Share</span>
                    <span className="text-lg font-black text-indigo-400">₹{split.user_amount.toFixed(2)}</span>
                    <span className="text-[9px] text-slate-500 block">~(approx {(split.user_amount / 22.72).toFixed(3)} XLM)</span>
                  </div>

                  <div>
                    {split.user_status === "PENDING" ? (
                      <button
                        onClick={() => handlePaySplit(split.id)}
                        disabled={payingSplitId === split.id}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white text-xs font-semibold rounded-lg cursor-pointer transition-all shadow-md shadow-indigo-500/10 flex items-center space-x-1"
                      >
                        <Send className="h-3 w-3" />
                        <span>{payingSplitId === split.id ? "Settling..." : "Pay Split"}</span>
                      </button>
                    ) : (
                      <div className="flex items-center space-x-1 text-emerald-400 text-xs font-semibold">
                        <ShieldCheck className="h-4.5 w-4.5" />
                        <span>Paid ✓</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
