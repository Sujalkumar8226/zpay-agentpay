import logging
import datetime
from sqlalchemy.orm import Session
from backend.models import Agent, AgentPolicy, Service, PaymentIntent, RiskAssessment

logger = logging.getLogger("zpay.firewall")

class PaymentFirewall:
    @staticmethod
    def evaluate(db: Session, intent: PaymentIntent, kill_switch_active: bool = False) -> dict:
        """
        Evaluate the PaymentIntent against Policy, Budget, and Risk rules.
        Returns:
            dict: {
                "decision": "APPROVED" | "BLOCKED" | "PENDING_APPROVAL",
                "reasons": [str],
                "risk_score": int,
                "risk_factors": [str],
                "policy_checks": {
                    "agent_active": bool,
                    "transaction_limit": bool,
                    "daily_budget": bool,
                    "merchant_allowed": bool,
                    "velocity_normal": bool,
                    "risk_normal": bool
                }
            }
        """
        # Default policy checks checklist
        policy_checks = {
            "agent_active": True,
            "transaction_limit": True,
            "daily_budget": True,
            "merchant_allowed": True,
            "velocity_normal": True,
            "risk_normal": True
        }
        
        reasons = []
        risk_factors = []
        risk_score = 0
        
        # 0. Global Kill Switch Check
        if kill_switch_active:
            policy_checks["agent_active"] = False
            return {
                "decision": "BLOCKED",
                "reasons": ["Payments are currently disabled by the global security policy."],
                "risk_score": 100,
                "risk_factors": ["Global Payment Kill Switch is ON"],
                "policy_checks": policy_checks
            }

        agent = db.query(Agent).filter(Agent.id == intent.agent_id).first()
        if not agent:
            policy_checks["agent_active"] = False
            return {
                "decision": "BLOCKED",
                "reasons": ["Agent profile not found."],
                "risk_score": 100,
                "risk_factors": ["Invalid agent ID"],
                "policy_checks": policy_checks
            }

        if agent.status != "active":
            policy_checks["agent_active"] = False
            return {
                "decision": "BLOCKED",
                "reasons": [f"Agent status is '{agent.status}' (must be active)."],
                "risk_score": 100,
                "risk_factors": ["Agent is not active"],
                "policy_checks": policy_checks
            }

        policy = agent.policy
        if not policy:
            # Create a default policy if missing
            policy = AgentPolicy(
                agent_id=agent.id,
                daily_limit=10.0,
                transaction_limit=5.0,
                approval_threshold=50.0, # risk threshold 50/100
                allowed_categories=["weather-api", "research-api", "trusted-data-api", "translation-api", "analysis-api"],
                blocked_categories=["unknown-api", "gambling-api"]
            )
            db.add(policy)
            db.commit()
            db.refresh(policy)

        service = db.query(Service).filter(Service.id == intent.service_id).first()
        service_name = service.name if service else "unknown-api"

        # --- 1. POLICY ENGINE: HARD BLOCKS ---
        # A. Per-transaction limit check
        if intent.amount > policy.transaction_limit:
            policy_checks["transaction_limit"] = False
            reasons.append(f"Transaction amount {intent.amount:.2f} USDC exceeds maximum per-transaction limit of {policy.transaction_limit:.2f} USDC.")
            return {
                "decision": "BLOCKED",
                "reasons": reasons,
                "risk_score": 100,
                "risk_factors": ["Per-transaction limit exceeded"],
                "policy_checks": policy_checks
            }

        # B. Daily spending limit check
        today_start = datetime.datetime.combine(datetime.datetime.utcnow().date(), datetime.time.min)
        today_payments = db.query(PaymentIntent).filter(
            PaymentIntent.agent_id == agent.id,
            PaymentIntent.status.in_(["RESOURCE_UNLOCKED", "COMPLETED"]),
            PaymentIntent.created_at >= today_start
        ).all()
        today_spent = sum(p.amount for p in today_payments)

        if today_spent + intent.amount > policy.daily_limit:
            policy_checks["daily_budget"] = False
            reasons.append(f"Daily budget exceeded. Spent today: {today_spent:.2f}/{policy.daily_limit:.2f} USDC.")
            return {
                "decision": "BLOCKED",
                "reasons": reasons,
                "risk_score": 100,
                "risk_factors": ["Daily budget limit reached"],
                "policy_checks": policy_checks
            }

        # C. Merchant Blocklist
        blocked_merchants = policy.blocked_categories or []
        service_category = service.category if service else ""
        if service_name in blocked_merchants or service_category in blocked_merchants:
            policy_checks["merchant_allowed"] = False
            reasons.append(f"Merchant '{service_name}' ({service_category}) is explicitly blocked by policy.")
            return {
                "decision": "BLOCKED",
                "reasons": reasons,
                "risk_score": 100,
                "risk_factors": ["Merchant is on Blocklist"],
                "policy_checks": policy_checks
            }

        # D. Merchant Allowlist check
        allowed_merchants = policy.allowed_categories or []
        if allowed_merchants and (service_name not in allowed_merchants and service_category not in allowed_merchants):
            policy_checks["merchant_allowed"] = False
            reasons.append(f"Merchant '{service_name}' ({service_category}) is not in the allowed merchant list.")
            return {
                "decision": "BLOCKED",
                "reasons": reasons,
                "risk_score": 100,
                "risk_factors": ["Merchant is not on Allowlist"],
                "policy_checks": policy_checks
            }

        # E. Transaction velocity check (Max 5 transactions per minute)
        one_min_ago = datetime.datetime.utcnow() - datetime.timedelta(minutes=1)
        recent_tx_count = db.query(PaymentIntent).filter(
            PaymentIntent.agent_id == agent.id,
            PaymentIntent.status.in_(["RESOURCE_UNLOCKED", "COMPLETED"]),
            PaymentIntent.created_at >= one_min_ago
        ).count()

        if recent_tx_count >= 5:
            policy_checks["velocity_normal"] = False
            reasons.append(f"Velocity limit exceeded. Too many requests: {recent_tx_count}/minute.")
            return {
                "decision": "BLOCKED",
                "reasons": reasons,
                "risk_score": 100,
                "risk_factors": ["Velocity check failed (too many transactions per minute)"],
                "policy_checks": policy_checks
            }

        # --- 2. RISK ENGINE: CALCULATE SCORE (0-100) ---
        # Factor 1: Unknown merchant (not explicitly allowed but not blocked, or first transaction)
        if allowed_merchants and (service_name not in allowed_merchants and service_category not in allowed_merchants):
            risk_score += 30
            risk_factors.append("+30 Unknown merchant")

        # Factor 2: High Transaction Amount (>50% of policy limit)
        if intent.amount > (policy.transaction_limit * 0.5):
            if intent.amount > (policy.transaction_limit * 0.8):
                risk_score += 35
                risk_factors.append("+35 High amount (>80% of limit)")
            else:
                risk_score += 20
                risk_factors.append("+20 High amount (>50% of limit)")

        # Factor 3: High Velocity (e.g. 3 or 4 transactions in the last minute)
        if recent_tx_count >= 3:
            risk_score += 25
            risk_factors.append(f"+25 High velocity ({recent_tx_count} tx/min)")

        # Factor 4: High Budget Utilization (>50% or >80% of daily limit)
        utilization = (today_spent / policy.daily_limit) if policy.daily_limit > 0 else 0
        if utilization > 0.5:
            if utilization > 0.8:
                risk_score += 30
                risk_factors.append(f"+30 High budget utilization ({int(utilization*100)}%)")
            else:
                risk_score += 15
                risk_factors.append(f"+15 High budget utilization ({int(utilization*100)}%)")

        # Factor 5: Previous failed transactions in the last 30 minutes
        thirty_mins_ago = datetime.datetime.utcnow() - datetime.timedelta(minutes=30)
        failed_count = db.query(PaymentIntent).filter(
            PaymentIntent.agent_id == agent.id,
            PaymentIntent.status == "FAILED",
            PaymentIntent.created_at >= thirty_mins_ago
        ).count()
        if failed_count > 0:
            risk_score += 15
            risk_factors.append(f"+15 Recent failed transactions ({failed_count})")

        # Cap risk score at 100
        risk_score = min(risk_score, 100)

        # Check if risk exceeds agent's threshold
        risk_threshold = policy.approval_threshold if policy.approval_threshold else 50.0
        if risk_threshold <= 1.0:
            risk_threshold = risk_threshold * 100.0

        if risk_score >= risk_threshold:
            policy_checks["risk_normal"] = False
            reasons.append(f"Risk Score {risk_score}/100 exceeds threshold of {int(risk_threshold)}/100.")
            return {
                "decision": "PENDING_APPROVAL",
                "reasons": reasons,
                "risk_score": risk_score,
                "risk_factors": risk_factors,
                "policy_checks": policy_checks
            }

        return {
            "decision": "APPROVED",
            "reasons": ["Payment request approved. Complies with all spend policies and risk parameters."],
            "risk_score": risk_score,
            "risk_factors": risk_factors,
            "policy_checks": policy_checks
        }
