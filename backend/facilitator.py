import logging
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from backend.stellar_service import StellarService

logger = logging.getLogger("zpay.facilitator")

class FacilitatorAdapter(ABC):
    @abstractmethod
    def verify_settlement(
        self,
        tx_hash: str,
        expected_receiver: str,
        expected_amount: float,
        expected_asset: str,
        expected_network: str
    ) -> Dict[str, Any]:
        """
        Verify that a payment transaction occurred and meets the criteria.
        Returns:
            Dict containing 'verified' (bool) and details or 'error'.
        """
        pass

    @abstractmethod
    def settle(
        self,
        sender_secret: str,
        receiver_public: str,
        amount: float,
        asset_code: str = "XLM",
        asset_issuer: Optional[str] = None,
        memo_text: Optional[str] = None,
        network: str = "stellar:testnet"
    ) -> Dict[str, Any]:
        """
        Submit a settlement payment to the underlying network.
        """
        pass

class StellarFacilitatorAdapter(FacilitatorAdapter):
    def __init__(self):
        self.stellar_service = StellarService()

    def verify_settlement(
        self,
        tx_hash: str,
        expected_receiver: str,
        expected_amount: float,
        expected_asset: str,
        expected_network: str
    ) -> Dict[str, Any]:
        logger.info(f"[StellarFacilitator] Verifying transaction {tx_hash} on network {expected_network}")
        
        # Check network
        if expected_network != "stellar:testnet":
            return {
                "verified": False,
                "error": f"Network {expected_network} is not supported by StellarFacilitatorAdapter."
            }

        # Query Stellar Horizon via stellar_service
        return self.stellar_service.verify_payment_on_chain(
            tx_hash=tx_hash,
            expected_receiver=expected_receiver,
            expected_amount=expected_amount,
            expected_asset_code=expected_asset
        )

    def settle(
        self,
        sender_secret: str,
        receiver_public: str,
        amount: float,
        asset_code: str = "XLM",
        asset_issuer: Optional[str] = None,
        memo_text: Optional[str] = None,
        network: str = "stellar:testnet"
    ) -> Dict[str, Any]:
        logger.info(f"[StellarFacilitator] Submitting payment of {amount} {asset_code} to {receiver_public} on network {network}")
        
        if network != "stellar:testnet":
            return {
                "success": False,
                "error": f"Unsupported network {network} for Stellar settlement."
            }
            
        return self.stellar_service.submit_payment(
            sender_secret=sender_secret,
            receiver_public=receiver_public,
            amount=amount,
            asset_code=asset_code,
            asset_issuer=asset_issuer,
            memo_text=memo_text
        )

class DemoFacilitatorAdapter(FacilitatorAdapter):
    """
    Demo adapter that simulates settlement without touching the blockchain.
    Visibly tags transactions as SIMULATED_SETTLEMENT.
    """
    def verify_settlement(
        self,
        tx_hash: str,
        expected_receiver: str,
        expected_amount: float,
        expected_asset: str,
        expected_network: str
    ) -> Dict[str, Any]:
        logger.warning(f"[DemoFacilitator] Verifying simulated transaction: {tx_hash}")
        if tx_hash.startswith("sim_tx_"):
            return {
                "verified": True,
                "tx_hash": tx_hash,
                "sender": "sim_sender_address_demo_mode",
                "receiver": expected_receiver,
                "amount": expected_amount,
                "asset": expected_asset,
                "network": expected_network,
                "status": "SIMULATED_SETTLEMENT",
                "created_at": "SIMULATED_TIME"
            }
        return {
            "verified": False,
            "error": "Not a valid simulation hash. Transaction not found in demo registry."
        }

    def settle(
        self,
        sender_secret: str,
        receiver_public: str,
        amount: float,
        asset_code: str = "XLM",
        asset_issuer: Optional[str] = None,
        memo_text: Optional[str] = None,
        network: str = "stellar:testnet"
    ) -> Dict[str, Any]:
        import uuid
        sim_hash = f"sim_tx_{str(uuid.uuid4()).replace('-', '')}"
        logger.warning(f"[DemoFacilitator] Creating simulated transaction: {sim_hash}")
        return {
            "success": True,
            "tx_hash": sim_hash,
            "ledger": 0,
            "fee_charged": 0,
            "status": "SIMULATED_SETTLEMENT"
        }
