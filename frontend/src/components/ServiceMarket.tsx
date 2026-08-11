import React, { useState } from "react";
import { Cpu, Globe, Sparkles, Plus, CheckCircle, BarChart, Code, BookOpen } from "lucide-react";
import axios from "axios";
import { API_BASE_URL } from "../config";

interface Service {
  id: number;
  name: string;
  description: string;
  price: number;
  category: string;
  url: string;
  network: string;
  asset: string;
  address: string;
  rating: number;
  calls_count: number;
}

interface ServiceMarketProps {
  token: string;
  services: Service[];
  refreshData: () => void;
  developerDashboard: {
    revenue: number;
    api_calls: number;
    services: Array<{
      id: number;
      name: string;
      price: number;
      calls: number;
      revenue: number;
      category: string;
      url: string;
    }>;
  };
}

export default function ServiceMarket({ token, services, refreshData, developerDashboard }: ServiceMarketProps) {
  const [activeTab, setActiveTab] = useState<"market" | "developer" | "docs">("market");
  
  // Register Service State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("data");
  const [url, setUrl] = useState("");
  const [asset, setAsset] = useState("XLM");
  const [submitting, setSubmitting] = useState(false);

  const handleRegisterService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price || !url) return;
    
    setSubmitting(true);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/services?name=${encodeURIComponent(name)}&description=${encodeURIComponent(description)}&price=${price}&category=${category}&url=${encodeURIComponent(url)}&asset=${asset}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        setName("");
        setDescription("");
        setPrice("");
        setUrl("");
        alert("Endpoint registered successfully! It is now protected by Zpay x402 middleware.");
        refreshData();
      }
    } catch (e: any) {
      alert("Error registering service: " + (e.response?.data?.detail || e.message));
    } finally {
      setSubmitting(false);
    }
  };

  const expressCode = `// Node.js Express x402 Middleware Integration
import express from 'express';
import { x402PaymentMiddleware } from '@x402/express';

const app = express();

app.get('/api/weather', x402PaymentMiddleware({
  price: '0.001',
  asset: 'XLM',
  network: 'stellar:testnet',
  payTo: 'GDXYZ...' // Provider Payout Address
}), (req, res) => {
  res.json({ weather: 'Sunny', temp: '28C' });
});`;

  const pythonCode = `# FastAPI x402 Middleware Decorator Integration
from fastapi import FastAPI, Request, Depends
from backend.x402_middleware import x402_payment_required

app = FastAPI()

@app.get("/api/weather")
@x402_payment_required(
    service_name="Weather API", 
    category="data", 
    default_price=0.001, 
    asset="XLM"
)
async def get_weather(request: Request):
    return {"weather": "Sunny", "temp": "28C"}`;

  return (
    <div className="space-y-8">
      {/* Subnav Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-900 pb-5">
        <div className="flex items-center space-x-4">
          <div className="bg-indigo-600/10 text-indigo-400 p-3 rounded-xl border border-indigo-500/20">
            <Globe className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Developer Hub</h1>
            <p className="text-xs text-slate-400">Discover paid APIs, monetize endpoints, and review telemetry.</p>
          </div>
        </div>

        <div className="flex space-x-1 bg-slate-900/50 p-1 rounded-xl border border-slate-900 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab("market")}
            className={`flex-1 sm:flex-none px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === "market" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Service Market
          </button>
          <button
            onClick={() => setActiveTab("developer")}
            className={`flex-1 sm:flex-none px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === "developer" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Provider Portal
          </button>
          <button
            onClick={() => setActiveTab("docs")}
            className={`flex-1 sm:flex-none px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === "docs" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            x402 Integration
          </button>
        </div>
      </div>

      {activeTab === "market" ? (
        /* MARKETPLACE PAGE */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service) => (
            <div
              key={service.id}
              className="glass-panel p-6 rounded-2xl border-slate-800 flex flex-col justify-between text-left hover:border-indigo-500/20 transition-all duration-300 relative group"
            >
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div className="bg-indigo-600/10 text-indigo-400 p-2.5 rounded-xl border border-indigo-500/10 uppercase font-black text-[9px] tracking-wider">
                    {service.category}
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-extrabold text-indigo-400">{service.price} {service.asset}</div>
                    <div className="text-[9px] text-slate-500 font-semibold uppercase mt-0.5">Per Request</div>
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-bold text-slate-200">{service.name}</h3>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed h-[40px] overflow-hidden">
                    {service.description}
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-900 mt-6 flex justify-between items-center text-[10px] text-slate-500">
                <div className="flex items-center space-x-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>x402 Active</span>
                </div>
                <div>Calls: {service.calls_count || 0}</div>
              </div>
            </div>
          ))}
        </div>
      ) : activeTab === "developer" ? (
        /* DEVELOPER PORTAL PAGE (Become an API, telemetry stats) */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Become an API form */}
          <div className="glass-panel p-8 rounded-2xl border-slate-800 text-left space-y-6 lg:col-span-1">
            <div>
              <h2 className="text-lg font-bold">Become an x402 API</h2>
              <p className="text-xs text-slate-400">Publish your custom endpoint. Zpay handles billing telemetry instantly.</p>
            </div>

            <form onSubmit={handleRegisterService} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Service Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Weather API"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm focus:outline-none focus:border-indigo-500 text-white placeholder-slate-700"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Description</label>
                <textarea
                  placeholder="What does this service provide?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm focus:outline-none focus:border-indigo-500 text-white placeholder-slate-700 h-20 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Price per call</label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    placeholder="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm focus:outline-none focus:border-indigo-500 text-white placeholder-slate-700"
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

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm focus:outline-none text-white cursor-pointer capitalize"
                >
                  <option value="data">data</option>
                  <option value="research">research</option>
                  <option value="ai">ai</option>
                  <option value="translation">translation</option>
                  <option value="travel">travel</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Endpoint Endpoint URL</label>
                <input
                  type="url"
                  required
                  placeholder="https://api.domain.com/data"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm focus:outline-none focus:border-indigo-500 text-white placeholder-slate-700"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white rounded-lg font-bold text-xs cursor-pointer disabled:cursor-not-allowed transition-all shadow-md shadow-indigo-500/10 flex items-center justify-center space-x-1.5"
              >
                <Plus className="h-4 w-4" />
                <span>{submitting ? "Publishing API..." : "Publish Endpoint"}</span>
              </button>
            </form>
          </div>

          {/* Telemetry charts & revenue stats */}
          <div className="lg:col-span-2 space-y-6 text-left">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="glass-panel p-6 rounded-2xl border-slate-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total API Revenue</span>
                <div className="text-3xl font-black text-emerald-400 mt-2">
                  {developerDashboard.revenue.toFixed(3)} XLM
                </div>
                <div className="text-[10px] text-slate-500 mt-1">Settled on Stellar Testnet</div>
              </div>

              <div className="glass-panel p-6 rounded-2xl border-slate-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total API Requests handled</span>
                <div className="text-3xl font-black text-indigo-400 mt-2">
                  {developerDashboard.api_calls}
                </div>
                <div className="text-[10px] text-slate-500 mt-1">Gated under x402 challenge middleware</div>
              </div>
            </div>

            {/* List of registered developer endpoints */}
            <div className="glass-panel p-6 rounded-2xl border-slate-800 space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-400">Monetized Endpoints Telemetry</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-900 text-slate-400 font-semibold">
                      <th className="pb-3">Endpoint Name</th>
                      <th className="pb-3">Category</th>
                      <th className="pb-3">Price</th>
                      <th className="pb-3">Hits</th>
                      <th className="pb-3 text-right">Earned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {developerDashboard.services.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-10 text-center text-slate-600 italic">
                          You haven't registered any paid endpoints yet.
                        </td>
                      </tr>
                    ) : (
                      developerDashboard.services.map((s) => (
                        <tr key={s.id} className="border-b border-slate-900 last:border-0 hover:bg-slate-950/20">
                          <td className="py-3 font-semibold text-slate-200">{s.name}</td>
                          <td className="py-3 text-slate-400 capitalize">{s.category}</td>
                          <td className="py-3 font-medium text-indigo-400">{s.price} XLM</td>
                          <td className="py-3 text-slate-400">{s.calls}</td>
                          <td className="py-3 text-emerald-400 font-bold text-right">{s.revenue.toFixed(3)} XLM</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* INTEGRATION GUIDE CODE EXAMPLES */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-left">
          <div className="glass-panel p-6 rounded-2xl border-slate-800 space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center space-x-2 text-indigo-400">
                <Code className="h-5 w-5" />
                <span className="font-bold text-sm">Express.js Node Backend</span>
              </div>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Import `@x402/express` into your Node backend, wrap the handler, and specify the price. The middleware responds with 402, creates challenges, verifies Horizon hashes, and resolves access.
              </p>
            </div>
            <pre className="bg-[#040710] p-4 rounded-xl border border-slate-950 font-mono text-[10px] text-slate-300 overflow-x-auto whitespace-pre">
              {expressCode}
            </pre>
          </div>

          <div className="glass-panel p-6 rounded-2xl border-slate-800 space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center space-x-2 text-emerald-400">
                <Code className="h-5 w-5" />
                <span className="font-bold text-sm">FastAPI Python Backend</span>
              </div>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Use the `@x402_payment_required` decorator on routes to enforce Stellar micropayment gates. Decodes `PAYMENT-SIGNATURE` headers, matches Horizon transaction hashes, and releases JSON responses.
              </p>
            </div>
            <pre className="bg-[#040710] p-4 rounded-xl border border-slate-950 font-mono text-[10px] text-slate-300 overflow-x-auto whitespace-pre">
              {pythonCode}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
