import os
import sys

# Configure environment variables BEFORE importing backend modules
os.environ["MASTER_ENCRYPTION_KEY"] = "zpay_agent_wallet_master_key_32b_exactly_32b"
# Use a separate test database
os.environ["DATABASE_URL"] = "sqlite:///./zpay_test.db"

import json
import base64
import unittest
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from backend.database import Base, get_db
from backend.main import app
from backend.models import User, Wallet, Agent, AgentPolicy, Service, ServiceProvider, PaymentIntent, AgentTask, AgentToolCall
from backend.payment_intent import PaymentIntentManager
from backend.firewall import PaymentFirewall
from backend.capabilities import AgentCapabilities
from backend.security import encrypt_private_key

# Test DB Setup
SQLALCHEMY_DATABASE_URL = "sqlite:///./zpay_test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

class TestX402ProtocolE2E(unittest.TestCase):
    def setUp(self):
        # Create schema
        Base.metadata.create_all(bind=engine)
        self.db = TestingSessionLocal()
        self.client = TestClient(app)
        self.seed_database()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(bind=engine)
        if os.path.exists("./zpay_test.db"):
            try:
                os.remove("./zpay_test.db")
            except Exception:
                pass

    def seed_database(self):
        # 1. Create developer user
        user = User(
            email="test_buyer@zpay.network",
            password_hash="test_pass",
            pin_hash="123456",
            role="user"
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        self.user = user

        # 2. Create buyer wallet
        # Standard test keys
        public_key = "GBBD47NESK5CX7D7RMM6YW7QD66JHBIZ4KCO62D2CBEEOCOZAFSU7G3O"
        encrypted_sec = encrypt_private_key("SAAAAAAAAABBBBBBBBBCCCCCCCCCDDDDDDDDDEEEEEEEEEFFFFFFFFFGGGG")
        wallet = Wallet(
            user_id=user.id,
            public_key=public_key,
            encrypted_private_key=encrypted_sec,
            zpay_id="test_buyer@Zp",
            label="Test Buyer Wallet",
            type="custodial"
        )
        self.db.add(wallet)
        self.db.commit()
        self.db.refresh(wallet)
        self.wallet = wallet

        # 3. Create Agent
        agent = Agent(
            user_id=user.id,
            wallet_id=wallet.id,
            name="Travel Scout",
            purpose="Find flights and currency conversions",
            balance=100.0,
            status="active"
        )
        self.db.add(agent)
        self.db.commit()
        self.db.refresh(agent)
        self.agent = agent

        # 4. Create Policy
        policy = AgentPolicy(
            agent_id=agent.id,
            daily_limit=2.0,
            transaction_limit=0.5,
            approval_threshold=0.1,
            allowed_categories=["travel", "data", "translation", "ai"],
            blocked_categories=["gambling"],
            allowed_assets=["XLM"]
        )
        self.db.add(policy)
        self.db.commit()
        self.db.refresh(policy)
        self.policy = policy

        # 5. Create provider merchant user
        prov_user = User(
            email="provider@zpay.network",
            password_hash="prov_pass",
            pin_hash="654321",
            role="developer"
        )
        self.db.add(prov_user)
        self.db.commit()
        self.db.refresh(prov_user)

        # 6. Create provider wallet
        prov_public_key = "GBBD47NESK5CX7D7RMM6YW7QD66JHBIZ4KCO62D2CBEEOCOZAFSU7G3P"
        prov_wallet = Wallet(
            user_id=prov_user.id,
            public_key=prov_public_key,
            encrypted_private_key="encrypted_sim_key",
            zpay_id="provider@Zp",
            label="Provider Primary Wallet",
            type="custodial"
        )
        self.db.add(prov_wallet)
        
        provider = ServiceProvider(
            user_id=prov_user.id,
            name="Stellar Travels",
            balance=0.0
        )
        self.db.add(provider)
        self.db.commit()
        self.db.refresh(provider)
        self.provider = provider

        # 7. Create Flight Search Service
        service = Service(
            provider_id=provider.id,
            name="Flight Search API",
            description="Paid flight search protection endpoint",
            price=0.020,
            category="travel",
            url="/api/x402/flights",
            address=prov_public_key,
            network="stellar:testnet",
            asset="XLM",
            is_active=True
        )
        self.db.add(service)
        self.db.commit()
        self.db.refresh(service)
        self.service = service

        # 8. Create AgentTask
        task = AgentTask(
            agent_id=agent.id,
            goal="Book flight Delhi to Dubai",
            status="PLANNING"
        )
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)
        self.task = task

    def test_missing_payment_returns_402(self):
        """Test A: Querying protected resource without signature header returns HTTP 402."""
        response = self.client.get("/api/x402/flights?from_city=Delhi&to_city=Dubai")
        self.assertEqual(response.status_code, 402)
        
        # Verify headers
        pay_req_hdr = response.headers.get("PAYMENT-REQUIRED")
        self.assertIsNotNone(pay_req_hdr)
        
        # Parse payload
        pay_req = json.loads(base64.b64decode(pay_req_hdr).decode('utf-8'))
        self.assertEqual(pay_req["x402Version"], 2)
        
        opt = pay_req["accepts"][0]
        self.assertEqual(opt["scheme"], "exact")
        self.assertEqual(opt["network"], "stellar:testnet")
        self.assertEqual(float(opt["amount"]), 0.020)
        self.assertEqual(opt["asset"], "XLM")
        self.assertIsNotNone(opt["challenge"])

        # Check DB payment_intent status is PAYMENT_REQUIRED
        intent = PaymentIntentManager.get_by_challenge(self.db, opt["challenge"])
        self.assertIsNotNone(intent)
        self.assertEqual(intent.status, "PAYMENT_REQUIRED")

    def test_capabilities_validation(self):
        """Test B: Verify agent capabilities validation boundaries."""
        # Valid call
        res_ok = AgentCapabilities.validate_tool_call(self.agent, "Flight Search API", {"from_city": "DEL", "to_city": "DXB"}, 0.020)
        self.assertTrue(res_ok["valid"])

        # Blocked tool (unregistered)
        res_fail_reg = AgentCapabilities.validate_tool_call(self.agent, "Gambling API", {}, 0.10)
        self.assertFalse(res_fail_reg["valid"])
        self.assertIn("not registered", res_fail_reg["error"])

        # Exceeding tool cap limit
        res_fail_limit = AgentCapabilities.validate_tool_call(self.agent, "Flight Search API", {"from_city": "DEL", "to_city": "DXB"}, 0.50)
        self.assertFalse(res_fail_limit["valid"])
        self.assertIn("exceeds", res_fail_limit["error"])

    def test_firewall_rules_deny(self):
        """Test C: Verify firewall DENY rule on policy limit violation."""
        # Create intent exceeding daily/transaction limit
        intent_deny = PaymentIntentManager.create_intent(
            db=self.db,
            agent_id=self.agent.id,
            user_id=self.user.id,
            task_id=self.task.id,
            service_id=self.service.id,
            amount=1.5,  # Policy transaction limit is 0.5
            asset="XLM",
            network="stellar:testnet",
            destination=self.service.address,
            challenge="test_challenge_deny"
        )
        
        firewall_res = PaymentFirewall.evaluate(self.db, intent_deny)
        self.assertEqual(firewall_res["decision"], "DENY")
        self.assertIn("exceeds maximum per-transaction limit", firewall_res["reasons"][0])

    def test_firewall_rules_approval(self):
        """Test D: Verify firewall APPROVAL_REQUIRED rule."""
        intent_apprv = PaymentIntentManager.create_intent(
            db=self.db,
            agent_id=self.agent.id,
            user_id=self.user.id,
            task_id=self.task.id,
            service_id=self.service.id,
            amount=0.2,  # Exceeds approval threshold of 0.1, but under txn limit 0.5
            asset="XLM",
            network="stellar:testnet",
            destination=self.service.address,
            challenge="test_challenge_apprv"
        )
        
        # Override service price temporarily to avoid parameter mismatch error
        self.service.price = 0.2
        self.db.commit()

        firewall_res = PaymentFirewall.evaluate(self.db, intent_apprv)
        self.assertEqual(firewall_res["decision"], "APPROVAL_REQUIRED")
        self.assertIn("exceeds auto-approval threshold", firewall_res["reasons"][0])

    def test_successful_x402_flow(self):
        """Test E: Complete E2E x402 integration payment, verification, and resource unlock."""
        # 1. Start call (pass agent header to associate intent)
        response = self.client.get("/api/x402/flights?from_city=Delhi&to_city=Dubai", headers={"X-AGENT-ID": str(self.agent.id)})
        self.assertEqual(response.status_code, 402)
        pay_req_hdr = response.headers.get("PAYMENT-REQUIRED")
        pay_req = json.loads(base64.b64decode(pay_req_hdr).decode('utf-8'))
        challenge = pay_req["accepts"][0]["challenge"]

        # Find payment intent created in DB
        intent = PaymentIntentManager.get_by_challenge(self.db, challenge)
        self.assertEqual(intent.status, "PAYMENT_REQUIRED")

        # 2. Firewall checks
        PaymentIntentManager.transition(self.db, intent, "POLICY_CHECK")
        firewall_res = PaymentFirewall.evaluate(self.db, intent)
        self.assertEqual(firewall_res["decision"], "ALLOW")
        
        PaymentIntentManager.transition(self.db, intent, "RISK_CHECK")
        PaymentIntentManager.transition(self.db, intent, "AUTHORIZED")

        # 3. Client authorization: submit mock payment (DemoFacilitator simulation)
        # Settle
        from backend.facilitator import DemoFacilitatorAdapter
        demo_fac = DemoFacilitatorAdapter()
        settle_res = demo_fac.settle(
            sender_secret="demo_key",
            receiver_public=intent.destination,
            amount=intent.amount,
            asset_code=intent.asset,
            network=intent.network
        )
        self.assertTrue(settle_res["success"])
        tx_hash = settle_res["tx_hash"]
        self.assertTrue(tx_hash.startswith("sim_tx_"))

        PaymentIntentManager.transition(self.db, intent, "SUBMITTED", tx_hash=tx_hash)

        # 4. Request unlock by passing PAYMENT-SIGNATURE
        sig_payload = {
            "transactionHash": tx_hash,
            "network": intent.network,
            "challenge": challenge
        }
        sig_b64 = base64.b64encode(json.dumps(sig_payload).encode('utf-8')).decode('utf-8')
        
        headers = {"PAYMENT-SIGNATURE": sig_b64}
        retry_response = self.client.get("/api/x402/flights?from_city=Delhi&to_city=Dubai", headers=headers)
        self.assertEqual(retry_response.status_code, 200)

        # Assert data returned
        data = retry_response.json()
        self.assertIn("flights", data)

        # Assert correct header returned
        pay_resp_hdr = retry_response.headers.get("PAYMENT-RESPONSE")
        self.assertIsNotNone(pay_resp_hdr)
        pay_resp = json.loads(base64.b64decode(pay_resp_hdr).decode('utf-8'))
        self.assertEqual(pay_resp["status"], "settled")
        self.assertEqual(pay_resp["transactionHash"], tx_hash)

        # Assert DB updated to COMPLETED
        self.db.refresh(intent)
        self.assertEqual(intent.status, "COMPLETED")

    def test_replay_attack_fails(self):
        """Test F: Submitting the same transaction signature for a different challenge fails validation."""
        # 1. Create a mock completed payment intent
        completed_intent = PaymentIntentManager.create_intent(
            db=self.db,
            agent_id=self.agent.id,
            user_id=self.user.id,
            task_id=self.task.id,
            service_id=self.service.id,
            amount=0.020,
            asset="XLM",
            network="stellar:testnet",
            destination=self.service.address,
            challenge="challenge_one"
        )
        # Settle it (run through valid transitions)
        PaymentIntentManager.transition(self.db, completed_intent, "PAYMENT_REQUIRED")
        PaymentIntentManager.transition(self.db, completed_intent, "POLICY_CHECK")
        PaymentIntentManager.transition(self.db, completed_intent, "RISK_CHECK")
        PaymentIntentManager.transition(self.db, completed_intent, "AUTHORIZED")
        PaymentIntentManager.transition(self.db, completed_intent, "SUBMITTED", tx_hash="sim_tx_reusablehash")
        PaymentIntentManager.transition(self.db, completed_intent, "VERIFYING")
        PaymentIntentManager.transition(self.db, completed_intent, "VERIFIED", tx_hash="sim_tx_reusablehash", settlement_ref="sim_tx_reusablehash")
        PaymentIntentManager.transition(self.db, completed_intent, "RESOURCE_UNLOCKED")
        PaymentIntentManager.transition(self.db, completed_intent, "COMPLETED")

        # 2. Get another 402 challenge (associating Agent)
        response = self.client.get("/api/x402/flights?from_city=Delhi&to_city=Dubai", headers={"X-AGENT-ID": str(self.agent.id)})
        self.assertEqual(response.status_code, 402)
        pay_req = json.loads(base64.b64decode(response.headers["PAYMENT-REQUIRED"]).decode('utf-8'))
        challenge2 = pay_req["accepts"][0]["challenge"]

        # Transition the second intent to SUBMITTED
        intent2 = PaymentIntentManager.get_by_challenge(self.db, challenge2)
        PaymentIntentManager.transition(self.db, intent2, "POLICY_CHECK")
        PaymentIntentManager.transition(self.db, intent2, "RISK_CHECK")
        PaymentIntentManager.transition(self.db, intent2, "AUTHORIZED")
        # Reuse the transaction hash
        PaymentIntentManager.transition(self.db, intent2, "SUBMITTED", tx_hash="sim_tx_reusablehash")

        # 3. Submit signature using reused hash
        sig_payload = {
            "transactionHash": "sim_tx_reusablehash",
            "network": "stellar:testnet",
            "challenge": challenge2
        }
        sig_b64 = base64.b64encode(json.dumps(sig_payload).encode('utf-8')).decode('utf-8')
        
        headers = {"PAYMENT-SIGNATURE": sig_b64}
        retry_response = self.client.get("/api/x402/flights?from_city=Delhi&to_city=Dubai", headers=headers)
        self.assertEqual(retry_response.status_code, 402)
        self.assertIn("Replay attack detected", retry_response.json()["detail"])

if __name__ == "__main__":
    unittest.main()
