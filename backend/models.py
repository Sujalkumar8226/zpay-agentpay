import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from backend.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    pin_hash = Column(String, nullable=False)
    role = Column(String, default="user", nullable=False)  # user, developer, admin, arbiter
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    wallets = relationship("Wallet", back_populates="user")
    agents = relationship("Agent", back_populates="user")
    splits = relationship("GroupSplit", back_populates="creator")
    split_memberships = relationship("GroupSplitMember", back_populates="user")

class Wallet(Base):
    __tablename__ = "wallets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    public_key = Column(String, unique=True, index=True, nullable=False)
    encrypted_private_key = Column(String, nullable=False)  # Encrypted using AES-256-GCM
    address = Column(String, nullable=True)  # Optional alternate format/address
    zpay_id = Column(String, unique=True, index=True, nullable=False)  # e.g., sujal@Zp
    label = Column(String, default="Main Wallet")
    type = Column(String, default="custodial")  # custodial, non-custodial
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="wallets")
    agents = relationship("Agent", back_populates="wallet")

class Agent(Base):
    __tablename__ = "agents"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    wallet_id = Column(Integer, ForeignKey("wallets.id"), nullable=False)
    name = Column(String, index=True, nullable=False)
    purpose = Column(String, nullable=True)
    balance = Column(Float, default=0.0)  # Simulated base currency balance (e.g., in USDC/XLM)
    status = Column(String, default="active")  # active, paused, terminated
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="agents")
    wallet = relationship("Wallet", back_populates="agents")
    payment_intents = relationship("PaymentIntent", back_populates="agent")
    policy = relationship("AgentPolicy", uselist=False, back_populates="agent")
    tasks = relationship("AgentTask", back_populates="agent")

class AgentPolicy(Base):
    __tablename__ = "agent_policies"

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id"), unique=True, nullable=False)
    daily_limit = Column(Float, default=10.0)
    transaction_limit = Column(Float, default=1.0)
    approval_threshold = Column(Float, default=0.5)  # Require human approval above this
    allowed_categories = Column(JSON, default=lambda: ["research", "data", "ai", "translation"])
    blocked_categories = Column(JSON, default=lambda: ["unknown", "gambling"])
    allowed_assets = Column(JSON, default=lambda: ["USDC", "XLM"])
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    agent = relationship("Agent", back_populates="policy")

class ServiceProvider(Base):
    __tablename__ = "service_providers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    balance = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    services = relationship("Service", back_populates="provider")

class Service(Base):
    __tablename__ = "services"

    id = Column(Integer, primary_key=True, index=True)
    provider_id = Column(Integer, ForeignKey("service_providers.id"), nullable=False)
    name = Column(String, index=True, nullable=False)
    description = Column(Text, nullable=True)
    price = Column(Float, nullable=False)  # in asset denomination
    category = Column(String, index=True, nullable=False)  # research, travel, data, translation, ai
    url = Column(String, nullable=False)
    network = Column(String, default="stellar:testnet")
    asset = Column(String, default="USDC")
    address = Column(String, nullable=False)  # Stellar payout address
    rating = Column(Float, default=5.0)
    calls_count = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    provider = relationship("ServiceProvider", back_populates="services")
    payment_intents = relationship("PaymentIntent", back_populates="service")
    tool_calls = relationship("AgentToolCall", back_populates="service")

class PaymentIntent(Base):
    __tablename__ = "payment_intents"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=True)
    task_id = Column(Integer, ForeignKey("agent_tasks.id"), nullable=True)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=True)
    amount = Column(Float, nullable=False)
    asset = Column(String, nullable=False)
    network = Column(String, nullable=False)
    destination = Column(String, nullable=False)  # Payout address
    status = Column(String, default="CREATED")  # CREATED, PAYMENT_REQUIRED, POLICY_CHECK, RISK_CHECK, AUTHORIZED, APPROVAL_REQUIRED, SUBMITTED, VERIFYING, VERIFIED, RESOURCE_UNLOCKED, COMPLETED
    challenge = Column(String, unique=True, index=True, nullable=False)  # Nonce
    tx_hash = Column(String, nullable=True)
    settlement_reference = Column(String, nullable=True)
    error_message = Column(Text, nullable=True)
    idempotency_key = Column(String, unique=True, index=True, nullable=True)
    policy_decision = Column(String, nullable=True)
    risk_decision = Column(String, nullable=True)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    agent = relationship("Agent", back_populates="payment_intents")
    service = relationship("Service", back_populates="payment_intents")
    task = relationship("AgentTask")
    upi_settlements = relationship("UPISettlement", back_populates="payment_intent")
    risk_assessment = relationship("RiskAssessment", uselist=False, back_populates="payment_intent")
    approval_requests = relationship("ApprovalRequest", back_populates="payment_intent")

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    wallet_id = Column(Integer, ForeignKey("wallets.id"), nullable=False)
    tx_hash = Column(String, unique=True, index=True, nullable=False)
    amount = Column(Float, nullable=False)
    asset = Column(String, nullable=False)
    fee = Column(Float, default=0.0)
    sender = Column(String, nullable=False)
    receiver = Column(String, nullable=False)
    status = Column(String, default="CONFIRMED")
    memo = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class Escrow(Base):
    __tablename__ = "escrows"

    id = Column(Integer, primary_key=True, index=True)
    buyer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    seller_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    arbiter_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    amount = Column(Float, nullable=False)
    asset = Column(String, default="USDC")
    network = Column(String, default="stellar:testnet")
    status = Column(String, default="ACTIVE")  # ACTIVE, RELEASED, REFUNDED, DISPUTED, RESOLVED
    resolution = Column(String, nullable=True)  # RELEASED, REFUNDED
    details = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    buyer = relationship("User", foreign_keys=[buyer_id])
    seller = relationship("User", foreign_keys=[seller_id])
    arbiter = relationship("User", foreign_keys=[arbiter_id])
    disputes = relationship("EscrowDispute", back_populates="escrow")

class EscrowDispute(Base):
    __tablename__ = "escrow_disputes"

    id = Column(Integer, primary_key=True, index=True)
    escrow_id = Column(Integer, ForeignKey("escrows.id"), nullable=False)
    raised_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    reason = Column(Text, nullable=False)
    status = Column(String, default="PENDING")  # PENDING, RESOLVED
    resolution = Column(String, nullable=True)  # RELEASED_TO_SELLER, REFUNDED_TO_BUYER
    arbiter_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    escrow = relationship("Escrow", back_populates="disputes")

class UPISettlement(Base):
    __tablename__ = "upi_settlements"

    id = Column(Integer, primary_key=True, index=True)
    payment_intent_id = Column(Integer, ForeignKey("payment_intents.id"), nullable=False)
    crypto_amount = Column(Float, nullable=False)
    inr_amount = Column(Float, nullable=False)
    upi_id = Column(String, nullable=False)
    merchant_name = Column(String, nullable=False)
    qr_code_url = Column(Text, nullable=True)
    status = Column(String, default="PENDING")  # PENDING, COMPLETED, FAILED
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    payment_intent = relationship("PaymentIntent", back_populates="upi_settlements")

class GroupSplit(Base):
    __tablename__ = "group_splits"

    id = Column(Integer, primary_key=True, index=True)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    description = Column(String, nullable=False)
    total_amount = Column(Float, nullable=False)  # in INR
    inr_amount = Column(Float, nullable=False)
    status = Column(String, default="PENDING")  # PENDING, SETTLED
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    creator = relationship("User", back_populates="splits")
    members = relationship("GroupSplitMember", back_populates="split")

class GroupSplitMember(Base):
    __tablename__ = "group_split_members"

    id = Column(Integer, primary_key=True, index=True)
    split_id = Column(Integer, ForeignKey("group_splits.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    amount = Column(Float, nullable=False)  # in INR
    status = Column(String, default="PENDING")  # PENDING, PAID
    tx_hash = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    split = relationship("GroupSplit", back_populates="members")
    user = relationship("User", back_populates="split_memberships")

class RiskAssessment(Base):
    __tablename__ = "risk_assessments"

    id = Column(Integer, primary_key=True, index=True)
    payment_intent_id = Column(Integer, ForeignKey("payment_intents.id"), nullable=False)
    score = Column(Integer, nullable=False)  # 0 to 100
    risk_level = Column(String, nullable=False)  # LOW, MEDIUM, HIGH
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    payment_intent = relationship("PaymentIntent", back_populates="risk_assessment")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=True)
    action = Column(String, nullable=False)
    status = Column(String, nullable=False)  # SUCCESS, BLOCKED, PENDING, FAILURE
    details = Column(Text, nullable=True)
    ip_address = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

class GasSponsorship(Base):
    __tablename__ = "gas_sponsorships"

    id = Column(Integer, primary_key=True, index=True)
    transaction_hash = Column(String, unique=True, index=True, nullable=False)
    sponsored_amount = Column(Float, nullable=False)  # XLM equivalent
    sponsor_address = Column(String, nullable=False)
    fee_payer = Column(String, nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

class AgentTask(Base):
    __tablename__ = "agent_tasks"

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=False)
    goal = Column(Text, nullable=False)
    status = Column(String, default="PLANNING")  # PLANNING, RUNNING, COMPLETED, FAILED
    result = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    agent = relationship("Agent", back_populates="tasks")
    tool_calls = relationship("AgentToolCall", back_populates="task")

class AgentToolCall(Base):
    __tablename__ = "agent_tool_calls"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("agent_tasks.id"), nullable=False)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=False)
    cost = Column(Float, nullable=False)
    status = Column(String, nullable=False)  # REQUESTED, 402_CHALLENGE, PAID, EXECUTED, FAILED
    response = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    task = relationship("AgentTask", back_populates="tool_calls")
    service = relationship("Service", back_populates="tool_calls")

class ApprovalRequest(Base):
    __tablename__ = "approval_requests"

    id = Column(Integer, primary_key=True, index=True)
    payment_intent_id = Column(Integer, ForeignKey("payment_intents.id"), nullable=False)
    requester_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String, default="PENDING")  # PENDING, APPROVED, REJECTED
    decider_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    decided_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    payment_intent = relationship("PaymentIntent", back_populates="approval_requests")
