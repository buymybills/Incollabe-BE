-- Add admin approval workflow for hype store proof submission
-- Date: 2026-04-04

BEGIN;

-- Add proof approval status
CREATE TYPE proof_approval_status AS ENUM ('pending_review', 'approved', 'rejected');

ALTER TABLE hype_store_orders
ADD COLUMN proof_approval_status proof_approval_status DEFAULT 'pending_review',
ADD COLUMN proof_approved_by INTEGER REFERENCES admins(id) ON DELETE SET NULL,
ADD COLUMN proof_approved_at TIMESTAMP,
ADD COLUMN proof_rejection_reason TEXT;

-- Add index for admin queries
CREATE INDEX idx_hype_store_orders_proof_approval_status ON hype_store_orders(proof_approval_status);
CREATE INDEX idx_hype_store_orders_proof_submitted_pending ON hype_store_orders(proof_submitted_at, proof_approval_status)
WHERE proof_submitted_at IS NOT NULL;

-- Add comments
COMMENT ON COLUMN hype_store_orders.proof_approval_status IS
  'Admin approval status for submitted proof: pending_review, approved, rejected';
COMMENT ON COLUMN hype_store_orders.proof_approved_by IS
  'Admin user ID who approved/rejected the proof';
COMMENT ON COLUMN hype_store_orders.proof_approved_at IS
  'Timestamp when proof was approved/rejected by admin';
COMMENT ON COLUMN hype_store_orders.proof_rejection_reason IS
  'Reason provided by admin if proof was rejected';

COMMIT;
