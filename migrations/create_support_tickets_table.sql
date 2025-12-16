-- Create support tickets table
CREATE TABLE IF NOT EXISTS support_tickets (
    id SERIAL PRIMARY KEY,
    "userType" VARCHAR(50) NOT NULL CHECK ("userType" IN ('influencer', 'brand')),
    "influencerId" INTEGER REFERENCES influencers(id) ON DELETE CASCADE,
    "brandId" INTEGER REFERENCES brands(id) ON DELETE CASCADE,
    subject VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    "reportType" VARCHAR(50) NOT NULL CHECK ("reportType" IN ('technical_issue', 'account_issue', 'payment_issue', 'report_user', 'campaign_issue', 'content_issue', 'other')),
    status VARCHAR(50) NOT NULL DEFAULT 'unresolved' CHECK (status IN ('unresolved', 'resolved')),
    "reportedUserType" VARCHAR(50) CHECK ("reportedUserType" IN ('influencer', 'brand')),
    "reportedUserId" INTEGER,
    "assignedToAdminId" INTEGER REFERENCES admins(id) ON DELETE SET NULL,
    "adminNotes" TEXT,
    resolution TEXT,
    "resolvedAt" TIMESTAMP WITH TIME ZONE,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Ensure either influencerId or brandId is set based on userType
    CONSTRAINT check_user_id CHECK (
        ("userType" = 'influencer' AND "influencerId" IS NOT NULL AND "brandId" IS NULL) OR
        ("userType" = 'brand' AND "brandId" IS NOT NULL AND "influencerId" IS NULL)
    )
);

-- Create indexes for better query performance
CREATE INDEX idx_support_tickets_status ON support_tickets(status);
CREATE INDEX idx_support_tickets_user_type ON support_tickets("userType");
CREATE INDEX idx_support_tickets_influencer_id ON support_tickets("influencerId");
CREATE INDEX idx_support_tickets_brand_id ON support_tickets("brandId");
CREATE INDEX idx_support_tickets_report_type ON support_tickets("reportType");
CREATE INDEX idx_support_tickets_created_at ON support_tickets("createdAt" DESC);
CREATE INDEX idx_support_tickets_assigned_admin ON support_tickets("assignedToAdminId");

-- Add comment
COMMENT ON TABLE support_tickets IS 'Support tickets created by influencers and brands for reporting issues';
