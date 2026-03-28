-- Migration: Add Post Boost Invoice System
-- Description: Adds invoice tracking and payment fields for post boost feature
-- Date: 2026-03-20

-- Add new payment tracking columns to posts table
ALTER TABLE posts ADD COLUMN IF NOT EXISTS "boostOrderId" VARCHAR(255);
ALTER TABLE posts ADD COLUMN IF NOT EXISTS "boostPaymentStatus" VARCHAR(50);

-- Add comments to new columns
COMMENT ON COLUMN posts."boostOrderId" IS 'Razorpay order ID for tracking the boost payment';
COMMENT ON COLUMN posts."boostPaymentStatus" IS 'Current status of boost payment (pending/paid/failed)';

-- Create post_boost_invoices table
CREATE TABLE IF NOT EXISTS post_boost_invoices (
  id SERIAL PRIMARY KEY,
  "invoiceNumber" VARCHAR(255) UNIQUE,
  "postId" INTEGER NOT NULL,
  "userType" VARCHAR(20) NOT NULL CHECK ("userType" IN ('influencer', 'brand')),
  "brandId" INTEGER,
  "influencerId" INTEGER,
  amount INTEGER NOT NULL,
  tax INTEGER DEFAULT 0,
  cgst INTEGER DEFAULT 0,
  sgst INTEGER DEFAULT 0,
  igst INTEGER DEFAULT 0,
  "totalAmount" INTEGER NOT NULL,
  "paymentStatus" VARCHAR(20) DEFAULT 'pending' CHECK ("paymentStatus" IN ('pending', 'paid', 'failed')),
  "paymentMethod" VARCHAR(20) CHECK ("paymentMethod" IN ('razorpay', 'upi', 'card', 'netbanking')),
  "razorpayOrderId" VARCHAR(255),
  "razorpayPaymentId" VARCHAR(255),
  "paidAt" TIMESTAMP WITH TIME ZONE,
  "invoiceUrl" VARCHAR(500),
  "invoiceData" JSONB,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Foreign key constraints
  CONSTRAINT fk_post_boost_invoice_post FOREIGN KEY ("postId") REFERENCES posts(id) ON DELETE CASCADE,
  CONSTRAINT fk_post_boost_invoice_brand FOREIGN KEY ("brandId") REFERENCES brands(id) ON DELETE SET NULL,
  CONSTRAINT fk_post_boost_invoice_influencer FOREIGN KEY ("influencerId") REFERENCES influencers(id) ON DELETE SET NULL
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_post_boost_invoices_post_id ON post_boost_invoices("postId");
CREATE INDEX IF NOT EXISTS idx_post_boost_invoices_brand_id ON post_boost_invoices("brandId") WHERE "brandId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_post_boost_invoices_influencer_id ON post_boost_invoices("influencerId") WHERE "influencerId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_post_boost_invoices_payment_status ON post_boost_invoices("paymentStatus");
CREATE INDEX IF NOT EXISTS idx_post_boost_invoices_razorpay_order_id ON post_boost_invoices("razorpayOrderId") WHERE "razorpayOrderId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_post_boost_invoices_invoice_number ON post_boost_invoices("invoiceNumber") WHERE "invoiceNumber" IS NOT NULL;

-- Add comments to table and columns
COMMENT ON TABLE post_boost_invoices IS 'Stores invoice records for post boost payments';
COMMENT ON COLUMN post_boost_invoices."invoiceNumber" IS 'Unique invoice number (e.g., INV-B2603-1)';
COMMENT ON COLUMN post_boost_invoices."postId" IS 'Reference to the post being boosted';
COMMENT ON COLUMN post_boost_invoices."userType" IS 'Type of user boosting the post (influencer or brand)';
COMMENT ON COLUMN post_boost_invoices."brandId" IS 'Brand ID if boosted by brand';
COMMENT ON COLUMN post_boost_invoices."influencerId" IS 'Influencer ID if boosted by influencer';
COMMENT ON COLUMN post_boost_invoices.amount IS 'Base amount in paise (before tax)';
COMMENT ON COLUMN post_boost_invoices.tax IS 'Total tax amount in paise';
COMMENT ON COLUMN post_boost_invoices.cgst IS 'Central GST in paise (for Delhi)';
COMMENT ON COLUMN post_boost_invoices.sgst IS 'State GST in paise (for Delhi)';
COMMENT ON COLUMN post_boost_invoices.igst IS 'Integrated GST in paise (for other states)';
COMMENT ON COLUMN post_boost_invoices."totalAmount" IS 'Total amount including tax in paise';
COMMENT ON COLUMN post_boost_invoices."paymentStatus" IS 'Current payment status';
COMMENT ON COLUMN post_boost_invoices."paymentMethod" IS 'Payment method used';
COMMENT ON COLUMN post_boost_invoices."razorpayOrderId" IS 'Razorpay order ID';
COMMENT ON COLUMN post_boost_invoices."razorpayPaymentId" IS 'Razorpay payment ID after successful payment';
COMMENT ON COLUMN post_boost_invoices."paidAt" IS 'Timestamp when payment was completed';
COMMENT ON COLUMN post_boost_invoices."invoiceUrl" IS 'URL to generated invoice PDF (if applicable)';
COMMENT ON COLUMN post_boost_invoices."invoiceData" IS 'Additional invoice metadata in JSON format';
