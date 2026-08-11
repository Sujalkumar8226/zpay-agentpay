import React, { useState, useEffect, useRef } from "react";
import { Cpu, Plus, Sparkles, Send, Play, ShieldAlert, CheckCircle, XCircle, ArrowRight, Settings } from "lucide-react";
import PaymentTrace from "./PaymentTrace";
import axios from "axios";
import { API_BASE_URL } from "../config";

interface Agent {
  id: number;
  name: string;
  purpose: string;
  status: string;
  zpay_id: string;
  public_key: string;
  policy: {
    daily_limit: number;
    transaction_limit: number;
    approval_threshold: number;
    allowed_categories: string[];
    blocked_categories: string[];
  };
}

interface Task {
  id: number;
  goal: string;
  status: string;
  result: string | null;
  created_at: string;
  tool_calls: Array<{
    service: string;
    cost: number;
    status: string;
    timestamp: string;
  }>;
}

interface AgentControlProps {
  token: string;
  agents: Agent[];
  refreshData: () => void;
  pendingApprovals: any[];
  onApprovePayment: (paymentId: number) => void;
  onRejectPayment: (paymentId: number) => void;
}

export default function AgentControl({
  token,
  agents,
  refreshData,
  pendingApprovals,
  onApprovePayment,
  onRejectPayment
}: AgentControlProps) {
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"run" | "policy" | "create">("run");

  // Create Agent State
  const [newName, setNewName] = useState("");
  const [newPurpose, setNewPurpose] = useState("");
  const [newDailyLimit, setNewDailyLimit] = useState(10.0);
  const [newTxLimit, setNewTxLimit] = useState(1.0);
  const [newApprovalThreshold, setNewApprovalThreshold] = useState(0.5);

  // Task execution State
  const [prompt, setPrompt] = useState("Research the cheapest flight options from Delhi to Dubai and summarize the best options.");
  const [runningTaskId, setRunningTaskId] = useState<number | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  // Select first agent by default
  useEffect(() => {
    if (agents.length > 0 && selectedAgentId === null) {
      setSelectedAgentId(agents[0].id);
    }
  }, [agents, selectedAgentId]);

  const activeAgent = agents.find((a) => a.id === selectedAgentId);

  // Poll active task logs
  useEffect(() => {
    let intervalId: any;
    if (runningTaskId && selectedAgentId) {
      intervalId = setInterval(async () => {
        try {
          const res = await axios.get(
            `${API_BASE_URL}/api/agents/${selectedAgentId}/tasks`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const tasks: Task[] = res.data;
          const currentTask = tasks.find((t) => t.id === runningTaskId);
          
          if (currentTask) {
            setActiveTask(currentTask);
            
            // Reconstruct logs from tool call states
            const logs: string[] = [`[AGENT] Initiated request: "${currentTask.goal}"`];
            
            currentTask.tool_calls.forEach((tc) => {
              if (tc.status === "REQUESTED") {
                logs.push(`[API] Discovered ${tc.service}. Cost: ${tc.cost} XLM. Checking policy...`);
              } else if (tc.status === "402_CHALLENGE") {
                logs.push(`[API] HTTP 402 Payment Required challenge received from ${tc.service}`);
              } else if (tc.status === "EXECUTED") {
                logs.push(`[LEDGER] Stellar payment confirmed. ${tc.service} unlocked resource.`);
              } else if (tc.status === "FAILED") {
                logs.push(`[POLICY] Transaction BLOCKED or FAILED for ${tc.service}. Daily budget check or risk limits reached.`);
              }
            });

            if (currentTask.status === "COMPLETED") {
              logs.push(`[AGENT] Task completed successfully. Results consolidated.`);
              setRunningTaskId(null);
              refreshData();
            } else if (currentTask.status === "FAILED") {
              logs.push(`[AGENT] Task execution failed or paused.`);
              setRunningTaskId(null);
              refreshData();
            }
            
            setConsoleLogs(logs);
          }
        } catch (e) {
          console.error("Error polling tasks", e);
        }
      }, 1500);
    }
    return () => clearInterval(intervalId);
  }, [runningTaskId, selectedAgentId, token, refreshData]);

  // Scroll console to bottom
  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [consoleLogs]);

  // Launch Task
  const handleRunTask = async () => {
    if (!selectedAgentId) return;
    setConsoleLogs([`[AGENT] Planning task: "${prompt}"...`]);
    setActiveTask(null);

    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/agents/${selectedAgentId}/tasks?goal=${encodeURIComponent(prompt)}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        setRunningTaskId(res.data.task_id);
      }
    } catch (e: any) {
      setConsoleLogs((prev) => [...prev, `[ERROR] Failed to run task: ${e.response?.data?.detail || e.message}`]);
    }
  };

  // Create Agent
  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/agents?name=${encodeURIComponent(newName)}&purpose=${encodeURIComponent(newPurpose)}&daily_limit=${newDailyLimit}&transaction_limit=${newTxLimit}&approval_threshold=${newApprovalThreshold}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        setNewName("");
        setNewPurpose("");
        setActiveTab("run");
        refreshData();
        setSelectedAgentId(res.data.agent_id);
      }
    } catch (e: any) {
      alert("Error creating agent: " + (e.response?.data?.detail || e.message));
    }
  };

  // Edit Policy
  const [editDailyLimit, setEditDailyLimit] = useState(10.0);
  const [editTxLimit, setEditTxLimit] = useState(1.0);
  const [editApprovalThreshold, setEditApprovalThreshold] = useState(0.5);

  useEffect(() => {
    if (activeAgent) {
      setEditDailyLimit(activeAgent.policy.daily_limit);
      setEditTxLimit(activeAgent.policy.transaction_limit);
      setEditApprovalThreshold(activeAgent.policy.approval_threshold);
    }
  }, [activeAgent]);

  const handleUpdatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgentId) return;
    try {
      await axios.patch(
        `${API_BASE_URL}/api/agents/${selectedAgentId}/policy?daily_limit=${editDailyLimit}&transaction_limit=${editTxLimit}&approval_threshold=${editApprovalThreshold}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      refreshData();
      alert("Policy limits updated successfully!");
    } catch (e: any) {
      alert("Error updating policy: " + (e.response?.data?.detail || e.message));
    }
  };

  // Fetch active tool call for visual tracer
  const activeToolCall = activeTask?.tool_calls.find(
    (tc) => tc.status === "REQUESTED" || tc.status === "402_CHALLENGE" || tc.status === "FAILED"
  ) || (activeTask && activeTask.tool_calls.length > 0 ? activeTask.tool_calls[activeTask.tool_calls.length - 1] : null);

  const tracerStatus = activeTask?.status === "FAILED" && activeTask.result?.includes("paused")
    ? "APPROVAL_REQUIRED"
    : (activeToolCall ? (activeToolCall.status === "EXECUTED" ? "RESOURCE_UNLOCKED" : (activeToolCall.status === "FAILED" ? "FAILED" : "PAYMENT_REQUIRED")) : "CREATED");

  // Find if this agent has a pending approval request
  const currentAgentApproval = pendingApprovals.find(
    (apprv) => activeAgent && apprv.agent_name.toLowerCase() === activeAgent.name.toLowerCase()
  );

  return (
    <div className="space-y-8">
      {/* Selector & Nav Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-900 pb-5">
        <div className="flex items-center space-x-4">
          <div className="bg-indigo-600/10 text-indigo-400 p-3 rounded-xl border border-indigo-500/20">
            <Cpu className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Autonomous Agents</h1>
            <p className="text-xs text-slate-400">Configure programmable rules and execute jobs.</p>
          </div>
        </div>

        {/* Dropdown list */}
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          {agents.length > 0 && (
            <select
              value={selectedAgentId || ""}
              onChange={(e) => setSelectedAgentId(Number(e.target.value))}
              className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 flex-1 sm:flex-none"
            >
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.zpay_id})
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => setActiveTab("create")}
            className="p-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white transition-all cursor-pointer shadow-md shadow-indigo-500/10"
            title="Create Agent"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {activeTab === "create" ? (
        /* CREATE FORM */
        <div className="max-w-xl glass-panel p-8 rounded-2xl border-slate-800 space-y-6 mx-auto">
          <h2 className="text-lg font-bold">Create New AI Agent</h2>
          <form onSubmit={handleCreateAgent} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Agent Name</label>
              <input
                type="text"
                required
                placeholder="e.g. ResearchBot"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm focus:outline-none focus:border-indigo-500 text-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Purpose / Goal</label>
              <input
                type="text"
                required
                placeholder="e.g. Market Research and Travel Consolidation"
                value={newPurpose}
                onChange={(e) => setNewPurpose(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm focus:outline-none focus:border-indigo-500 text-white"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Daily Limit (XLM)</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={newDailyLimit}
                  onChange={(e) => setNewDailyLimit(Number(e.target.value))}
                  className="w-full bg-slate-955 border border-slate-800 rounded-lg p-2.5 text-sm focus:outline-none focus:border-indigo-500 text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Max Tx Limit (XLM)</label>
                <input
                  type="number"
                  step="0.05"
                  required
                  value={newTxLimit}
                  onChange={(e) => setNewTxLimit(Number(e.target.value))}
                  className="w-full bg-slate-955 border border-slate-800 rounded-lg p-2.5 text-sm focus:outline-none focus:border-indigo-500 text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Approval Threshold (XLM)</label>
                <input
                  type="number"
                  step="0.05"
                  required
                  value={newApprovalThreshold}
                  onChange={(e) => setNewApprovalThreshold(Number(e.target.value))}
                  className="w-full bg-slate-955 border border-slate-800 rounded-lg p-2.5 text-sm focus:outline-none focus:border-indigo-500 text-white"
                />
              </div>
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                type="submit"
                className="px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold text-sm text-white cursor-pointer transition-all flex-1"
              >
                Assemble Agent Wallet
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("run")}
                className="px-6 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 font-semibold text-sm text-slate-400 cursor-pointer transition-all"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : activeAgent ? (
        /* MAIN WORKSPACE tabs: Run and Policy */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main workspace (2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Tabs Selector */}
            <div className="flex space-x-1 bg-slate-900/50 p-1 rounded-xl border border-slate-900 max-w-xs">
              <button
                onClick={() => setActiveTab("run")}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  activeTab === "run" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Run Task
              </button>
              <button
                onClick={() => setActiveTab("policy")}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  activeTab === "policy" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Policy Rules
              </button>
            </div>

            {activeTab === "run" ? (
              /* TASK RUNNER VIEW */
              <div className="space-y-6">
                {/* Visual Tracer Timeline */}
                {activeTask && (
                  <PaymentTrace
                    status={tracerStatus}
                    serviceName={activeToolCall?.service || "Resolving service..."}
                    cost={activeToolCall?.cost || 0.0}
                    asset="XLM"
                  />
                )}

                {/* Manual Hold Alert Box (Demo 2 / 402 policy threshold) */}
                {currentAgentApproval && (
                  <div className="p-5 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 glow-indigo">
                    <div className="flex items-center space-x-3 text-left">
                      <div className="bg-amber-500/20 text-amber-400 p-2 rounded-xl border border-amber-500/30">
                        <ShieldAlert className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-amber-400">Payment Authorization Required</h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Agent wants to pay {currentAgentApproval.amount} XLM to {currentAgentApproval.service_name} ({currentAgentApproval.reason}).
                        </p>
                      </div>
                    </div>
                    <div className="flex space-x-2 w-full md:w-auto">
                      <button
                        onClick={() => onApprovePayment(currentAgentApproval.payment_id)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg cursor-pointer transition-all flex-1 md:flex-initial"
                      >
                        Approve once
                      </button>
                      <button
                        onClick={() => onRejectPayment(currentAgentApproval.payment_id)}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg cursor-pointer transition-all flex-1 md:flex-initial"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                )}

                {/* Input Prompt Card */}
                <div className="glass-panel p-6 rounded-2xl border-slate-800 space-y-4">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Instruct the Agent</div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={prompt}
                      disabled={runningTaskId !== null}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="Give your agent a task..."
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 text-white placeholder-slate-600 disabled:opacity-50"
                    />
                    <button
                      onClick={handleRunTask}
                      disabled={runningTaskId !== null}
                      className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 p-3.5 rounded-xl text-white transition-all cursor-pointer disabled:cursor-not-allowed shadow-md shadow-indigo-500/10 flex items-center"
                    >
                      <Play className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {/* Live Console Output */}
                <div className="glass-panel p-5 rounded-2xl border-slate-800 bg-[#060A13] flex flex-col space-y-4">
                  <div className="flex justify-between items-center pb-2.5 border-b border-slate-900">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Execution Trace Console</span>
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 rounded-full bg-slate-800" />
                      <div className="w-2 h-2 rounded-full bg-slate-800" />
                      <div className="w-2 h-2 rounded-full bg-slate-800" />
                    </div>
                  </div>

                  <div className="h-[200px] overflow-y-auto console-container text-left text-xs space-y-1.5 pr-2 font-mono scroll-smooth">
                    {consoleLogs.length === 0 ? (
                      <div className="text-slate-700 h-full flex items-center justify-center italic">
                        Console ready. Run a task to trace the payment execution.
                      </div>
                    ) : (
                      consoleLogs.map((log, idx) => {
                        let colorClass = "text-slate-300";
                        if (log.includes("[API]")) colorClass = "text-amber-400";
                        if (log.includes("[POLICY]")) colorClass = "text-rose-400";
                        if (log.includes("[LEDGER]")) colorClass = "text-cyan-400";
                        if (log.includes("[AGENT]")) colorClass = "text-indigo-400";
                        return (
                          <div key={idx} className={colorClass}>
                            {log}
                          </div>
                        );
                      })
                    )}
                    <div ref={consoleEndRef} />
                  </div>
                </div>

                {/* Final aggregated output report */}
                {activeTask?.status === "COMPLETED" && activeTask.result && (
                  <div className="glass-panel p-6 rounded-2xl border-slate-800 text-left bg-slate-900/10 space-y-4">
                    <div className="flex items-center space-x-2 text-emerald-400 pb-2 border-b border-slate-900">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-bold text-sm">Aggregated Task Output Consolidated</span>
                    </div>
                    <div 
                      className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap font-sans markdown-result"
                      dangerouslySetInnerHTML={{
                        __html: activeTask.result
                          .replace(/### (.*)/g, "<h3 class='text-base font-extrabold text-white mt-4 mb-2'>$1</h3>")
                          .replace(/#### (.*)/g, "<h4 class='text-sm font-bold text-indigo-300 mt-3 mb-1'>$1</h4>")
                          .replace(/\*\*([^*]+)\*\*/g, "<strong class='text-white'>$1</strong>")
                          .replace(/- \*\*(.*?)\*\* (.*)/g, "<li class='list-none pl-4 relative before:absolute before:left-0 before:text-indigo-400 before:content-[\"➔\"]'><strong class='text-white'>$1</strong> $2</li>")
                      }}
                    />
                  </div>
                )}
              </div>
            ) : (
              /* POLICY CONFIGURATION VIEW */
              <div className="glass-panel p-8 rounded-2xl border-slate-800 space-y-6">
                <div>
                  <h2 className="text-lg font-bold">Policy Spending Parameters</h2>
                  <p className="text-xs text-slate-400">Establish the guardrails constraints within which the agent wallet operates.</p>
                </div>

                <form onSubmit={handleUpdatePolicy} className="space-y-6 text-left">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="text-xs font-semibold text-slate-400 block mb-1">Daily Limit (XLM)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={editDailyLimit}
                        onChange={(e) => setEditDailyLimit(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm focus:outline-none focus:border-indigo-500 text-white"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-400 block mb-1">Max Transaction Limit (XLM)</label>
                      <input
                        type="number"
                        step="0.05"
                        value={editTxLimit}
                        onChange={(e) => setEditTxLimit(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm focus:outline-none focus:border-indigo-500 text-white"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-400 block mb-1">Approval Threshold (XLM)</label>
                      <input
                        type="number"
                        step="0.05"
                        value={editApprovalThreshold}
                        onChange={(e) => setEditApprovalThreshold(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm focus:outline-none focus:border-indigo-500 text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="text-xs font-semibold text-slate-400">Trusted Categories</div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {["research", "data", "ai", "translation"].map((cat) => (
                        <div key={cat} className="flex items-center space-x-2 bg-slate-900 border border-slate-800 px-3.5 py-2.5 rounded-lg">
                          <CheckCircle className="h-4 w-4 text-emerald-400" />
                          <span className="text-xs font-medium text-slate-200 capitalize">{cat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold text-sm text-white cursor-pointer transition-all shadow-md shadow-indigo-500/10"
                  >
                    Commit Policy Parameters
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Sidebar wallet card info (1 col) */}
          <div className="glass-panel p-6 rounded-2xl border-slate-800 text-left h-fit space-y-6">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-400">Agent Details</h3>
              <div className="text-2xl font-bold mt-1 text-slate-100">{activeAgent.name}</div>
            </div>

            <div className="space-y-4 text-xs">
              <div className="border-b border-slate-900 pb-3">
                <span className="text-slate-500 block">Zpay Universal ID</span>
                <span className="font-bold text-slate-200">{activeAgent.zpay_id}</span>
              </div>

              <div className="border-b border-slate-900 pb-3">
                <span className="text-slate-500 block">Stellar Public Key</span>
                <span className="font-mono text-slate-400 text-[10px] break-all block mt-1 bg-slate-950/60 p-2 rounded border border-slate-900">
                  {activeAgent.public_key}
                </span>
              </div>

              <div>
                <span className="text-slate-500 block">Daily Limit Progress</span>
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 mt-1">
                  <span>Spent: 0.000 XLM</span>
                  <span>Limit: {activeAgent.policy.daily_limit} XLM</span>
                </div>
                <div className="w-full h-1.5 bg-slate-900 rounded-full mt-1.5 overflow-hidden">
                  <div className="h-full bg-indigo-600 w-[0%] rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-20 text-slate-500 italic">No agents created yet. Click the + button above to build an agent!</div>
      )}
    </div>
  );
}
