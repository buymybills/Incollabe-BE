-- Add admin approval workflow for hype store proof submission (SAFE VERSION)
-- Date: 2026-04-06
-- Handles case where some columns may already exist

BEGIN;

-- Add proof_approval_status column (only if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'proof_approval_status') THEN
        CREATE TYPE proof_approval_status AS ENUM ('pending_review', 'approved', 'rejected');
    END IF;
END $$;

-- Add columns individually with existence checks
DO $$
BEGIN
    -- Add proof_approval_status
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'hype_store_orders'
                   AND column_name = 'proof_approval_status') THEN
        ALTER TABLE hype_store_orders
        ADD COLUMN proof_approval_status proof_approval_status DEFAULT 'pending_review';
    END IF;

    -- Add proof_approved_by
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'hype_store_orders'
                   AND column_name = 'proof_approved_by') THEN
        ALTER TABLE hype_store_orders
        ADD COLUMN proof_approved_by INTEGER REFERENCES admins(id) ON DELETE SET NULL;
    END IF;

    -- proof_approved_at already exists, skip it

    -- Add proof_rejection_reason
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'hype_store_orders'
                   AND column_name = 'proof_rejection_reason') THEN
        ALTER TABLE hype_store_orders
        ADD COLUMN proof_rejection_reason TEXT;
    END IF;
END $$;

-- Add indexes (drop if exists, then create)
DROP INDEX IF EXISTS idx_hype_store_orders_proof_approval_status;
CREATE INDEX idx_hype_store_orders_proof_approval_status ON hype_store_orders(proof_approval_status);

DROP INDEX IF EXISTS idx_hype_store_orders_proof_submitted_pending;
CREATE INDEX idx_hype_store_orders_proof_submitted_pending ON hype_store_orders(proof_submitted_at, proof_approval_status)
WHERE proof_submitted_at IS NOT NULL;

-- Add comments (these are safe to run multiple times)
COMMENT ON COLUMN hype_store_orders.proof_approval_status IS
  'Admin approval status for submitted proof: pending_review, approved, rejected';
COMMENT ON COLUMN hype_store_orders.proof_approved_by IS
  'Admin user ID who approved/rejected the proof';
COMMENT ON COLUMN hype_store_orders.proof_approved_at IS
  'Timestamp when proof was approved/rejected by admin';
COMMENT ON COLUMN hype_store_orders.proof_rejection_reason IS
  'Reason provided by admin if proof was rejected';

COMMIT;
