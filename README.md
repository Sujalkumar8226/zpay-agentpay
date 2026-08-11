# Zpay AgentPay — Autonomous Payments for AI Agents

> **Let AI agents pay for what they use.**

Zpay AgentPay is a programmable financial infrastructure layer that enables AI agents to autonomously discover, purchase, and consume digital resources (data, compute, AI models, translation APIs) through **x402 payment endpoints** with instant, low-cost settlement on **Stellar**.

---

## 1. The Real-World Problem

AI agents can independently perform tasks but lack a secure, native way to pay for the APIs and resources they consume.
* **Friction:** Traditional Web2 payment gateways require monthly subscriptions, credit cards, manual account registration, and API keys.
* **Commerce Blockage:** An autonomous agent cannot signup for a service or authorize card billing without human intervention.
* **Centralization Risk:** Feeding pre-funded credit cards directly to autonomous agent planners risks unbounded spend leakage.

### The Zpay Solution

Zpay AgentPay creates a secure sandbox where developers and users assign a **programmable custodial wallet** to an AI agent, guarded by strict, user-defined spending policies (limits, categories, thresholds). AI agents can then programmatically pay for services in fractions of a cent on Stellar.

```text
AI Agent ➔ Gated API Request ➔ HTTP 402 Payment Required ➔ Zpay Policy Check ➔ Auto-signed Stellar Tx ➔ Verified on Horizon ➔ Response Unlocked
```

---

## 2. Core Architecture Layers

The platform is structured into four decoupled layers:

1. **AI Agent Layer (`backend/agents`)**: A goal-seeking planner that decomposes tasks, discovers services in the marketplace, evaluates prices, requests payments, and runs tool executors.
2. **Zpay Payment Intelligence (`backend/policies`, `backend/risk`)**: Evaluates policies, updates balances, checks limits, scores risk, requests human approval, and records transaction logs.
3. **x402 Payment Layer (`backend/x402`)**: Intercepts unauthorized API calls to emit standard base64-encoded `PAYMENT-REQUIRED` (v2) headers, parses `PAYMENT-SIGNATURE` headers, and appends `PAYMENT-RESPONSE` settlement confirmations.
4. **Stellar Settlement Layer (`backend/stellar`)**: Interfaces with the Stellar Horizon network to build, sign, sponsor, submit, and verify transaction hashes.

---

## 3. Technology Stack

* **Frontend:** Next.js, React, TypeScript, Tailwind CSS (v4), Recharts, Framer Motion, Axios.
* **Backend:** FastAPI, Python (3.11), SQLAlchemy, Pydantic, SQLite (default for friction-free dev) / PostgreSQL.
* **Web3 Integration:** `@stellar-sdk` Python client, Stellar Horizon Testnet, SDF Friendbot.

---

## 4. Setup & Running Locally

### Prerequisites
* Node.js (v18+)
* Python (v3.10+)

### Step 1: Clone and Set Up Backend
```bash
# Navigate to project root
cd d:/PROJECT/ZPAY

# Recreate Python 3.11 virtual environment
python -m venv venv
venv/Scripts/activate

# Install dependencies
pip install -r backend/requirements.txt
```

### Step 2: Configure Environment
Copy `.env.example` to `.env` in the root folder:
```bash
cp .env.example .env
```

### Step 3: Run FastAPI Backend
```bash
# Activate virtualenv and run uvicorn
venv/Scripts/activate
uvicorn backend.main:app --reload --port 8000
```
*Backend API will run at `http://localhost:8000`.*

### Step 4: Run Next.js Frontend
```bash
cd frontend
npm install
npm run dev
```
*Frontend interface will run at `http://localhost:3000`.*

---

## 5. Hackathon Judge Demo Script

Experience Zpay AgentPay's core autonomous capabilities in less than 3 minutes.

### Step 1: Onboard and Fund Wallet
1. Open `http://localhost:3000`. Click **Launch Dashboard**.
2. Click **Register** and create a user (e.g., `sujal`, PIN `1234`).
3. Zpay automatically generates a custodial Stellar wallet on testnet and calls the Friendbot API to fund it with `10,000 XLM`.
4. Review your funded balance in the **Horizon Wallet** tab.

### Step 2: Launch Autonomous x402 Micropayments (Killer Demo 1)
1. Go to the **Autonomous Agents** tab.
2. An agent wallet is pre-assembled for `ResearchBot`. Give it a **Daily Limit** of `10.0 XLM` and a **Max Transaction** limit of `1.0 XLM`.
3. In the input box, enter the goal: `"Research the cheapest flight options from Delhi to Dubai and summarize the best options."`
4. Click **Run (Play)**. Watch the real-time activity terminal:
   * Agent discovers `Flight Search API` ($0.02) ➔ receives `402 Challenge`.
   * Zpay verifies policy rules ➔ signs Stellar payment autonomously.
   * On-chain transaction settles on Horizon ➔ API releases flight data.
   * Agent repeats the loop for `Currency API` ($0.001), `Translation API` ($0.005), and `AI Analysis API` ($0.030).
5. Consolidation completes! The final output report is generated showing ₹18,450 flight prices, translated summaries, and AI recommendations.
6. Open the **Financial Overview** dashboard to review charts and transaction hashes.

### Step 3: Enforce Policy Spending Guardrails (Killer Demo 2)
1. Go to **Autonomous Agents** ➔ **Policy Rules**.
2. Restrict the **Max Transaction Limit** to `0.01 XLM` (or set a daily budget of `0.01 XLM`).
3. Return to **Run Task** and run the same Delhi-to-Dubai query.
4. The terminal discovers `Flight Search API` ($0.02) but immediately outputs **[POLICY] Transaction BLOCKED**.
5. An interactive alert banner appears: **"Payment Authorization Required: Agent wants to pay 0.020 XLM to Flight Search API (Above policy limit)"**.
6. Click **Approve once**. Zpay releases the transaction, signs it, and resumes the agent's task.

### Step 4: Simulated UPI Checkout
1. Go to the **UPI Fiat Bridge** tab.
2. Enter merchant details: `Delhi Duty Free` and amount `₹2400`.
3. Click **Generate Invoice**. Zpay fetches conversion rates (`1 XLM = 22.72 INR`), displays the cost (`105.633 XLM`), and renders a scannable QR code.
4. Click **Confirm Conversion & Settle**. Stellar processes the payment, unlocks conversion liquidity, and completes the settlement instantenously.

---

## 6. Security Features

* **Authenticated Encrypted Storage:** Custodial private keys are encrypted at rest using AES-256-GCM. Decryption keys are derived from the master secret (`MASTER_ENCRYPTION_KEY`) in the `.env` file and never hit frontend databases or browser localStorage.
* **PIN Authorization:** User PINs are hashed using Bcrypt. Sensitive operations (like manual wallet transfers) require PIN verification.
* **x402 Replay Protection:** Middleware issues unique UUID nonces in `PAYMENT-REQUIRED` headers. Once checked and verified, they are marked as used in SQLite to prevent replay attacks.
