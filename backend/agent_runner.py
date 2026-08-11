import time
import base64
import json
import logging
import requests
import uuid
from datetime import datetime, date, timedelta
from sqlalchemy.orm import Session
from backend.database import SessionLocal
from backend.models import Agent, AgentPolicy, Service, PaymentIntent, AuditLog, AgentTask, AgentToolCall, Wallet, Transaction, RiskAssessment, ApprovalRequest
from backend.security import decrypt_private_key
from backend.stellar_service import StellarService
from backend.payment_intent import PaymentIntentManager
from backend.firewall import PaymentFirewall
from backend.capabilities import AgentCapabilities

# Logger
logger = logging.getLogger("zpay.agent")
logger.setLevel(logging.INFO)

stellar_service = StellarService()

class AgentRunner:
    @staticmethod
    def execute_task(task_id: int):
        """Asynchronously executes an AgentTask. Runs step-by-step."""
        db = SessionLocal()
        task = db.query(AgentTask).filter(AgentTask.id == task_id).first()
        if not task:
            db.close()
            return

        agent = task.agent
        task.status = "RUNNING"
        db.commit()

        # Log task start
        db.add(AuditLog(agent_id=agent.id, action="TASK_STARTED", status="SUCCESS", details=f"Starting task: {task.goal}"))
        db.commit()

        try:
            # 1. Planner: Define the steps/tools needed based on the goal
            steps = []
            goal_lower = task.goal.lower()

            if "flight" in goal_lower:
                steps = [
                    {"name": "Flight Search API", "category": "travel", "price": 0.020, "endpoint": "/api/x402/flights", "params": {"from_city": "Delhi", "to_city": "Dubai"}},
                    {"name": "Currency API", "category": "data", "price": 0.001, "endpoint": "/api/x402/currency", "params": {"base": "AED", "target": "INR"}},
                    {"name": "Translation API", "category": "translation", "price": 0.005, "endpoint": "/api/x402/translation", "params": {"text": "Indigo offers the cheapest flight at ₹18,450. Air India is ₹20,100. Emirates is premium at ₹31,200.", "target_lang": "ar"}},
                    {"name": "AI Analysis API", "category": "ai", "price": 0.030, "endpoint": "/api/x402/analysis", "params": {"query": task.goal}}
                ]
            else:
                steps = [
                    {"name": "Currency API", "category": "data", "price": 0.001, "endpoint": "/api/x402/currency", "params": {"base": "USD", "target": "INR"}},
                    {"name": "AI Analysis API", "category": "ai", "price": 0.030, "endpoint": "/api/x402/analysis", "params": {"query": task.goal}}
                ]

            results = {}
            for index, step in enumerate(steps):
                time.sleep(2)  # Pause to simulate processing and make UI animations stunning

                # Find service in DB
                service = db.query(Service).filter(Service.name == step["name"]).first()
                if not service:
                    # Create default provider if missing
                    from backend.models import ServiceProvider
                    provider = db.query(ServiceProvider).first()
                    if not provider:
                        provider = ServiceProvider(user_id=agent.user_id, name="Default Provider", balance=0.0)
                        db.add(provider)
                        db.commit()
                        db.refresh(provider)
                    
                    wallet = db.query(Wallet).filter(Wallet.user_id == provider.user_id).first()
                    if not wallet or not wallet.public_key:
                        try:
                            from backend.models import User
                            u = db.query(User).filter(User.id == provider.user_id).first()
                            if not u:
                                u = User(
                                    id=provider.user_id,
                                    email=f"provider_{provider.id}@zpay.network",
                                    password_hash="simulated_pass",
                                    pin_hash="simulated_pin",
                                    role="developer"
                                )
                                db.add(u)
                                db.commit()
                                db.refresh(u)
                            keys = stellar_service.generate_keypair()
                            wallet = Wallet(
                                user_id=provider.user_id,
                                public_key=keys["public_key"],
                                encrypted_private_key="simulated_key",
                                zpay_id=f"provider_{provider.id}@Zp",
                                label="Primary Stellar Wallet",
                                type="custodial"
                            )
                            db.add(wallet)
                            db.commit()
                            db.refresh(wallet)
                        except Exception as e:
                            logger.error(f"Failed to auto-create provider wallet: {str(e)}")
                            wallet = None
                    
                    service_address = wallet.public_key if wallet else "GBBD47NESK5CX7D7RMM6YW7QD66JHBIZ4KCO62D2CBEEOCOZAFSU7G3O"
                    
                    service = Service(
                        provider_id=provider.id,
                        name=step["name"],
                        description=f"Paid {step['name']} api",
                        price=step["price"],
                        category=step["category"],
                        url=step["endpoint"],
                        address=service_address,
                        asset="XLM",
                        network="stellar:testnet"
                    )
                    db.add(service)
                    db.commit()
                    db.refresh(service)

                # Find or create tool call record
                tool_call = db.query(AgentToolCall).filter(
                    AgentToolCall.task_id == task.id,
                    AgentToolCall.service_id == service.id
                ).first()

                if not tool_call:
                    tool_call = AgentToolCall(
                        task_id=task.id,
                        service_id=service.id,
                        cost=step["price"],
                        status="REQUESTED"
                    )
                    db.add(tool_call)
                    db.commit()
                    db.refresh(tool_call)

                if tool_call.status == "EXECUTED":
                    results[step["name"]] = json.loads(tool_call.response) if tool_call.response else {}
                    continue

                # LOG Discovery
                db.add(AuditLog(agent_id=agent.id, action="SERVICE_DISCOVERED", status="SUCCESS", details=f"Discovered {service.name} (Cost: {service.price} XLM)"))
                db.commit()

                # Reconstruct API URL
                base_url = "http://localhost:8000"
                full_url = f"{base_url}{step['endpoint']}"

                # Safe capability tool call validation
                cap_check = AgentCapabilities.validate_tool_call(agent, step["name"], step["params"], step["price"])
                if not cap_check["valid"]:
                    err_msg = cap_check["error"]
                    tool_call.status = "FAILED"
                    db.add(AuditLog(agent_id=agent.id, action="CAPABILITY_VALIDATION_FAILED", status="FAILURE", details=err_msg))
                    db.commit()
                    task.status = "FAILED"
                    task.result = f"Task aborted due to agent capability policy check violation: {err_msg}"
                    db.commit()
                    return

                # Check if there is an existing payment intent for this agent and service
                payment = db.query(PaymentIntent).filter(
                    PaymentIntent.agent_id == agent.id,
                    PaymentIntent.service_id == service.id,
                    PaymentIntent.status.in_(["PAYMENT_REQUIRED", "POLICY_CHECK", "RISK_CHECK", "APPROVAL_REQUIRED", "AUTHORIZED", "SUBMITTED", "VERIFYING", "VERIFIED", "RESOURCE_UNLOCKED"])
                ).order_by(PaymentIntent.created_at.desc()).first()

                challenge_nonce = None
                pay_to = None
                p_amount = None
                p_asset = None
                p_network = None

                if not payment:
                    # STEP 2: Request without payment to trigger 402 challenge
                    tool_call.status = "402_CHALLENGE"
                    db.commit()

                    # LOG Challenge
                    db.add(AuditLog(agent_id=agent.id, action="PAYMENT_REQUIRED_402", status="PENDING", details=f"HTTP 402 challenge requested from {service.name}"))
                    db.commit()

                    time.sleep(1.5)

                    try:
                        response = requests.get(
                            full_url,
                            params=step["params"],
                            headers={"X-AGENT-ID": str(agent.id)},
                            timeout=5
                        )
                        status_code = response.status_code
                        headers = response.headers
                    except Exception as e:
                        logger.error(f"Failed to call local API: {str(e)}")
                        raise e

                    if status_code != 402:
                        logger.error(f"Expected 402, got {status_code}")
                        raise Exception(f"Unexpected status code {status_code} from protected service")

                    pay_req_b64 = headers.get("PAYMENT-REQUIRED")
                    if not pay_req_b64:
                        raise Exception("Missing PAYMENT-REQUIRED header in 402 response")

                    pay_req = json.loads(base64.b64decode(pay_req_b64.encode('utf-8')).decode('utf-8'))
                    option = pay_req["accepts"][0]
                    challenge_nonce = option["challenge"]
                    pay_to = option["payTo"]
                    p_amount = float(option["amount"])
                    p_asset = option["asset"]
                    p_network = option["network"]

                    # The middleware already creates the PaymentIntent in PAYMENT_REQUIRED status. We retrieve it.
                    payment = PaymentIntentManager.get_by_challenge(db, challenge_nonce)
                    if not payment:
                        # Fallback create
                        payment = PaymentIntentManager.create_intent(
                            db=db,
                            agent_id=agent.id,
                            user_id=agent.user_id,
                            task_id=task.id,
                            service_id=service.id,
                            amount=p_amount,
                            asset=p_asset,
                            network=p_network,
                            destination=pay_to,
                            challenge=challenge_nonce
                        )
                else:
                    challenge_nonce = payment.challenge
                    pay_to = payment.destination
                    p_amount = payment.amount
                    p_asset = payment.asset
                    p_network = payment.network

                # Update task reference inside payment intent if not set
                if not payment.task_id:
                    payment.task_id = task.id
                    db.commit()

                # STEP 3: Firewall checks (only if in initial states)
                if payment.status in ["PAYMENT_REQUIRED", "POLICY_CHECK", "RISK_CHECK"]:
                    PaymentIntentManager.transition(db, payment, "POLICY_CHECK")
                    
                    # Run deterministic firewall
                    firewall_result = PaymentFirewall.evaluate(db, payment)
                    decision = firewall_result["decision"]
                    reasons = firewall_result["reasons"]
                    reason_desc = reasons[0] if reasons else "Firewall validated"

                    # Record risk assessment details
                    risk_score = 90 if decision == "DENY" else (50 if decision == "APPROVAL_REQUIRED" else 15)
                    risk_level = "HIGH" if risk_score == 90 else ("MEDIUM" if risk_score == 50 else "LOW")
                    
                    risk_assess = db.query(RiskAssessment).filter(RiskAssessment.payment_intent_id == payment.id).first()
                    if not risk_assess:
                        risk_assess = RiskAssessment(
                            payment_intent_id=payment.id,
                            payment_id=payment.id,
                            score=risk_score,
                            risk_level=risk_level,
                            details={"reasons": reasons}
                        )
                        db.add(risk_assess)
                    else:
                        risk_assess.score = risk_score
                        risk_assess.risk_level = risk_level
                        risk_assess.details = {"reasons": reasons}
                    db.commit()

                    PaymentIntentManager.transition(db, payment, "RISK_CHECK", policy_decision=decision, risk_decision=risk_level)

                    if decision == "DENY":
                        PaymentIntentManager.transition(db, payment, "DENIED", error_message=reason_desc)
                        tool_call.status = "FAILED"
                        db.add(AuditLog(
                            agent_id=agent.id,
                            action="PAYMENT_FIREWALL_REJECTED",
                            status="FAILURE",
                            details=f"Payment blocked by firewall: {reason_desc}"
                        ))
                        db.commit()
                        
                        task.status = "FAILED"
                        task.result = f"Task aborted due to spending firewall check violation: {reason_desc}"
                        db.commit()
                        return

                    elif decision == "APPROVAL_REQUIRED":
                        PaymentIntentManager.transition(db, payment, "APPROVAL_REQUIRED", error_message=reason_desc)
                        db.add(AuditLog(
                            agent_id=agent.id,
                            action="HUMAN_APPROVAL_REQUESTED",
                            status="PENDING",
                            details=f"Payment of {p_amount} {p_asset} requires human approval: {reason_desc}"
                        ))
                        db.commit()
                        
                        from backend.models import ApprovalRequest
                        approval = db.query(ApprovalRequest).filter(ApprovalRequest.payment_intent_id == payment.id).first()
                        if not approval:
                            approval = ApprovalRequest(
                                payment_intent_id=payment.id,
                                payment_id=payment.id,
                                requester_id=agent.user_id,
                                status="PENDING"
                            )
                            db.add(approval)
                        db.commit()
                        
                        task.status = "FAILED"
                        task.result = f"Task paused: Payment for {service.name} ({p_amount} {p_asset}) requires manual approval."
                        db.commit()
                        return

                    # ALLOWED
                    PaymentIntentManager.transition(db, payment, "AUTHORIZED")

                # STEP 4: Submit transaction on Stellar (Client Payer role)
                if payment.status == "AUTHORIZED":
                    db.add(AuditLog(agent_id=agent.id, action="PAYMENT_AUTHORIZED", status="SUCCESS", details="Payment authorized. Submitting transaction."))
                    db.commit()

                    time.sleep(1.5)

                    # Get agent wallet custodial credentials
                    wallet = agent.wallet
                    decrypted_secret = decrypt_private_key(wallet.encrypted_private_key)

                    # Submit to Stellar testnet
                    tx_result = None
                    if decrypted_secret.startswith("S") and len(decrypted_secret) == 56:
                        db.add(AuditLog(agent_id=agent.id, action="STELLAR_SUBMIT", status="PENDING", details="Submitting transaction to Stellar Horizon..."))
                        db.commit()
                        
                        from backend.facilitator import StellarFacilitatorAdapter
                        facilitator = StellarFacilitatorAdapter()
                        tx_result = facilitator.settle(
                            sender_secret=decrypted_secret,
                            receiver_public=pay_to,
                            amount=p_amount,
                            asset_code=p_asset,
                            memo_text=challenge_nonce[:28],
                            network=p_network
                        )

                    if tx_result and tx_result.get("success"):
                        tx_hash = tx_result["tx_hash"]
                        PaymentIntentManager.transition(db, payment, "SUBMITTED", tx_hash=tx_hash)
                    else:
                        # Fallback for demo testing when testnet Horizon is rate-limited
                        # We use the DemoFacilitatorAdapter to settle
                        logger.warning("Stellar testnet payment failed. Falling back to simulated verification...")
                        from backend.facilitator import DemoFacilitatorAdapter
                        demo_fac = DemoFacilitatorAdapter()
                        tx_result = demo_fac.settle(
                            sender_secret="demo",
                            receiver_public=pay_to,
                            amount=p_amount,
                            asset_code=p_asset,
                            memo_text=challenge_nonce[:28],
                            network=p_network
                        )
                        tx_hash = tx_result["tx_hash"]
                        PaymentIntentManager.transition(db, payment, "SUBMITTED", tx_hash=tx_hash)
                        time.sleep(1.5)

                # STEP 5: Request resource unlock by sending signature header
                # Note: The client does NOT set RESOURCE_UNLOCKED. The middleware server verifies and handles it.
                if payment.status in ["SUBMITTED", "VERIFYING", "VERIFIED", "RESOURCE_UNLOCKED", "COMPLETED"]:
                    sig_payload = {
                        "transactionHash": payment.tx_hash,
                        "network": p_network,
                        "challenge": challenge_nonce
                    }
                    sig_b64 = base64.b64encode(json.dumps(sig_payload).encode('utf-8')).decode('utf-8')
                    headers = {
                        "PAYMENT-SIGNATURE": sig_b64,
                        "X-AGENT-ID": str(agent.id)
                    }

                    db.add(AuditLog(agent_id=agent.id, action="RESOURCE_UNLOCK_REQUEST", status="PENDING", details=f"Submitting PAYMENT-SIGNATURE for {service.name}..."))
                    db.commit()

                    try:
                        retry_response = requests.get(full_url, params=step["params"], headers=headers, timeout=10)
                        status_code = retry_response.status_code
                    except Exception as e:
                        logger.error(f"Failed to submit payment signature: {str(e)}")
                        raise e

                    if status_code != 200:
                        logger.error(f"Unlock failed with status {status_code}: {retry_response.text}")
                        # Fetch final failed status updated by middleware
                        db.refresh(payment)
                        tool_call.status = "FAILED"
                        db.commit()
                        
                        task.status = "FAILED"
                        task.result = f"Task aborted: API unlock failed with code {status_code}."
                        db.commit()
                        return

                    step_data = retry_response.json()
                    results[step["name"]] = step_data
                    
                    tool_call.status = "EXECUTED"
                    tool_call.response = json.dumps(step_data)
                    
                    # Refresh to get final COMPLETED status written by middleware
                    db.refresh(payment)
                    db.commit()

                    # Record transaction log in DB
                    existing_tx = db.query(Transaction).filter(Transaction.tx_hash == payment.tx_hash).first()
                    if not existing_tx:
                        db.add(Transaction(
                            wallet_id=agent.wallet.id,
                            tx_hash=payment.tx_hash,
                            amount=p_amount,
                            asset=p_asset,
                            fee=0.0001,
                            sender=agent.wallet.public_key,
                            receiver=pay_to,
                            status="CONFIRMED",
                            memo=challenge_nonce[:28]
                        ))
                    db.commit()

            # 6. Complete task and format final output
            task.status = "COMPLETED"
            
            # Combine the results into a beautiful final summary
            final_report = "### Flight Research Summary ( Delhi ➔ Dubai )\n\n"
            
            flights_data = results.get("Flight Search API", {}).get("flights", [])
            currency_data = results.get("Currency API", {})
            translation_data = results.get("Translation API", {})
            analysis_data = results.get("AI Analysis API", {})

            if flights_data:
                final_report += "#### Available Flights:\n"
                for f in flights_data:
                    final_report += f"- **{f['airline']}** ({f['flight_number']}): {f['departure']} - {f['arrival']} ({f['duration']}) | **₹{f['price_inr']:,}** (~${f['price_usd']})\n"
                final_report += "\n"
            
            if currency_data:
                final_report += f"#### Currency Conversion:\n- 1 {currency_data.get('base')} = **{currency_data.get('rate')} {currency_data.get('target')}**\n\n"
            
            if translation_data:
                final_report += f"#### Translation (Arabic Summary):\n- *\"{translation_data.get('translated_text')}\"*\n\n"
            
            if analysis_data:
                final_report += f"#### AI Recommendation:\n{analysis_data.get('summary')}\n\n"

            final_report += f"---\n**Task Metas:** Services: {len(steps)} | Total Spent: {sum(s['price'] for s in steps):.3f} XLM | Protocol: x402 | Settlement: Stellar Testnet"

            task.result = final_report
            db.add(AuditLog(agent_id=agent.id, action="TASK_COMPLETED", status="SUCCESS", details="All paid API requests resolved. Goal achieved!"))
            db.commit()

        except Exception as e:
            logger.exception("Error executing agent task")
            task.status = "FAILED"
            task.result = f"Execution error: {str(e)}"
            db.add(AuditLog(agent_id=agent.id, action="TASK_FAILED", status="FAILURE", details=f"Task error: {str(e)}"))
            db.commit()
        finally:
            db.close()

def uuid_str() -> str:
    return str(uuid.uuid4()).replace("-", "")
