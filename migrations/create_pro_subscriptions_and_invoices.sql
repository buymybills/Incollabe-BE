-- Pro Account Subscription System
-- Rs 199 per month with invoice management

-- Subscription Status Enum
CREATE TYPE subscription_status AS ENUM (
  'active',
  'paused',
  'expired',
  'cancelled',
  'payment_pending',
  'payment_failed'
);

-- Payment Method Enum
CREATE TYPE payment_method AS ENUM (
  'razorpay',
  'manual',
  'free_trial',
  'admin_granted'
);

-- Create Pro Subscriptions Table
CREATE TABLE IF NOT EXISTS pro_subscriptions (
  id SERIAL PRIMARY KEY,
  "influencerId" INTEGER NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  status subscription_status NOT NULL DEFAULT 'payment_pending',
  "startDate" TIMESTAMP NOT NULL,
  "currentPeriodStart" TIMESTAMP NOT NULL,
  "currentPeriodEnd" TIMESTAMP NOT NULL,
  "nextBillingDate" TIMESTAMP,
  "subscriptionAmount" INTEGER NOT NULL DEFAULT 19900, -- Rs 199 in paise
  "paymentMethod" payment_method NOT NULL DEFAULT 'razorpay',
  "razorpaySubscriptionId" VARCHAR(255),
  "autoRenew" BOOLEAN DEFAULT TRUE,
  "cancelledAt" TIMESTAMP,
  "cancelReason" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT unique_active_subscription UNIQUE ("influencerId", status)
);

-- Create Invoices Table
CREATE TABLE IF NOT EXISTS pro_invoices (
  id SERIAL PRIMARY KEY,
  "invoiceNumber" VARCHAR(50) UNIQUE NOT NULL,
  "subscriptionId" INTEGER NOT NULL REFERENCES pro_subscriptions(id) ON DELETE CASCADE,
  "influencerId" INTEGER NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL, -- Amount in paise
  tax INTEGER DEFAULT 0, -- GST/Tax amount in paise
  "totalAmount" INTEGER NOT NULL, -- Total including tax
  "billingPeriodStart" TIMESTAMP NOT NULL,
  "billingPeriodEnd" TIMESTAMP NOT NULL,
  "paymentStatus" VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, paid, failed, refunded
  "razorpayOrderId" VARCHAR(255),
  "razorpayPaymentId" VARCHAR(255),
  "paymentMethod" payment_method NOT NULL DEFAULT 'razorpay',
  "paidAt" TIMESTAMP,
  "invoiceUrl" TEXT, -- S3 URL for PDF invoice
  "invoiceData" JSONB, -- Full invoice details for regeneration
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create Payment Transactions Table (for audit trail)
CREATE TABLE IF NOT EXISTS pro_payment_transactions (
  id SERIAL PRIMARY KEY,
  "invoiceId" INTEGER NOT NULL REFERENCES pro_invoices(id) ON DELETE CASCADE,
  "influencerId" INTEGER NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  "transactionType" VARCHAR(50) NOT NULL, -- payment, refund, adjustment
  amount INTEGER NOT NULL,
  "razorpayPaymentId" VARCHAR(255),
  "razorpayOrderId" VARCHAR(255),
  status VARCHAR(20) NOT NULL, -- success, failed, pending
  "paymentMethod" payment_method,
  "failureReason" TEXT,
  metadata JSONB,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_pro_subscriptions_influencer ON pro_subscriptions("influencerId");
CREATE INDEX idx_pro_subscriptions_status ON pro_subscriptions(status);
CREATE INDEX idx_pro_subscriptions_next_billing ON pro_subscriptions("nextBillingDate");
CREATE INDEX idx_pro_invoices_influencer ON pro_invoices("influencerId");
CREATE INDEX idx_pro_invoices_subscription ON pro_invoices("subscriptionId");
CREATE INDEX idx_pro_invoices_status ON pro_invoices("paymentStatus");
CREATE INDEX idx_pro_payment_transactions_invoice ON pro_payment_transactions("invoiceId");
CREATE INDEX idx_pro_payment_transactions_influencer ON pro_payment_transactions("influencerId");

-- Add comments for documentation
COMMENT ON TABLE pro_subscriptions IS 'Manages Pro Account subscriptions for influencers (Rs 199/month)';
COMMENT ON TABLE pro_invoices IS 'Invoices generated for each Pro subscription payment';
COMMENT ON TABLE pro_payment_transactions IS 'Audit trail of all payment transactions';

COMMENT ON COLUMN pro_subscriptions.status IS 'Current subscription status';
COMMENT ON COLUMN pro_subscriptions."currentPeriodStart" IS 'Start of current billing period';
COMMENT ON COLUMN pro_subscriptions."currentPeriodEnd" IS 'End of current billing period';
COMMENT ON COLUMN pro_subscriptions."nextBillingDate" IS 'Next payment due date';
COMMENT ON COLUMN pro_invoices."invoiceNumber" IS 'Unique invoice number (e.g., INV-2024-001)';
COMMENT ON COLUMN pro_invoices."invoiceUrl" IS 'S3 URL to download PDF invoice';
