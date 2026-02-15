-- =====================================================
-- Idempotency + Retention Hardening (100k+ readiness)
-- Date: 2026-02-15
-- Safe to run multiple times (IF NOT EXISTS used)
-- =====================================================

-- 1) Idempotency table for processed on-chain signatures
CREATE TABLE IF NOT EXISTS processed_signatures (
  signature TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  user_address TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_processed_signatures_type ON processed_signatures(type);
CREATE INDEX IF NOT EXISTS idx_processed_signatures_user ON processed_signatures(user_address);

-- 2) Make on-chain transaction signatures unique (if present)
-- transactions.signature already exists; add a partial UNIQUE index
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='transactions' AND column_name='signature'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS uniq_transactions_signature ON transactions(signature) WHERE signature IS NOT NULL';
  END IF;
END $$;

-- 3) Ensure gold_sales tx_signature uniqueness if the table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='gold_sales') THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='gold_sales' AND column_name='tx_signature'
    ) THEN
      EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS uniq_gold_sales_tx_signature ON gold_sales(tx_signature) WHERE tx_signature IS NOT NULL';
    END IF;
  END IF;
END $$;

-- 4) Strengthen referral uniqueness (optional)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='referrals') THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS uniq_referrals_pair ON referrals(referrer_address, referred_address)';
  END IF;
END $$;

-- 5) Cleanup helpers (run manually or via admin utility)
-- Expired referral visits
-- DELETE FROM referral_visits WHERE expires_at IS NOT NULL AND expires_at < NOW();
-- Old admin logs
-- DELETE FROM admin_logs WHERE created_at < NOW() - INTERVAL ''90 days'';
-- Old transactions
-- DELETE FROM transactions WHERE created_at < NOW() - INTERVAL ''180 days'';
