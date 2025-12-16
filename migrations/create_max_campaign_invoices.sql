-- Create Max Campaign Invoices table
-- This table stores invoices for Max Campaign upgrade payments

CREATE TABLE IF NOT EXISTS max_campaign_invoices (
  id SERIAL PRIMARY KEY,
  "invoiceNumber" VARCHAR(50) NOT NULL UNIQUE,
  "campaignId" INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  "brandId" INTEGER NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  tax INTEGER DEFAULT 0,
  "totalAmount" INTEGER NOT NULL,
  "paymentStatus" VARCHAR(20) NOT NULL DEFAULT 'pending',
  "paymentMethod" payment_method NOT NULL DEFAULT 'razorpay',
  "razorpayOrderId" VARCHAR(255),
  "razorpayPaymentId" VARCHAR(255),
  "paidAt" TIMESTAMP,
  "invoiceUrl" TEXT,
  "invoiceData" JSONB,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_max_campaign_invoices_campaign ON max_campaign_invoices("campaignId");
CREATE INDEX IF NOT EXISTS idx_max_campaign_invoices_brand ON max_campaign_invoices("brandId");
CREATE INDEX IF NOT EXISTS idx_max_campaign_invoices_status ON max_campaign_invoices("paymentStatus");

-- Add comments
COMMENT ON TABLE max_campaign_invoices IS 'Invoices for Max Campaign upgrade payments (Rs 299)';
COMMENT ON COLUMN max_campaign_invoices."invoiceNumber" IS 'Unique invoice number (e.g., MAXINV-202511-00001)';
COMMENT ON COLUMN max_campaign_invoices.amount IS 'Base amount in paise (29900 = Rs 299)';
COMMENT ON COLUMN max_campaign_invoices.tax IS 'Tax amount in paise';
COMMENT ON COLUMN max_campaign_invoices."totalAmount" IS 'Total amount including tax in paise';
COMMENT ON COLUMN max_campaign_invoices."paymentStatus" IS 'Payment status: pending, paid, failed';
COMMENT ON COLUMN max_campaign_invoices."invoiceUrl" IS 'S3 URL of the PDF invoice';
COMMENT ON COLUMN max_campaign_invoices."invoiceData" IS 'JSON data used to generate the PDF invoice';
