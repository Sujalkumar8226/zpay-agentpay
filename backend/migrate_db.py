import os
import shutil
import logging
import sqlite3
from backend.database import engine, Base
# Import models to register them with SQLAlchemy Base
from backend.models import User, Wallet, Agent, AgentPolicy, Service, ServiceProvider, PaymentIntent, Transaction, Escrow, EscrowDispute, UPISettlement, GroupSplit, GroupSplitMember, RiskAssessment, AuditLog, GasSponsorship, AgentTask, AgentToolCall, ApprovalRequest

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("zpay.migration")

def run_migration():
    db_file = "zpay.db"
    
    # 1. Perform a backup before doing raw SQLite changes
    if os.path.exists(db_file):
        bak_file = f"{db_file}.bak"
        if not os.path.exists(bak_file):
            logger.info(f"Creating a rollback backup at {bak_file}...")
            try:
                shutil.copy2(db_file, bak_file)
                logger.info("Backup created successfully.")
            except Exception as e:
                logger.error(f"Failed to create database backup: {str(e)}")
        else:
            logger.info(f"Rollback backup {bak_file} already exists. Leaving it untouched.")

    # 2. Run standard SQLAlchemy create_all to ensure payment_intents table is instantiated
    logger.info("Instantiating newly added tables via SQLAlchemy metadata...")
    Base.metadata.create_all(bind=engine)

    # 3. Idempotently add missing payment_intent_id columns to existing tables
    if os.path.exists(db_file):
        logger.info("Applying SQLite table alterations for payment_intent_id columns...")
        try:
            conn = sqlite3.connect(db_file)
            cursor = conn.cursor()
            
            # Idempotently alter columns
            for table in ["approval_requests", "upi_settlements", "risk_assessments"]:
                cursor.execute(f"PRAGMA table_info({table})")
                columns = [col[1] for col in cursor.fetchall()]
                if "payment_intent_id" not in columns:
                    logger.info(f"Adding payment_intent_id column to {table}...")
                    cursor.execute(f"ALTER TABLE {table} ADD COLUMN payment_intent_id INTEGER")
                    conn.commit()
                else:
                    logger.info(f"Column payment_intent_id already exists in {table}.")

            # 4. Migrate relationship IDs mapping payments -> payment_intents using challenge nonce
            logger.info("Migrating legacy payment relationship maps to payment_intent maps...")
            
            # A. approval_requests
            cursor.execute("SELECT id, payment_id FROM approval_requests WHERE payment_intent_id IS NULL")
            to_update = cursor.fetchall()
            for req_id, p_id in to_update:
                if p_id:
                    cursor.execute("SELECT challenge FROM payments WHERE id = ?", (p_id,))
                    p_res = cursor.fetchone()
                    if p_res:
                        challenge = p_res[0]
                        cursor.execute("SELECT id FROM payment_intents WHERE challenge = ?", (challenge,))
                        pi_res = cursor.fetchone()
                        if pi_res:
                            pi_id = pi_res[0]
                            cursor.execute("UPDATE approval_requests SET payment_intent_id = ? WHERE id = ?", (pi_id, req_id))
            
            # B. upi_settlements
            cursor.execute("SELECT id, payment_id FROM upi_settlements WHERE payment_intent_id IS NULL")
            to_update = cursor.fetchall()
            for upi_id, p_id in to_update:
                if p_id:
                    cursor.execute("SELECT challenge FROM payments WHERE id = ?", (p_id,))
                    p_res = cursor.fetchone()
                    if p_res:
                        challenge = p_res[0]
                        cursor.execute("SELECT id FROM payment_intents WHERE challenge = ?", (challenge,))
                        pi_res = cursor.fetchone()
                        if pi_res:
                            pi_id = pi_res[0]
                            cursor.execute("UPDATE upi_settlements SET payment_intent_id = ? WHERE id = ?", (pi_id, upi_id))

            # C. risk_assessments
            cursor.execute("SELECT id, payment_id FROM risk_assessments WHERE payment_intent_id IS NULL")
            to_update = cursor.fetchall()
            for risk_id, p_id in to_update:
                if p_id:
                    cursor.execute("SELECT challenge FROM payments WHERE id = ?", (p_id,))
                    p_res = cursor.fetchone()
                    if p_res:
                        challenge = p_res[0]
                        cursor.execute("SELECT id FROM payment_intents WHERE challenge = ?", (challenge,))
                        pi_res = cursor.fetchone()
                        if pi_res:
                            pi_id = pi_res[0]
                            cursor.execute("UPDATE risk_assessments SET payment_intent_id = ? WHERE id = ?", (pi_id, risk_id))

            conn.commit()
            conn.close()
            logger.info("Idempotent schema changes and data migration completed successfully.")
        except Exception as e:
            logger.error(f"Failed schema migration: {str(e)}")
            raise e
    else:
        logger.warning(f"Database file {db_file} not found; skipping column migrations.")

if __name__ == "__main__":
    run_migration()
