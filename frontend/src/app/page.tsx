"use client";

import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { 
  Cpu, Wallet, Globe, Scale, Users, Shield, CreditCard, 
  LayoutDashboard, LogOut, ArrowRight, UserPlus, ShieldAlert, RefreshCw
} from "lucide-react";

import LandingPage from "../components/LandingPage";
import Dashboard from "../components/Dashboard";
import AgentControl from "../components/AgentControl";
import WalletCard from "../components/WalletCard";
import ServiceMarket from "../components/ServiceMarket";
import EscrowPortal from "../components/EscrowPortal";
import UpiBridge from "../components/UpiBridge";
import BillSplitter from "../components/BillSplitter";
import SecurityCenter from "../components/SecurityCenter";

export default function Page() {
  const [showLanding, setShowLanding] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  
  // Auth Form State
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [username, setUsername] = useState("");
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(false);

  // App Navigation
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "agents" | "wallet" | "services" | "escrow" | "upi" | "splits" | "security"
  >("dashboard");

  // Global App Data
  const [walletData, setWalletData] = useState<any>(null);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [agents, setAgents] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [escrows, setEscrows] = useState<any[]>([]);
  const [splits, setSplits] = useState<any[]>([]);
  const [securityData, setSecurityData] = useState<any>(null);
  
  // Developer dashboard telemetry
  const [devDashboard, setDevDashboard] = useState<any>({ revenue: 0.0, api_calls: 0, services: [] });
  // Pending manual holds
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  // Local role cache
  const [userRole, setUserRole] = useState("user");
  const [userZpayId, setUserZpayId] = useState("");

  // Concurrent data loader
  const fetchEverything = useCallback(async (authToken: string) => {
    try {
      const headers = { Authorization: `Bearer ${authToken}` };

      // Make concurrent API calls to populate tables
      const [
        walletRes,
        analyticsRes,
        agentsRes,
        servicesRes,
        escrowsRes,
        splitsRes,
        securityRes,
        devRes,
        approvalsRes
      ] = await Promise.all([
        axios.get("http://localhost:8000/api/wallet", { headers }).catch(() => null),
        axios.get("http://localhost:8000/api/analytics", { headers }).catch(() => null),
        axios.get("http://localhost:8000/api/agents", { headers }).catch(() => null),
        axios.get("http://localhost:8000/api/services", { headers }).catch(() => null),
        axios.get("http://localhost:8000/api/escrow", { headers }).catch(() => null),
        axios.get("http://localhost:8000/api/split", { headers }).catch(() => null),
        axios.get("http://localhost:8000/api/security", { headers }).catch(() => null),
        axios.get("http://localhost:8000/api/developer/dashboard", { headers }).catch(() => null),
        axios.get("http://localhost:8000/api/payments/approvals", { headers }).catch(() => null)
      ]);

      if (walletRes) {
        setWalletData(walletRes.data);
        setUserZpayId(walletRes.data.zpay_id);
      }
      if (analyticsRes) setAnalyticsData(analyticsRes.data);
      if (agentsRes) setAgents(agentsRes.data);
      if (servicesRes) setServices(servicesRes.data);
      if (escrowsRes) setEscrows(escrowsRes.data);
      if (splitsRes) setSplits(splitsRes.data);
      if (securityRes) setSecurityData(securityRes.data);
      if (devRes) setDevDashboard(devRes.data);
      if (approvalsRes) setPendingApprovals(approvalsRes.data);

    } catch (e) {
      console.error("Error loading application state", e);
    }
  }, []);

  // Poll approvals and data occasionally
  useEffect(() => {
    let interval: any;
    if (token) {
      fetchEverything(token);
      interval = setInterval(() => {
        fetchEverything(token);
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [token, fetchEverything]);

  // Auth Handlers
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setLoading(true);

    try {
      if (isRegister) {
        // Register Call
        const res = await axios.post(
          `http://localhost:8000/api/auth/register?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}&pin=${pin}&username=${encodeURIComponent(username)}`
        );
        if (res.data.success) {
          // Flip to login
          setIsRegister(false);
          setPassword("");
          setPin("");
          alert("Account registered successfully! Please log in.");
        }
      } else {
        // Login Call (requires OAuth2 form format)
        const params = new URLSearchParams();
        params.append("username", email);
        params.append("password", password);

        const res = await axios.post("http://localhost:8000/api/auth/login", params, {
          headers: { "Content-Type": "application/x-www-form-urlencoded" }
        });

        if (res.data.access_token) {
          setToken(res.data.access_token);
          setUserRole(res.data.role);
          // Trigger immediate load
          fetchEverything(res.data.access_token);
        }
      }
    } catch (e: any) {
      setAuthError(e.response?.data?.detail || "Authentication failure. Check credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setWalletData(null);
    setAgents([]);
    setActiveTab("dashboard");
  };

  // Approvals
  const handleApprovePayment = async (paymentId: number) => {
    if (!token) return;
    try {
      await axios.post(
        `http://localhost:8000/api/payments/${paymentId}/approve`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchEverything(token);
    } catch (e: any) {
      alert("Approval error: " + (e.response?.data?.detail || e.message));
    }
  };

  const handleRejectPayment = async (paymentId: number) => {
    if (!token) return;
    try {
      await axios.post(
        `http://localhost:8000/api/payments/${paymentId}/reject`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchEverything(token);
    } catch (e: any) {
      alert("Rejection error: " + (e.response?.data?.detail || e.message));
    }
  };

  if (showLanding) {
    return <LandingPage onEnterApp={() => setShowLanding(false)} />;
  }

  if (!token) {
    /* LOGIN/REGISTER MODAL SCREEN */
    return (
      <div className="min-h-screen bg-[#070B16] text-[#F8FAFC] flex items-center justify-center relative overflow-hidden px-4">
        {/* Background ambient glows */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none" />

        <div className="w-full max-w-md glass-panel p-8 rounded-3xl border-slate-800 glow-indigo space-y-6 relative z-10">
          <div className="text-center space-y-2">
            <div className="bg-indigo-600 p-2.5 rounded-xl text-white inline-block mb-2">
              <Cpu className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-extrabold tracking-wider uppercase bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              {isRegister ? "Join Zpay AgentPay" : "Secure Portal Login"}
            </h2>
            <p className="text-xs text-slate-400">
              {isRegister ? "Build wallets and programmable rules for AI agents." : "Welcome back. Access your AI financial layers."}
            </p>
          </div>

          {authError && (
            <div className="p-3.5 bg-rose-500/15 border border-rose-500/25 rounded-xl flex items-center space-x-2 text-xs text-rose-400 text-left">
              <ShieldAlert className="h-4.5 w-4.5 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4 text-left">
            {isRegister && (
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Zpay ID username</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. sujal"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm focus:outline-none focus:border-indigo-500 text-white placeholder-slate-800"
                />
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Email Address</label>
              <input
                type="email"
                required
                placeholder="you@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-955 border border-slate-800 rounded-lg p-2.5 text-sm focus:outline-none focus:border-indigo-500 text-white placeholder-slate-700"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Password</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-955 border border-slate-800 rounded-lg p-2.5 text-sm focus:outline-none focus:border-indigo-500 text-white placeholder-slate-700"
              />
            </div>

            {isRegister && (
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Wallet PIN (4 Digits)</label>
                <input
                  type="password"
                  maxLength={4}
                  required
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="w-full bg-slate-955 border border-slate-800 rounded-lg p-2.5 text-sm focus:outline-none focus:border-indigo-500 text-white placeholder-slate-700 tracking-widest"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-bold text-sm text-white transition-all duration-300 shadow-md shadow-indigo-500/10 flex items-center justify-center space-x-1.5 cursor-pointer disabled:cursor-not-allowed"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : isRegister ? (
                <>
                  <UserPlus className="h-4 w-4" />
                  <span>Create Account & Wallet</span>
                </>
              ) : (
                <>
                  <ArrowRight className="h-4 w-4" />
                  <span>Secure Login</span>
                </>
              )}
            </button>
          </form>

          <div className="text-center pt-2">
            <button
              onClick={() => {
                setIsRegister(!isRegister);
                setAuthError("");
              }}
              className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer"
            >
              {isRegister ? "Already registered? Sign In" : "Don't have an account? Register"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Sidebar navigation items
  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "agents", label: "Autonomous Agents", icon: Cpu },
    { id: "wallet", label: "Horizon Wallet", icon: Wallet },
    { id: "services", label: "Service Market", icon: Globe },
    { id: "escrow", label: "Smart Escrow", icon: Scale },
    { id: "upi", label: "UPI Fiat Bridge", icon: CreditCard },
    { id: "splits", label: "Group Splits", icon: Users },
    { id: "security", label: "Security & Audits", icon: Shield }
  ];

  return (
    <div className="min-h-screen bg-[#070B16] text-[#F8FAFC] flex flex-col md:flex-row relative">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 border-r border-slate-900 flex flex-col justify-between p-6 bg-[#040811] relative z-10 shrink-0">
        <div className="space-y-8">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <div className="bg-indigo-600 p-2 rounded-lg text-white glow-indigo">
              <Cpu className="h-5 w-5" />
            </div>
            <span className="font-extrabold text-base tracking-wider bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              ZPAY AGENTPAY
            </span>
          </div>

          {/* User profile */}
          <div className="bg-slate-900/40 border border-slate-900 rounded-xl p-3.5 text-left">
            <span className="text-[10px] text-slate-500 block uppercase tracking-wider font-semibold">User Zpay ID</span>
            <span className="font-bold text-sm text-indigo-400 block mt-0.5">{userZpayId || "resolving..."}</span>
          </div>

          {/* Nav Links */}
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  className={`w-full flex items-center space-x-3 px-3.5 py-3.5 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer text-left ${
                    isActive 
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/10 font-bold" 
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/30"
                  }`}
                >
                  <Icon className={`h-4.5 w-4.5 ${isActive ? "text-white" : "text-slate-400"}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center space-x-3 px-3.5 py-3.5 rounded-xl text-xs font-semibold tracking-wide text-rose-500 hover:bg-rose-500/5 hover:border-rose-500/10 border border-transparent transition-all cursor-pointer text-left mt-8"
        >
          <LogOut className="h-4.5 w-4.5" />
          <span>Logout Portal</span>
        </button>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto max-h-screen relative z-10">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />

        {walletData && analyticsData && securityData ? (
          <>
            {activeTab === "dashboard" && <Dashboard analyticsData={analyticsData} />}
            {activeTab === "agents" && (
              <AgentControl
                token={token}
                agents={agents}
                refreshData={() => fetchEverything(token)}
                pendingApprovals={pendingApprovals}
                onApprovePayment={handleApprovePayment}
                onRejectPayment={handleRejectPayment}
              />
            )}
            {activeTab === "wallet" && (
              <WalletCard
                token={token}
                walletData={walletData}
                refreshData={() => fetchEverything(token)}
              />
            )}
            {activeTab === "services" && (
              <ServiceMarket
                token={token}
                services={services}
                refreshData={() => fetchEverything(token)}
                developerDashboard={devDashboard}
              />
            )}
            {activeTab === "escrow" && (
              <EscrowPortal
                token={token}
                escrows={escrows}
                refreshData={() => fetchEverything(token)}
                userRole={userRole}
              />
            )}
            {activeTab === "upi" && (
              <UpiBridge
                token={token}
                refreshData={() => fetchEverything(token)}
              />
            )}
            {activeTab === "splits" && (
              <BillSplitter
                token={token}
                splits={splits}
                refreshData={() => fetchEverything(token)}
                allZpayIds={[userZpayId, ...agents.map(a => a.zpay_id)]}
              />
            )}
            {activeTab === "security" && <SecurityCenter securityData={securityData} />}
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 py-32 space-y-4">
            <RefreshCw className="h-10 w-10 animate-spin text-indigo-500" />
            <span className="text-sm font-semibold tracking-wider">Synchronizing platform states...</span>
          </div>
        )}
      </main>
    </div>
  );
}
