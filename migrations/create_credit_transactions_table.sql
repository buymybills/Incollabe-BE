-- Create credit_transactions table to track all credit awards and payments
-- This helps admins maintain records of money owed to influencers

CREATE TYPE credit_transaction_type AS ENUM (
  'referral_bonus',
  'early_selection_bonus',
  'campaign_payment',
  'admin_adjustment',
  'refund'
);

CREATE TYPE payment_status AS ENUM (
  'pending',
  'processing',
  'paid',
  'failed',
  'cancelled'
);

CREATE TABLE credit_transactions (
  id SERIAL PRIMARY KEY,
  "influencerId" INTEGER NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  "transactionType" credit_transaction_type NOT NULL,
  amount INTEGER NOT NULL,
  "paymentStatus" payment_status NOT NULL DEFAULT 'pending',
  description TEXT,
  "campaignId" INTEGER,
  "referredUserId" INTEGER,
  "upiId" VARCHAR(255),
  "paymentReferenceId" VARCHAR(255),
  "paidAt" TIMESTAMP,
  "processedBy" INTEGER REFERENCES admins(id),
  "adminNotes" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX idx_credit_transactions_influencer ON credit_transactions("influencerId");
CREATE INDEX idx_credit_transactions_status ON credit_transactions("paymentStatus");
CREATE INDEX idx_credit_transactions_type ON credit_transactions("transactionType");
CREATE INDEX idx_credit_transactions_created ON credit_transactions("createdAt");

-- Add comments
COMMENT ON TABLE credit_transactions IS 'Tracks all credit transactions for influencers including bonuses and payments';
COMMENT ON COLUMN credit_transactions.amount IS 'Amount in Rs';
COMMENT ON COLUMN credit_transactions."campaignId" IS 'Campaign ID if transaction is related to a campaign';
COMMENT ON COLUMN credit_transactions."referredUserId" IS 'Referred user ID if this is a referral bonus';
COMMENT ON COLUMN credit_transactions."processedBy" IS 'Admin who processed the payment';
