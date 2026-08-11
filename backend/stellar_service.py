import time
import logging
import requests
from typing import Optional, Dict, Any
from stellar_sdk import Server, Keypair, Network, TransactionBuilder, Asset
from stellar_sdk.exceptions import NotFoundError

# Configure logger
logger = logging.getLogger("zpay.stellar")
logger.setLevel(logging.INFO)

HORIZON_URL = "https://horizon-testnet.stellar.org"
NETWORK_PASSPHRASE = "Test SDF Network ; September 2015"

class StellarService:
    def __init__(self):
        self.server = Server(HORIZON_URL)
        # In a real environment, this sponsor secret would come from secure env
        # For our testnet hackathon demo, we generate a master fee sponsor account or fund one
        self.sponsor_secret = "SA7Z2U3RNDQLWJHYR2U3ZPAYSPONSORTESTNET2026KEYEXAMPLE" 
        # Note: In mock/demo mode we'll use a local mock or a real funded testnet key

    def generate_keypair(self) -> Dict[str, str]:
        """Generate a random Stellar keypair."""
        kp = Keypair.random()
        return {
            "public_key": kp.public_key,
            "secret_key": kp.secret
        }

    def fund_with_friendbot(self, public_key: str) -> bool:
        """Fund a testnet wallet with Friendbot."""
        try:
            url = f"https://friendbot.stellar.org?addr={public_key}"
            res = requests.get(url, timeout=10)
            if res.status_code == 200:
                logger.info(f"Successfully funded {public_key} via Friendbot")
                return True
            elif "already funded" in res.text:
                logger.info(f"Account {public_key} is already funded")
                return True
            else:
                logger.error(f"Friendbot funding failed for {public_key}: {res.text}")
                return False
        except Exception as e:
            logger.error(f"Error calling Friendbot for {public_key}: {str(e)}")
            return False

    def get_balances(self, public_key: str) -> Dict[str, float]:
        """Fetch balances for an account. Auto-funds if not found in testnet."""
        try:
            account = self.server.accounts().account_id(public_key).call()
            balances = {}
            for balance in account.get("balances", []):
                asset_type = balance.get("asset_type")
                asset_code = "XLM" if asset_type == "native" else balance.get("asset_code")
                balances[asset_code] = float(balance.get("balance", 0.0))
            return balances
        except NotFoundError:
            # If account does not exist in testnet, fund it automatically to make demo smooth
            logger.info(f"Account {public_key} not found, funding via Friendbot...")
            funded = self.fund_with_friendbot(public_key)
            if funded:
                # Wait 2 seconds for Horizon to index
                time.sleep(2)
                try:
                    account = self.server.accounts().account_id(public_key).call()
                    balances = {}
                    for balance in account.get("balances", []):
                        asset_type = balance.get("asset_type")
                        asset_code = "XLM" if asset_type == "native" else balance.get("asset_code")
                        balances[asset_code] = float(balance.get("balance", 0.0))
                    return balances
                except Exception:
                    pass
            return {"XLM": 0.0, "USDC": 0.0}
        except Exception as e:
            logger.error(f"Error fetching balances for {public_key}: {str(e)}")
            return {"XLM": 0.0, "USDC": 0.0}

    def submit_payment(
        self,
        sender_secret: str,
        receiver_public: str,
        amount: float,
        asset_code: str = "XLM",
        asset_issuer: Optional[str] = None,
        sponsor_secret: Optional[str] = None,
        memo_text: Optional[str] = None
    ) -> Dict[str, Any]:
        """Build, sign, and submit a Stellar payment transaction."""
        try:
            sender_kp = Keypair.from_secret(sender_secret)
            sender_public = sender_kp.public_key

            # Determine fee source and builder source account
            fee_payer_kp = Keypair.from_secret(sponsor_secret) if sponsor_secret else sender_kp
            
            # Load account details
            # We load the fee payer account to get its sequence number
            fee_payer_account = self.server.load_account(fee_payer_kp.public_key)

            # Define asset
            if asset_code == "XLM":
                asset = Asset.native()
            else:
                asset = Asset(asset_code, asset_issuer)

            # Build transaction
            tb = TransactionBuilder(
                source_account=fee_payer_account,
                network_passphrase=NETWORK_PASSPHRASE,
                base_fee=100
            )

            # If sponsored, fee payer is different from sender, so we append the payment op with sender as source
            op_source = sender_public if sponsor_secret else None
            tb.append_payment_op(
                destination=receiver_public,
                amount=str(amount),
                asset=asset,
                source=op_source
            )

            if memo_text:
                tb.add_text_memo(memo_text)

            tb.set_timeout(30)
            tx = tb.build()

            # Sign transaction
            # Sender signs (authenticating the payment operation)
            tx.sign(sender_kp)
            # Fee payer signs (authenticating fee payment and sequence number)
            if sponsor_secret and fee_payer_kp.public_key != sender_public:
                tx.sign(fee_payer_kp)

            # Submit transaction
            response = self.server.submit_transaction(tx)
            return {
                "success": True,
                "tx_hash": response.get("hash"),
                "ledger": response.get("ledger"),
                "fee_charged": response.get("fee_charged", 100)
            }

        except Exception as e:
            logger.error(f"Stellar payment failed: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

    def verify_payment_on_chain(
        self,
        tx_hash: str,
        expected_receiver: str,
        expected_amount: float,
        expected_asset_code: str = "XLM"
    ) -> Dict[str, Any]:
        """Verify that a transaction occurred on Stellar testnet and meets requirements."""
        try:
            tx = self.server.transactions().transaction(tx_hash).call()
            # Fetch operations in this transaction
            ops = self.server.operations().for_transaction(tx_hash).call()
            
            for op in ops.get("_embedded", {}).get("records", []):
                if op.get("type") == "payment":
                    to_addr = op.get("to")
                    amount = float(op.get("amount", 0.0))
                    
                    asset_type = op.get("asset_type")
                    asset_code = "XLM" if asset_type == "native" else op.get("asset_code")

                    # Check receiver, amount and asset
                    # Note: We do a case-insensitive check and allow slight roundoff or matching
                    if (to_addr == expected_receiver and 
                        abs(amount - expected_amount) < 0.0001 and 
                        asset_code == expected_asset_code):
                        
                        return {
                            "verified": True,
                            "tx_hash": tx_hash,
                            "sender": op.get("from"),
                            "receiver": to_addr,
                            "amount": amount,
                            "asset": asset_code,
                            "created_at": tx.get("created_at")
                        }
            
            return {
                "verified": False,
                "error": "Payment transaction found, but operation details (recipient, amount, or asset) did not match."
            }
        except NotFoundError:
            return {
                "verified": False,
                "error": "Transaction hash not found on-chain."
            }
        except Exception as e:
            logger.error(f"Error verifying transaction {tx_hash}: {str(e)}")
            return {
                "verified": False,
                "error": f"Verification failed: {str(e)}"
            }
