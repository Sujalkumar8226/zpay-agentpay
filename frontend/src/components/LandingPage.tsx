import React from "react";
import { ArrowRight, Cpu, Shield, Zap, DollarSign, RefreshCw } from "lucide-react";

interface LandingPageProps {
  onEnterApp: () => void;
}

export default function LandingPage({ onEnterApp }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-[#070B16] text-[#F8FAFC] flex flex-col justify-between relative overflow-hidden">
      {/* Background ambient glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="container mx-auto px-6 py-6 flex justify-between items-center border-b border-slate-900 relative z-10">
        <div className="flex items-center space-x-2">
          <div className="bg-indigo-600 p-2 rounded-lg text-white glow-indigo">
            <Cpu className="h-6 w-6" />
          </div>
          <span className="font-bold text-xl tracking-wider bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            ZPAY AGENTPAY
          </span>
        </div>
        <button
          onClick={onEnterApp}
          className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold text-sm transition-all duration-300 shadow-lg hover:shadow-indigo-500/20 flex items-center space-x-1"
        >
          <span>Launch Dashboard</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-6 py-20 flex-1 flex flex-col lg:flex-row items-center justify-between relative z-10 gap-12">
        <div className="max-w-2xl text-left space-y-8">
          <div className="inline-flex items-center space-x-2 bg-indigo-500/10 border border-indigo-500/20 px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wider text-indigo-400">
            <Zap className="h-3 w-3 animate-pulse" />
            <span>Open Innovation Challenge Winner Concept</span>
          </div>

          <h1 className="text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
            AI Agents That <br />
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
              Can Actually Pay.
            </span>
          </h1>

          <p className="text-slate-400 text-lg leading-relaxed max-w-xl">
            Zpay AgentPay gives AI agents programmable wallets and x402-powered micropayments so they can autonomously discover, purchase, and use digital services on Stellar.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <button
              onClick={onEnterApp}
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-base transition-all duration-300 shadow-xl hover:shadow-indigo-500/25 flex items-center justify-center space-x-2 border border-indigo-400/20 cursor-pointer"
            >
              <span>Get Started</span>
              <ArrowRight className="h-5 w-5" />
            </button>
            <a
              href="#how-it-works"
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800 text-slate-300 font-semibold text-base transition-all duration-300 flex items-center justify-center space-x-2 cursor-pointer"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              <span>Learn More</span>
            </a>
          </div>
        </div>

        {/* Visualized flow diagram */}
        <div className="w-full lg:w-1/2 flex justify-center relative">
          <div className="glass-panel w-full max-w-[480px] p-6 rounded-2xl glow-indigo border-slate-800/80 space-y-6 relative">
            <div className="flex justify-between items-center pb-4 border-b border-slate-800/60">
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Autonomous Payment Flow</span>
              <div className="flex space-x-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
              </div>
            </div>

            <div className="relative space-y-6">
              {/* Flow Steps */}
              <div className="flex items-center space-x-4">
                <div className="bg-indigo-600/20 text-indigo-400 p-2.5 rounded-xl border border-indigo-500/30">
                  <Cpu className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold">AI Agent Request</div>
                  <div className="text-xs text-slate-400">Agent calls a protected third-party API</div>
                </div>
              </div>

              <div className="w-0.5 h-6 bg-slate-800 ml-[23px] my-[-8px]" />

              <div className="flex items-center space-x-4">
                <div className="bg-amber-600/20 text-amber-400 p-2.5 rounded-xl border border-amber-500/30">
                  <DollarSign className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold">402 Payment Required</div>
                  <div className="text-xs text-slate-400">Endpoint challenges with payment terms</div>
                </div>
              </div>

              <div className="w-0.5 h-6 bg-slate-800 ml-[23px] my-[-8px]" />

              <div className="flex items-center space-x-4">
                <div className="bg-emerald-600/20 text-emerald-400 p-2.5 rounded-xl border border-emerald-500/30">
                  <Shield className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold">Zpay Policy Engine</div>
                  <div className="text-xs text-slate-400">Rules verified. XLM/USDC transaction signed</div>
                </div>
              </div>

              <div className="w-0.5 h-6 bg-slate-800 ml-[23px] my-[-8px]" />

              <div className="flex items-center space-x-4">
                <div className="bg-cyan-600/20 text-cyan-400 p-2.5 rounded-xl border border-cyan-500/30">
                  <RefreshCw className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold">Stellar Instant Settlement</div>
                  <div className="text-xs text-slate-400">On-chain transaction verified & API unlocked</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Highlights Section */}
      <section id="how-it-works" className="container mx-auto px-6 py-20 border-t border-slate-900">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
          <h2 className="text-3xl font-extrabold">Economic Layer for AI Ecosystems</h2>
          <p className="text-slate-400">
            Zpay connects Web2 digital resources to the Web3 machine economy in a trust-minimized financial framework.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="glass-panel p-8 rounded-2xl border-slate-800/80 hover:border-indigo-500/30 transition-all duration-300 space-y-4 group">
            <div className="bg-indigo-600/10 text-indigo-400 p-3 rounded-xl inline-block group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
              <Zap className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold">x402 Integration</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Standardized HTTP status handshake parses payment requirements and signs cryptographic payloads without logins.
            </p>
          </div>

          <div className="glass-panel p-8 rounded-2xl border-slate-800/80 hover:border-emerald-500/30 transition-all duration-300 space-y-4 group">
            <div className="bg-emerald-600/10 text-emerald-400 p-3 rounded-xl inline-block group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
              <Shield className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold">Programmable Budgets</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Define daily caps, maximum single transaction thresholds, blocked category filters, and high-risk manual holds.
            </p>
          </div>

          <div className="glass-panel p-8 rounded-2xl border-slate-800/80 hover:border-cyan-500/30 transition-all duration-300 space-y-4 group">
            <div className="bg-cyan-600/10 text-cyan-400 p-3 rounded-xl inline-block group-hover:bg-cyan-600 group-hover:text-white transition-all duration-300">
              <RefreshCw className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold">Stellar Settlement</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Fast, high-throughput network ensures micropayments clear in under 5 seconds with negligible gas overhead.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-950 py-8 bg-[#04070F] text-slate-500 text-sm text-center">
        <div className="container mx-auto px-6">
          <p>© 2026 Zpay AgentPay. Built for Open Innovation Stellar Hackathon. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
