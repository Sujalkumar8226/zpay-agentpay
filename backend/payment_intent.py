import logging
import datetime
from typing import Optional
from sqlalchemy.orm import Session
from backend.models import PaymentIntent

logger = logging.getLogger("zpay.payment_intent")

VALID_TRANSITIONS = {
    "CREATED": ["PAYMENT_REQUIRED", "FAILED", "CANCELLED"],
    "PAYMENT_REQUIRED": ["POLICY_CHECK", "VERIFYING", "FAILED", "EXPIRED", "CANCELLED"],
    "POLICY_CHECK": ["RISK_CHECK", "VERIFYING", "DENIED", "FAILED", "EXPIRED", "CANCELLED"],
    "RISK_CHECK": ["AUTHORIZED", "APPROVAL_REQUIRED", "VERIFYING", "DENIED", "FAILED", "EXPIRED", "CANCELLED"],
    "APPROVAL_REQUIRED": ["AUTHORIZED", "VERIFYING", "DENIED", "FAILED", "EXPIRED", "CANCELLED"],
    "AUTHORIZED": ["SUBMITTED", "VERIFYING", "FAILED", "EXPIRED", "CANCELLED"],
    "SUBMITTED": ["VERIFYING", "FAILED", "EXPIRED", "CANCELLED"],
    "VERIFYING": ["VERIFIED", "FAILED", "EXPIRED", "CANCELLED"],
    "VERIFIED": ["RESOURCE_UNLOCKED", "FAILED"],
    "RESOURCE_UNLOCKED": ["COMPLETED", "FAILED"],
    "COMPLETED": [],
    "DENIED": [],
    "FAILED": [],
    "EXPIRED": [],
    "CANCELLED": []
}

class PaymentIntentManager:
    @staticmethod
    def get_by_challenge(db: Session, challenge: str) -> Optional[PaymentIntent]:
        return db.query(PaymentIntent).filter(PaymentIntent.challenge == challenge).first()

    @staticmethod
    def create_intent(
        db: Session,
        agent_id: Optional[int],
        user_id: Optional[int],
        task_id: Optional[int],
        service_id: Optional[int],
        amount: float,
        asset: str,
        network: str,
        destination: str,
        challenge: str,
        idempotency_key: Optional[str] = None,
        expires_in_minutes: int = 5
    ) -> PaymentIntent:
        # Check idempotency
        if idempotency_key:
            existing = db.query(PaymentIntent).filter(PaymentIntent.idempotency_key == idempotency_key).first()
            if existing:
                logger.info(f"Idempotency hit! Returning existing PaymentIntent {existing.id} for key {idempotency_key}")
                return existing

        expires_at = datetime.datetime.utcnow() + datetime.timedelta(minutes=expires_in_minutes)
        intent = PaymentIntent(
            user_id=user_id,
            agent_id=agent_id,
            task_id=task_id,
            service_id=service_id,
            amount=amount,
            asset=asset,
            network=network,
            destination=destination,
            challenge=challenge,
            idempotency_key=idempotency_key,
            status="CREATED",
            expires_at=expires_at
        )
        db.add(intent)
        db.commit()
        db.refresh(intent)
        logger.info(f"Created PaymentIntent {intent.id} with status CREATED")
        return intent

    @staticmethod
    def transition(
        db: Session,
        intent: PaymentIntent,
        to_status: str,
        error_message: Optional[str] = None,
        tx_hash: Optional[str] = None,
        settlement_ref: Optional[str] = None,
        policy_decision: Optional[str] = None,
        risk_decision: Optional[str] = None
    ) -> PaymentIntent:
        current_status = intent.status
        
        # Validate transition
        allowed = VALID_TRANSITIONS.get(current_status, [])
        if to_status not in allowed:
            raise ValueError(f"Invalid state transition: Cannot transition PaymentIntent from {current_status} to {to_status}")

        intent.status = to_status
        if error_message:
            intent.error_message = error_message
        if tx_hash:
            intent.tx_hash = tx_hash
        if settlement_ref:
            intent.settlement_reference = settlement_ref
        if policy_decision:
            intent.policy_decision = policy_decision
        if risk_decision:
            intent.risk_decision = risk_decision
            
        intent.updated_at = datetime.datetime.utcnow()
        db.commit()
        db.refresh(intent)
        logger.info(f"Transitioned PaymentIntent {intent.id} from {current_status} to {to_status}")
        return intent
