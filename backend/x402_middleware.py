import uuid
import base64
import json
import logging
import time
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
from functools import wraps
from fastapi import Request, Response, HTTPException, Depends
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import PaymentIntent, Service, ServiceProvider, User, Wallet
from backend.facilitator import StellarFacilitatorAdapter, DemoFacilitatorAdapter

# Logger
logger = logging.getLogger("zpay.x402")
logger.setLevel(logging.INFO)

def get_base_url(request: Request) -> str:
    """Helper to reconstruct base URL of the request."""
    url = request.url
    port_str = f":{url.port}" if url.port else ""
    return f"{url.scheme}://{url.hostname}{port_str}"

def x402_payment_required(service_name: str, category: str, default_price: float, asset: str = "XLM"):
    """
    FastAPI decorator to protect an endpoint with the x402 Payment Required protocol.
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # We assume the first argument is request, or lookup in kwargs
            request: Request = kwargs.get("request")
            if not request:
                for arg in args:
                    if isinstance(arg, Request):
                        request = arg
                        break
            
            if not request:
                raise HTTPException(status_code=500, detail="FastAPI Request object not found in endpoint arguments")

            # Extract DB session
            db: Session = kwargs.get("db")
            if not db:
                for arg in args:
                    if isinstance(arg, Session):
                        db = arg
                        break
            if not db:
                from backend.database import SessionLocal
                db = SessionLocal()
                should_close_db = True
            else:
                should_close_db = False

            try:
                # Find or create the service in database
                service = db.query(Service).filter(Service.name == service_name).first()
                
                # Helper function to get or create provider wallet
                def get_provider_wallet(prov):
                    w = db.query(Wallet).filter(Wallet.user_id == prov.user_id).first()
                    if not w or not w.public_key:
                        try:
                            u = db.query(User).filter(User.id == prov.user_id).first()
                            if not u:
                                u = User(
                                    id=prov.user_id,
                                    email=f"provider_{prov.id}@zpay.network",
                                    password_hash="simulated_pass",
                                    pin_hash="simulated_pin",
                                    role="developer"
                                )
                                db.add(u)
                                db.commit()
                                db.refresh(u)
                            from backend.stellar_service import StellarService
                            stellar_service = StellarService()
                            keys = stellar_service.generate_keypair()
                            w = Wallet(
                                user_id=prov.user_id,
                                public_key=keys["public_key"],
                                encrypted_private_key="simulated_key",
                                zpay_id=f"provider_{prov.id}@Zp",
                                label="Primary Stellar Wallet",
                                type="custodial"
                            )
                            db.add(w)
                            db.commit()
                            db.refresh(w)
                        except Exception as e:
                            logger.error(f"Failed to auto-create provider wallet: {str(e)}")
                            w = None
                    return w

                if service:
                    wallet = get_provider_wallet(service.provider)
                    if not wallet or not wallet.public_key:
                        raise HTTPException(
                            status_code=500,
                            detail="Service provider has no valid Stellar wallet configured"
                        )
                    if service.address == "GBBD47NESK5CX7D7RMM6YW7QD66JHBIZ4KCO62D2CBEEOCOZAFSU7G3O" or service.address != wallet.public_key:
                        logger.info(f"Updating service '{service_name}' address to actual wallet: {wallet.public_key}")
                        service.address = wallet.public_key
                        db.commit()
                        db.refresh(service)
                else:
                    provider = db.query(ServiceProvider).first()
                    if not provider:
                        admin_user = db.query(User).filter(User.role == "admin").first()
                        provider_user_id = admin_user.id if admin_user else 1
                        provider = ServiceProvider(user_id=provider_user_id, name="Default Developer Inc.", balance=0.0)
                        db.add(provider)
                        db.commit()
                        db.refresh(provider)
                    
                    wallet = get_provider_wallet(provider)
                    if not wallet or not wallet.public_key:
                        raise HTTPException(
                            status_code=500,
                            detail="Service provider has no valid Stellar wallet configured"
                        )
                    
                    service = Service(
                        provider_id=provider.id,
                        name=service_name,
                        description=f"Paid {service_name} endpoint protected by x402",
                        price=default_price,
                        category=category,
                        url=str(request.url),
                        network="stellar:testnet",
                        asset=asset,
                        address=wallet.public_key,
                        is_active=True
                    )
                    db.add(service)
                    db.commit()
                    db.refresh(service)

                # Check headers for PAYMENT-SIGNATURE
                payment_sig_b64 = request.headers.get("PAYMENT-SIGNATURE")
                
                if not payment_sig_b64:
                    return trigger_402_challenge(db, service, request)

                try:
                    sig_data = json.loads(base64.b64decode(payment_sig_b64.encode('utf-8')).decode('utf-8'))
                    tx_hash = sig_data.get("transactionHash")
                    challenge = sig_data.get("challenge")
                    
                    if not tx_hash or not challenge:
                        logger.warning("PAYMENT-SIGNATURE missing transactionHash or challenge")
                        return trigger_402_challenge(db, service, request, error_msg="Invalid signature header format")

                except Exception as e:
                    logger.error(f"Error parsing PAYMENT-SIGNATURE header: {str(e)}")
                    return trigger_402_challenge(db, service, request, error_msg="Malformed signature header")

                # Look up the PaymentIntent record
                from backend.payment_intent import PaymentIntentManager
                payment = PaymentIntentManager.get_by_challenge(db, challenge)
                if not payment:
                    return trigger_402_challenge(db, service, request, error_msg="Unknown payment challenge")

                # Replay protection: check if this transaction hash has already been used for another successful payment
                existing_payment = db.query(PaymentIntent).filter(
                    PaymentIntent.tx_hash == tx_hash,
                    PaymentIntent.challenge != challenge,
                    PaymentIntent.status.in_(["RESOURCE_UNLOCKED", "COMPLETED"])
                ).first()
                if existing_payment:
                    logger.warning(f"Replay attack detected: tx_hash {tx_hash} already used in payment intent {existing_payment.id}")
                    return trigger_402_challenge(db, service, request, error_msg="Replay attack detected: transaction hash already used")

                if payment.expires_at < datetime.utcnow():
                    if payment.status not in ["FAILED", "EXPIRED", "CANCELLED", "DENIED", "COMPLETED", "RESOURCE_UNLOCKED"]:
                        PaymentIntentManager.transition(db, payment, "EXPIRED")
                    return trigger_402_challenge(db, service, request, error_msg="Payment challenge expired")

                # Check if already verified
                if payment.status in ["RESOURCE_UNLOCKED", "COMPLETED"]:
                    response = await func(*args, **kwargs)
                    
                    resp_data = {
                        "status": "settled",
                        "transactionHash": payment.tx_hash,
                        "amount": payment.amount,
                        "asset": payment.asset,
                        "network": payment.network
                    }
                    resp_b64 = base64.b64encode(json.dumps(resp_data).encode('utf-8')).decode('utf-8')
                    from fastapi.responses import JSONResponse
                    if not isinstance(response, Response):
                        response = JSONResponse(content=response)
                    response.headers["PAYMENT-RESPONSE"] = resp_b64
                    return response

                # Verify that the intent is in a state where we can verify payment
                if payment.status not in ["PAYMENT_REQUIRED", "POLICY_CHECK", "RISK_CHECK", "AUTHORIZED", "SUBMITTED", "VERIFYING"]:
                    return trigger_402_challenge(db, service, request, error_msg=f"PaymentIntent status is {payment.status}. Cryptographic authorization signature is required on-chain.")

                # Run verification via facilitator adapter
                PaymentIntentManager.transition(db, payment, "VERIFYING")

                if tx_hash.startswith("sim_tx_"):
                    facilitator = DemoFacilitatorAdapter()
                else:
                    facilitator = StellarFacilitatorAdapter()

                # Run verification via facilitator adapter with up to 2 retries for Horizon consensus lag
                verification = {"verified": False, "error": "Not started"}
                for attempt in range(2):
                    verification = facilitator.verify_settlement(
                        tx_hash=tx_hash,
                        expected_receiver=payment.destination,
                        expected_amount=payment.amount,
                        expected_asset=payment.asset,
                        expected_network=payment.network
                    )
                    if verification.get("verified"):
                        break
                    
                    err_msg = str(verification.get("error")).lower()
                    if "not found" in err_msg or "404" in err_msg:
                        logger.info(f"Stellar Horizon indexing lag detected. Retry attempt {attempt + 1}/2...")
                        time.sleep(0.5)
                    else:
                        break

                if verification.get("verified"):
                    # Transition to VERIFIED and RESOURCE_UNLOCKED
                    PaymentIntentManager.transition(db, payment, "VERIFIED", tx_hash=tx_hash, settlement_ref=tx_hash)
                    PaymentIntentManager.transition(db, payment, "RESOURCE_UNLOCKED")
                    
                    # Credit provider balance
                    service.provider.balance += payment.amount
                    service.calls_count += 1
                    
                    if payment.agent_id:
                        from backend.models import AuditLog
                        audit_log = AuditLog(
                            agent_id=payment.agent_id,
                            action=f"Payment for {service.name}",
                            status="SUCCESS",
                            details=f"Paid {payment.amount} {payment.asset} verified via Facilitator. Tx Hash: {tx_hash}"
                        )
                        db.add(audit_log)
                    
                    db.commit()

                    # Execute the original endpoint function
                    response = await func(*args, **kwargs)

                    # Transition to COMPLETED
                    PaymentIntentManager.transition(db, payment, "COMPLETED")

                    # Add success header
                    resp_data = {
                        "status": "settled",
                        "transactionHash": tx_hash,
                        "amount": payment.amount,
                        "asset": payment.asset,
                        "network": payment.network
                    }
                    resp_b64 = base64.b64encode(json.dumps(resp_data).encode('utf-8')).decode('utf-8')
                    from fastapi.responses import JSONResponse
                    if not isinstance(response, Response):
                        response = JSONResponse(content=response)
                    response.headers["PAYMENT-RESPONSE"] = resp_b64
                    return response
                else:
                    PaymentIntentManager.transition(db, payment, "FAILED", error_message=verification.get("error"))
                    return trigger_402_challenge(
                        db, service, request, 
                        error_msg=f"Stellar payment verification failed: {verification.get('error')}"
                    )

            finally:
                if should_close_db:
                    db.close()

        return wrapper
    return decorator

def trigger_402_challenge(db: Session, service: Service, request: Request, error_msg: Optional[str] = None) -> Response:
    """Helper to return an HTTP 402 Payment Required response with x402 headers."""
    challenge_nonce = str(uuid.uuid4())
    
    agent_id = None
    agent_id_hdr = request.headers.get("X-AGENT-ID")
    if agent_id_hdr:
        try:
            agent_id = int(agent_id_hdr)
        except Exception:
            pass

    # Save payment challenge record in DB using PaymentIntentManager
    from backend.payment_intent import PaymentIntentManager
    payment = PaymentIntentManager.create_intent(
        db=db,
        agent_id=agent_id,
        user_id=None,
        task_id=None,
        service_id=service.id,
        amount=service.price,
        asset=service.asset,
        network=service.network,
        destination=service.address,
        challenge=challenge_nonce
    )
    PaymentIntentManager.transition(db, payment, "PAYMENT_REQUIRED")

    # Construct the x402 v2 PAYMENT-REQUIRED payload
    required_payload = {
        "x402Version": 2,
        "resource": {
            "url": str(request.url),
            "description": service.description
        },
        "accepts": [
            {
                "scheme": "exact",
                "network": service.network,  # e.g. stellar:testnet
                "amount": f"{service.price:.3f}",
                "asset": service.asset,
                "payTo": service.address,
                "maxTimeoutSeconds": 120,
                "challenge": challenge_nonce
            }
        ]
    }
    
    payload_b64 = base64.b64encode(json.dumps(required_payload).encode('utf-8')).decode('utf-8')
    
    response_body = {
        "detail": error_msg or "Payment Required to access this resource",
        "paymentRequiredHeader": payload_b64
    }

    response = Response(
        content=json.dumps(response_body),
        status_code=402,
        media_type="application/json"
    )
    response.headers["PAYMENT-REQUIRED"] = payload_b64
    return response
