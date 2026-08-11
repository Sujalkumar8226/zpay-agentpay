import os
import base64
from typing import Optional
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

# Cryptography config
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT config
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "zpay_super_secret_jwt_key_for_hackathon_2026")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 1 day

# Master Wallet Encryption Key (AES-256-GCM requires 32 bytes)
# Upgrade to fail-fast configuration checks (no silent fallback in production)
MASTER_KEY_ENV = os.getenv("MASTER_ENCRYPTION_KEY")
if not MASTER_KEY_ENV:
    raise ValueError(
        "CRITICAL CONFIGURATION ERROR: The 'MASTER_ENCRYPTION_KEY' environment variable is not defined. "
        "For security compliance, ZPay requires an explicit master encryption key initialization."
    )

try:
    MASTER_KEY = base64.b64decode(MASTER_KEY_ENV)
    if len(MASTER_KEY) != 32:
        import hashlib
        MASTER_KEY = hashlib.sha256(MASTER_KEY_ENV.encode()).digest()
except Exception:
    import hashlib
    MASTER_KEY = hashlib.sha256(MASTER_KEY_ENV.encode()).digest()

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def hash_pin(pin: str) -> str:
    return pwd_context.hash(pin)

def verify_pin(plain_pin: str, hashed_pin: str) -> bool:
    return pwd_context.verify(plain_pin, hashed_pin)

# AES-256-GCM encryption
def encrypt_private_key(private_key: str) -> str:
    aesgcm = AESGCM(MASTER_KEY)
    nonce = os.urandom(12)
    ciphertext = aesgcm.encrypt(nonce, private_key.encode(), None)
    # Combine nonce and ciphertext as base64
    combined = nonce + ciphertext
    return base64.b64encode(combined).decode('utf-8')

# AES-256-GCM decryption
def decrypt_private_key(encrypted_key_b64: str) -> str:
    combined = base64.b64decode(encrypted_key_b64.encode('utf-8'))
    nonce = combined[:12]
    ciphertext = combined[12:]
    aesgcm = AESGCM(MASTER_KEY)
    decrypted_bytes = aesgcm.decrypt(nonce, ciphertext, None)
    return decrypted_bytes.decode('utf-8')

# JWT helper
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None
