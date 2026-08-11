import React, { useState } from "react";
import { CreditCard, ArrowRight, ShieldCheck, RefreshCw, Send, CheckCircle } from "lucide-react";
import axios from "axios";
import { API_BASE_URL } from "../config";

interface UpiBridgeProps {
  token: string;
  refreshData: () => void;
}

export default function UpiBridge({ token, refreshData }: UpiBridgeProps) {
  const [merchantName, setMerchantName] = useState("Delhi Airport Duty Free");
  const [upiId, setUpiId] = useState("airport@okaxis");
  const [amountInr, setAmountInr] = useState("2400");
  const [loading, setLoading] = useState(false);

  // Active checkout state
  const [checkoutData, setCheckoutData] = useState<{
    payment_id: number;
    crypto_needed: number;
    qr_code_url: string;
    upi_uri: string;
    status: string;
  } | null>(null);

  const [settling, setSettling] = useState(false);
  const [settledTxHash, setSettledTxHash] = useState<string | null>(null);

  const handleCreateCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!merchantName || !upiId || !amountInr) return;

    setLoading(true);
    setCheckoutData(null);
    setSettledTxHash(null);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/upi/simulate?upi_id=${encodeURIComponent(upiId)}&amount_inr=${amountInr}&merchant_name=${encodeURIComponent(merchantName)}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        setCheckoutData({
          payment_id: res.data.payment_id,
          crypto_needed: res.data.crypto_needed,
          qr_code_url: res.data.qr_code_url,
          upi_uri: res.data.upi_uri,
          status: "PENDING"
        });
      }
    } catch (e: any) {
      alert("Checkout creation failed: " + (e.response?.data?.detail || e.message));
    } finally {
      setLoading(false);
    }
  };

  const handleSettleCheckout = async () => {
    if (!checkoutData) return;
    
    setSettling(true);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/upi/${checkoutData.payment_id}/settle`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        setCheckoutData((prev) => prev ? { ...prev, status: "COMPLETED" } : null);
        setSettledTxHash(res.data.tx_hash);
        refreshData();
        alert("Simulated UPI payment settled successfully via Stellar!");
      }
    } catch (e: any) {
      alert("Settlement failed: " + (e.response?.data?.detail || e.message));
    } finally {
      setSettling(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-left">
      {/* Simulation Form Column */}
      <div className="glass-panel p-8 rounded-2xl border-slate-800 space-y-6">
        <div>
          <div className="inline-flex items-center space-x-1.5 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full text-[10px] font-bold text-indigo-400 uppercase mb-3">
            <span>Simulated Bridge</span>
          </div>
          <h2 className="text-lg font-bold">UPI / INR Settlement Gateway</h2>
          <p className="text-xs text-slate-400">
            Simulate conversion of Stellar crypto into INR fiat for instant settlement at offline merchants via UPI QR codes.
          </p>
        </div>

        <form onSubmit={handleCreateCheckout} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">Merchant Name</label>
            <input
              type="text"
              required
              value={merchantName}
              onChange={(e) => setMerchantName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm focus:outline-none focus:border-indigo-500 text-white"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Merchant UPI ID</label>
              <input
                type="text"
                required
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm focus:outline-none focus:border-indigo-500 text-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Amount (INR)</label>
              <input
                type="number"
                required
                value={amountInr}
                onChange={(e) => setAmountInr(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm focus:outline-none focus:border-indigo-500 text-white"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white rounded-lg font-bold text-xs cursor-pointer disabled:cursor-not-allowed transition-all shadow-md shadow-indigo-500/10 flex items-center space-x-1"
          >
            <span>{loading ? "Generating checkout invoice..." : "Generate checkout invoice"}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </form>
      </div>

      {/* Interactive Checkout QR Column */}
      <div className="glass-panel p-8 rounded-2xl border-slate-800 flex flex-col justify-center items-center text-center space-y-6 relative overflow-hidden">
        {checkoutData ? (
          <div className="space-y-6 w-full flex flex-col items-center">
            {/* Settle Status Indicator */}
            {checkoutData.status === "COMPLETED" ? (
              <div className="flex flex-col items-center space-y-2 text-emerald-400">
                <CheckCircle className="h-12 w-12" />
                <h4 className="font-extrabold text-base">Invoice Settled successfully</h4>
                {settledTxHash && (
                  <span className="font-mono text-[9px] text-slate-500 bg-slate-950 p-2 rounded border border-slate-900 break-all select-all max-w-xs mt-1">
                    Tx: {settledTxHash}
                  </span>
                )}
              </div>
            ) : (
              <>
                <div>
                  <h3 className="text-sm font-bold text-slate-400">Scan QR Code to Pay</h3>
                  <div className="text-2xl font-black text-white mt-1">₹{Number(amountInr).toLocaleString()} INR</div>
                </div>

                {/* QR Image */}
                <div className="p-3 bg-white rounded-xl border border-slate-800 glow-cyan">
                  <img
                    src={checkoutData.qr_code_url}
                    alt="UPI Payment QR Code"
                    className="w-48 h-48 select-none"
                  />
                </div>

                <div className="space-y-1.5 text-xs text-slate-400">
                  <div className="flex justify-between items-center w-64 border-b border-slate-900 pb-1.5">
                    <span>Stellar Cost:</span>
                    <span className="font-bold text-slate-200">{checkoutData.crypto_needed.toFixed(3)} XLM</span>
                  </div>
                  <div className="flex justify-between items-center w-64 pt-1.5">
                    <span>Conversion Rate:</span>
                    <span className="text-slate-200 font-medium">1 XLM = 22.72 INR</span>
                  </div>
                </div>

                <button
                  onClick={handleSettleCheckout}
                  disabled={settling}
                  className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 text-white rounded-xl font-bold text-xs cursor-pointer disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-cyan-500/10 flex items-center space-x-1.5"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${settling ? "animate-spin" : ""}`} />
                  <span>{settling ? "Settling transaction on Stellar..." : "Confirm conversion & settle UPI"}</span>
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="text-slate-600 py-20 flex flex-col items-center justify-center space-y-2.5">
            <CreditCard className="h-10 w-10 text-slate-700" />
            <span className="text-xs italic">Generate an invoice on the left to activate simulated checkout QR code.</span>
          </div>
        )}
      </div>
    </div>
  );
}
