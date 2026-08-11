import logging
import datetime
from sqlalchemy.orm import Session
from backend.models import Agent, AgentPolicy, Service, PaymentIntent

logger = logging.getLogger("zpay.firewall")

class PaymentFirewall:
    @staticmethod
    def evaluate(db: Session, intent: PaymentIntent) -> dict:
        """
        Evaluate the PaymentIntent against Policy, Budget, and Risk rules.
        Returns:
            dict: {
                "decision": "ALLOW" | "APPROVAL_REQUIRED" | "DENY",
                "reasons": [str]
            }
        """
        reasons = []
        agent = db.query(Agent).filter(Agent.id == intent.agent_id).first()
        if not agent:
            return {"decision": "DENY", "reasons": ["Agent profile not found."]}

        policy = agent.policy
        if not policy:
            return {"decision": "DENY", "reasons": ["No spending policy defined for this agent."]}

        service = db.query(Service).filter(Service.id == intent.service_id).first()
        if not service:
            return {"decision": "DENY", "reasons": ["Target service provider not found."]}

        # --- 1. POLICY ENGINE ---
        # A. Blocked Categories check
        blocked = policy.blocked_categories or []
        if service.category in blocked:
            reasons.append(f"Category '{service.category}' is explicitly blocked by policy.")
            return {"decision": "DENY", "reasons": reasons}

        # B. Allowed Categories check
        allowed = policy.allowed_categories or []
        if allowed and service.category not in allowed:
            reasons.append(f"Category '{service.category}' is not in the allowed list.")
            return {"decision": "DENY", "reasons": reasons}

        # C. Max Per-Transaction Limit check
        if intent.amount > policy.transaction_limit:
            reasons.append(f"Transaction amount {intent.amount} XLM exceeds maximum per-transaction limit of {policy.transaction_limit} XLM.")
            return {"decision": "DENY", "reasons": reasons}

        # --- 2. BUDGET ENGINE ---
        # Daily limit spent aggregator
        today_start = datetime.datetime.combine(datetime.date.today(), datetime.time.min)
        today_payments = db.query(PaymentIntent).filter(
            PaymentIntent.agent_id == agent.id,
            PaymentIntent.status.in_(["RESOURCE_UNLOCKED", "COMPLETED"]),
            PaymentIntent.created_at >= today_start
        ).all()
        today_spent = sum(p.amount for p in today_payments)

        if today_spent + intent.amount > policy.daily_limit:
            reasons.append(f"Daily budget exceeded. Spent today: {today_spent:.3f}/{policy.daily_limit:.3f} XLM.")
            return {"decision": "DENY", "reasons": reasons}

        # --- 3. RISK ENGINE ---
        # A. Replay/Mismatched parameters checking
        if abs(intent.amount - service.price) > 0.0001:
            reasons.append(f"Risk Warning: Requested payment amount {intent.amount} does not match service price {service.price}.")
            return {"decision": "DENY", "reasons": reasons}

        # B. Duplicate checking (unexpired pending intents for same service/amount)
        five_mins_ago = datetime.datetime.utcnow() - datetime.timedelta(minutes=5)
        duplicate_pending = db.query(PaymentIntent).filter(
            PaymentIntent.agent_id == agent.id,
            PaymentIntent.service_id == service.id,
            PaymentIntent.amount == intent.amount,
            PaymentIntent.status == "AUTHORIZED",
            PaymentIntent.created_at >= five_mins_ago,
            PaymentIntent.id != intent.id
        ).first()

        if duplicate_pending:
            reasons.append("Risk Warning: Multiple concurrent pending intents detected for identical parameters.")
            return {"decision": "DENY", "reasons": reasons}

        # --- 4. HUMAN APPROVAL THRESHOLD ---
        if intent.amount > policy.approval_threshold:
            reasons.append(f"Amount {intent.amount} XLM exceeds auto-approval threshold of {policy.approval_threshold} XLM.")
            return {"decision": "APPROVAL_REQUIRED", "reasons": reasons}

        return {
            "decision": "ALLOW",
            "reasons": ["Payment complies with all policy, budget, and risk firewall parameters."]
        }
