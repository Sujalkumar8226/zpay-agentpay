import React, { useState, useEffect } from "react";
import axios from "axios";
import { 
  Play, Cpu, ShieldCheck, XCircle, Clock, AlertTriangle, Shield, CheckCircle, RefreshCw, Info, Lock
} from "lucide-react";

interface Agent {
  id: number;
  name: string;
  zpay_id: string;
  public_key: string;
}

interface AgentSimulatorProps {
  token: string;
  agents: Agent[];
  refreshGlobalData: () => void;
}

export default function AgentSimulator({ token, agents, refreshGlobalData }: AgentSimulatorProps) {
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [scenarioName, setScenarioName] = useState<string | null>(null);

  // Payload inputs
  const [merchant, setMerchant] = useState("weather-api");
  const [amount, setAmount] = useState(2.50);
  const [purpose, setPurpose] = useState("Weather data fetch");

  // Output trace data
  const [decision, setDecision] = useState<"APPROVED" | "BLOCKED" | "PENDING_APPROVAL" | null>(null);
  const [reasons, setReasons] = useState<string[]>([]);
  const [riskScore, setRiskScore] = useState<number>(0);
  const [riskFactors, setRiskFactors] = useState<string[]>([]);
  const [policyChecks, setPolicyChecks] = useState<any>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<number | null>(null);

  // Select first agent by default
  useEffect(() => {
    if (agents.length > 0 && selectedAgentId === null) {
      setSelectedAgentId(agents[0].id);
    }
  }, [agents, selectedAgentId]);

  const activeAgent = agents.find((a) => a.id === selectedAgentId);

  // Scenario quick triggers
  const runScenario = async (type: string) => {
    if (!selectedAgentId) {
      alert("Please select or create an agent first.");
      return;
    }
    
    setScenarioName(type);
    setLoading(true);
    setDecision(null);
    setTxHash(null);
    setReasons([]);

    let mockMerchant = "weather-api";
    let mockAmount = 2.50;
    let mockPurpose = "Weather data query";
    
    if (type === "SAFE") {
      mockMerchant = "research-api";
      mockAmount = 0.50;
      mockPurpose = "Query daily temperature logs";
    } else if (type === "OVER_LIMIT") {
      mockMerchant = "research-api";
      mockAmount = 25.00; // default agent limit is 5.0
      mockPurpose = "Query bulk flight telemetry data";
    } else if (type === "UNKNOWN_MERCHANT") {
      mockMerchant = "unknown-api";
      mockAmount = 0.50;
      mockPurpose = "Query flight logistics";
    } else if (type === "DAILY_BUDGET") {
      mockMerchant = "research-api";
      mockAmount = 0.90; // daily budget is 10.0
      mockPurpose = "Fetch full historical datasets";
    } else if (type === "HIGH_VELOCITY") {
      mockMerchant = "research-api";
      mockAmount = 0.50;
      mockPurpose = "Rapid stream updates";
    } else if (type === "HIGH_RISK") {
      mockMerchant = "research-api";
      mockAmount = 0.90; // High risk (>80% of 1.0 limit = 0.8)
      mockPurpose = "Consolidated market prediction calculation";
    }

    setMerchant(mockMerchant);
    setAmount(mockAmount);
    setPurpose(mockPurpose);

    const headers = { Authorization: `Bearer ${token}` };
    const payload = {
      agent_id: selectedAgentId,
      merchant: mockMerchant,
      amount: mockAmount,
      currency: "USDC",
      service: mockMerchant,
      purpose: mockPurpose,
      idempotency_key: `sim_${Date.now()}`
    };

    try {
      // For HIGH VELOCITY, we send 5 requests in parallel to trigger velocity limit check!
      if (type === "HIGH_VELOCITY") {
        // Send first 5 requests in background to exhaust rate
        for (let i = 0; i < 5; i++) {
          axios.post("http://localhost:8000/api/payment-request", {
            ...payload,
            idempotency_key: `vel_${i}_${Date.now()}`,
            amount: 0.1,
            merchant: "research-api",
            service: "research-api"
          }, { headers }).catch(() => null);
        }
        // Wait a split second
        await new Promise((r) => setTimeout(r, 400));
      }

      if (type === "DAILY_BUDGET") {
        // Send 11 sequential requests in background to exhaust daily budget of 10.0
        for (let i = 0; i < 11; i++) {
          await axios.post("http://localhost:8000/api/payment-request", {
            agent_id: selectedAgentId,
            merchant: "research-api",
            amount: 0.90,
            currency: "USDC",
            service: "research-api",
            purpose: `Seeded daily budget tx ${i}`,
            idempotency_key: `budget_${i}_${Date.now()}`
          }, { headers }).catch(() => null);
        }
        // Wait a split second
        await new Promise((r) => setTimeout(r, 600));
      }

      if (type === "HIGH_RISK") {
        // Send 3 requests in background to add +25 velocity risk
        for (let i = 0; i < 3; i++) {
          await axios.post("http://localhost:8000/api/payment-request", {
            agent_id: selectedAgentId,
            merchant: "research-api",
            amount: 0.20,
            currency: "USDC",
            service: "research-api",
            purpose: `Risk velocity seed ${i}`,
            idempotency_key: `risk_seed_${i}_${Date.now()}`
          }, { headers }).catch(() => null);
        }
        // Wait a split second
        await new Promise((r) => setTimeout(r, 500));
      }

      const res = await axios.post("http://localhost:8000/api/payment-request", payload, { headers });
      const data = res.data;
      
      setDecision(data.decision);
      setReasons(data.reasons);
      setRiskScore(data.risk_score);
      setRiskFactors(data.risk_factors);
      setPolicyChecks(data.policy_checks);
      setTxHash(data.tx_hash);
      setPaymentId(data.payment_id);
      
      refreshGlobalData();
    } catch (e: any) {
      alert("Error executing payment request: " + (e.response?.data?.detail || e.message));
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!paymentId) return;
    try {
      setLoading(true);
      const res = await axios.post(`http://localhost:8000/api/payments/${paymentId}/approve`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setDecision("APPROVED");
        setReasons(["Payment manually approved by administrator."]);
        // Settle transaction in simulator UI
        setTxHash(`sim_tx_approved_${Math.random().toString(36).substring(2, 10)}`);
        refreshGlobalData();
      }
    } catch (e: any) {
      alert("Approval error: " + (e.response?.data?.detail || e.message));
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!paymentId) return;
    try {
      setLoading(true);
      const res = await axios.post(`http://localhost:8000/api/payments/${paymentId}/reject`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setDecision("BLOCKED");
        setReasons(["Payment request rejected by administrator."]);
        setRiskScore(100);
        setRiskFactors(["Manual Administrator Rejection"]);
        setTxHash(null);
        refreshGlobalData();
      }
    } catch (e: any) {
      alert("Rejection error: " + (e.response?.data?.detail || e.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 text-left">
      {/* Selector Area */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-900 pb-5">
        <div>
          <h1 className="text-xl font-bold flex items-center space-x-2 text-indigo-400">
            <Shield className="h-5 w-5" />
            <span>Agent Sentinel Simulator</span>
          </h1>
          <p className="text-xs text-slate-400">Trigger test transactions to verify policy enforcement and firewall controls.</p>
        </div>

        {agents.length > 0 && (
          <select
            value={selectedAgentId || ""}
            onChange={(e) => setSelectedAgentId(Number(e.target.value))}
            className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full sm:w-auto"
          >
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.zpay_id})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Simulator Control Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Hand side: Predefined triggers */}
        <div className="glass-panel p-6 rounded-2xl border-slate-800 space-y-6 h-fit">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-400">Simulation Scenarios</h3>
            <p className="text-[11px] text-slate-400 mt-1">Select a predefined condition to dispatch a payment request.</p>
          </div>

          <div className="space-y-2.5">
            <button
              onClick={() => runScenario("SAFE")}
              disabled={loading}
              className="w-full flex items-center justify-between p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-emerald-500/30 text-xs font-semibold text-slate-200 hover:text-emerald-400 transition-all cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>1. SAFE TRANSACTION</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">0.50 USDC</span>
            </button>

            <button
              onClick={() => runScenario("OVER_LIMIT")}
              disabled={loading}
              className="w-full flex items-center justify-between p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-rose-500/30 text-xs font-semibold text-slate-200 hover:text-rose-400 transition-all cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-rose-500" />
                <span>2. OVER LIMIT</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">25.00 USDC</span>
            </button>

            <button
              onClick={() => runScenario("UNKNOWN_MERCHANT")}
              disabled={loading}
              className="w-full flex items-center justify-between p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-rose-500/30 text-xs font-semibold text-slate-200 hover:text-rose-400 transition-all cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <span>3. UNKNOWN MERCHANT</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">0.50 USDC</span>
            </button>

            <button
              onClick={() => runScenario("DAILY_BUDGET")}
              disabled={loading}
              className="w-full flex items-center justify-between p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-rose-500/30 text-xs font-semibold text-slate-200 hover:text-rose-400 transition-all cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-red-650" />
                <span>4. DAILY BUDGET EXCEEDED</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">0.90 USDC</span>
            </button>

            <button
              onClick={() => runScenario("HIGH_VELOCITY")}
              disabled={loading}
              className="w-full flex items-center justify-between p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-rose-500/30 text-xs font-semibold text-slate-200 hover:text-rose-400 transition-all cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-orange-500" />
                <span>5. HIGH VELOCITY</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">0.50 USDC</span>
            </button>

            <button
              onClick={() => runScenario("HIGH_RISK")}
              disabled={loading}
              className="w-full flex items-center justify-between p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/30 text-xs font-semibold text-slate-200 hover:text-amber-400 transition-all cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                <span>6. PENDING APPROVAL (HIGH RISK)</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">0.90 USDC</span>
            </button>
          </div>
        </div>

        {/* Middle + Right side: Trace Visualization */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Main Visual Tracer Board */}
          <div className="glass-panel p-6 rounded-2xl border-indigo-500/10 bg-[#060A13] space-y-6 relative overflow-hidden">
            <div className="absolute top-[-10%] right-[-10%] w-[30%] h-[30%] rounded-full bg-indigo-500/5 blur-3xl pointer-events-none" />
            
            <div className="flex justify-between items-center border-b border-slate-900 pb-3">
              <div>
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Active Firewall Pipeline</span>
                <h3 className="text-sm font-bold text-slate-200 mt-0.5">
                  {loading ? "Evaluating live transaction parameters..." : (decision ? `Scenario: ${scenarioName}` : "Idle: Select a Scenario to Start")}
                </h3>
              </div>
              {loading && <RefreshCw className="h-4.5 w-4.5 text-indigo-500 animate-spin" />}
            </div>

            {/* Pipeline Step Badges */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center space-y-1.5 transition-all duration-300
                ${decision ? "bg-indigo-950/20 border-indigo-500/30 text-indigo-300" : "bg-slate-900 border-slate-850 text-slate-500"}
              `}>
                <Cpu className="h-5 w-5" />
                <span className="text-[10px] font-bold">1. Agent Profile</span>
                <p className="text-[9px] text-slate-500 leading-tight">
                  {decision ? (activeAgent?.name || "AI Agent") : "Waiting..."}
                </p>
              </div>

              <div className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center space-y-1.5 transition-all duration-300
                ${decision ? "bg-indigo-950/20 border-indigo-500/30 text-indigo-300" : "bg-slate-900 border-slate-850 text-slate-500"}
              `}>
                <Clock className="h-5 w-5" />
                <span className="text-[10px] font-bold">2. Spend request</span>
                <p className="text-[9px] text-slate-500 leading-tight">
                  {decision ? `${amount.toFixed(2)} USDC to ${merchant}` : "Waiting..."}
                </p>
              </div>

              <div className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center space-y-1.5 transition-all duration-300
                ${decision ? (decision === "BLOCKED" ? "bg-rose-950/20 border-rose-500/30 text-rose-400" : "bg-emerald-950/20 border-emerald-500/30 text-emerald-400") : "bg-slate-900 border-slate-850 text-slate-500"}
              `}>
                <Shield className="h-5 w-5" />
                <span className="text-[10px] font-bold">3. Sentinel Checks</span>
                <p className="text-[9px] text-slate-500 leading-tight">
                  {decision ? (decision === "BLOCKED" ? "Blocked" : (decision === "PENDING_APPROVAL" ? "Manual Hold" : "Approved")) : "Waiting..."}
                </p>
              </div>

              <div className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center space-y-1.5 transition-all duration-300
                ${txHash ? "bg-emerald-950/25 border-emerald-500/40 text-emerald-400 font-bold" : "bg-slate-900 border-slate-850 text-slate-500"}
              `}>
                <Lock className="h-5 w-5" />
                <span className="text-[10px] font-bold">4. Sandbox Payment</span>
                <p className="text-[9px] text-slate-500 leading-tight font-mono">
                  {txHash ? txHash.substring(0, 15) + "..." : "No Settlement"}
                </p>
              </div>
            </div>

            {/* Evaluation Results Card */}
            {decision && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-900 text-xs">
                
                {/* Policy evaluation checklist */}
                <div className="glass-panel p-4 rounded-xl border-slate-800 space-y-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Policy Evaluation checklist</span>
                  
                  <div className="space-y-2 text-[11px]">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Agent Authenticated & Active</span>
                      {policyChecks?.agent_active ? <CheckCircle className="h-4 w-4 text-emerald-400" /> : <XCircle className="h-4 w-4 text-rose-500" />}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Transaction Limit Constraint</span>
                      {policyChecks?.transaction_limit ? <CheckCircle className="h-4 w-4 text-emerald-400" /> : <XCircle className="h-4 w-4 text-rose-500" />}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Daily Spending Budget</span>
                      {policyChecks?.daily_budget ? <CheckCircle className="h-4 w-4 text-emerald-400" /> : <XCircle className="h-4 w-4 text-rose-500" />}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Merchant Allowlist</span>
                      {policyChecks?.merchant_allowed ? <CheckCircle className="h-4 w-4 text-emerald-400" /> : <XCircle className="h-4 w-4 text-rose-500" />}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Transaction Velocity</span>
                      {policyChecks?.velocity_normal ? <CheckCircle className="h-4 w-4 text-emerald-400" /> : <XCircle className="h-4 w-4 text-rose-500" />}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Risk Threshold Bounds</span>
                      {policyChecks?.risk_normal ? <CheckCircle className="h-4 w-4 text-emerald-400" /> : <AlertTriangle className="h-4 w-4 text-amber-400" />}
                    </div>
                  </div>
                </div>

                {/* Risk score details */}
                <div className="glass-panel p-4 rounded-xl border-slate-800 flex flex-col justify-between">
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Risk Assessment details</span>
                    
                    <div className="flex items-center space-x-3">
                      <div className={`text-2xl font-black ${
                        riskScore >= 80 ? "text-rose-500" : (riskScore >= 50 ? "text-amber-400" : "text-emerald-400")
                      }`}>
                        {riskScore}/100
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase
                        ${riskScore >= 80 ? "bg-rose-500/10 border-rose-500/20 text-rose-400" : ""}
                        ${riskScore >= 50 && riskScore < 80 ? "bg-amber-500/10 border-amber-500/20 text-amber-400" : ""}
                        ${riskScore < 50 ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : ""}
                      `}>
                        {riskScore >= 80 ? "High Risk" : (riskScore >= 50 ? "Medium Risk" : "Low Risk")}
                      </span>
                    </div>

                    <div className="space-y-1.5 pt-2 max-h-[90px] overflow-y-auto pr-1">
                      {riskFactors.length === 0 ? (
                        <div className="text-[10px] italic text-slate-500">No high-risk factors detected.</div>
                      ) : (
                        riskFactors.map((factor, idx) => (
                          <div key={idx} className="text-[10px] font-mono text-slate-400 flex items-center space-x-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                            <span>{factor}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Decision message */}
                  <div className="pt-4 border-t border-slate-900 mt-2">
                    <span className="text-[9px] uppercase font-bold text-slate-500 block">Firewall Decision reason</span>
                    <p className="text-[11px] text-slate-300 font-semibold leading-normal mt-1">{reasons[0] || "Evaluation complete."}</p>
                  </div>

                </div>

              </div>
            )}

            {/* Decision Status Bar */}
            {decision && (
              <div className="space-y-4">
                <div className={`p-4 rounded-xl border flex items-center justify-between text-xs
                  ${decision === "APPROVED" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : ""}
                  ${decision === "BLOCKED" ? "bg-rose-500/10 border-rose-500/20 text-rose-400" : ""}
                  ${decision === "PENDING_APPROVAL" ? "bg-amber-500/10 border-amber-500/25 text-amber-400 animate-pulse" : ""}
                `}>
                  <div className="flex items-center space-x-2">
                    {decision === "APPROVED" && <CheckCircle className="h-5 w-5" />}
                    {decision === "BLOCKED" && <XCircle className="h-5 w-5" />}
                    {decision === "PENDING_APPROVAL" && <AlertTriangle className="h-5 w-5" />}
                    <div>
                      <span className="font-bold block uppercase tracking-wider text-[10px]">Decision: {decision.replace("_", " ")}</span>
                      <span className="text-[10px] text-slate-400 mt-0.5">
                        {decision === "APPROVED" && "Sandbox payment executed successfully."}
                        {decision === "BLOCKED" && "Payment request stopped at the firewall gateway."}
                        {decision === "PENDING_APPROVAL" && "Exceeds risk threshold parameters. Manual auth required."}
                      </span>
                    </div>
                  </div>

                  {decision === "PENDING_APPROVAL" && (
                    <div className="flex space-x-2">
                      <button
                        onClick={handleApprove}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg cursor-pointer transition-all"
                      >
                        Approve
                      </button>
                      <button
                        onClick={handleReject}
                        className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg cursor-pointer transition-all"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>

                {/* Sandbox settlement confirmation */}
                {txHash && (
                  <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-xs text-left space-y-2">
                    <div className="flex items-center space-x-2 text-emerald-400">
                      <Lock className="h-4.5 w-4.5" />
                      <span className="font-bold">Sandbox x402 Simulated payment settled</span>
                    </div>
                    <div className="text-[11px] text-slate-400 space-y-1.5 font-mono">
                      <div>Network: <span className="text-slate-200">stellar:testnet (Simulated)</span></div>
                      <div>Amount: <span className="text-slate-200">{amount.toFixed(2)} USDC</span></div>
                      <div>Destination: <span className="text-slate-200">{activeAgent?.public_key} (Custodial)</span></div>
                      <div className="break-all">Tx Hash: <span className="text-slate-200">{txHash}</span></div>
                    </div>
                  </div>
                )}

              </div>
            )}

          </div>

        </div>

      </div>

    </div>
  );
}
