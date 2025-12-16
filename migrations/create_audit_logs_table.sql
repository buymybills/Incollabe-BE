-- Create audit_logs table for tracking admin actions
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
    admin_name VARCHAR(100) NOT NULL,
    admin_email VARCHAR(255) NOT NULL,
    section VARCHAR(50) NOT NULL CHECK (section IN (
        'Auth',
        'Campaigns',
        'Notification Centre',
        'Brand',
        'Influencer',
        'Admin Management',
        'Profile Review',
        'Posts',
        'Settings'
    )),
    action_type VARCHAR(100) NOT NULL CHECK (action_type IN (
        'Login',
        'Logout',
        'Logout All Sessions',
        'Password Change',
        'Two Factor Enabled',
        'Two Factor Disabled',
        'Type Change in Campaign',
        'Campaign Approved',
        'Campaign Rejected',
        'Campaign Deleted',
        'Created New Notification',
        'Notification Updated',
        'Delete Notification',
        'Push Notification Sent',
        'Profile Approved',
        'Profile Rejected',
        'Profile Suspended',
        'Profile Activated',
        'New brand profile created',
        'Brand Profile Updated',
        'Brand Verified',
        'Brand Unverified',
        'Brand Top Status Changed',
        'New influencer profile created',
        'Influencer Profile Updated',
        'Influencer Verified',
        'Influencer Unverified',
        'Influencer Top Status Changed',
        'New Admin Created',
        'Admin Updated',
        'Admin Deleted',
        'Admin Status Changed',
        'Post Deleted',
        'Post Flagged',
        'Post Unflagged',
        'Settings Updated'
    )),
    details TEXT,
    target_type VARCHAR(50),
    target_id INTEGER,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_section ON audit_logs(section);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_id ON audit_logs(target_id);

-- Add comment to the table
COMMENT ON TABLE audit_logs IS 'Audit log for tracking all admin and employee actions in the system';
COMMENT ON COLUMN audit_logs.section IS 'The section/module where the action was performed';
COMMENT ON COLUMN audit_logs.action_type IS 'The type of action performed';
COMMENT ON COLUMN audit_logs.details IS 'Additional details about the action';
COMMENT ON COLUMN audit_logs.target_type IS 'Type of entity affected (campaign, brand, influencer, etc.)';
COMMENT ON COLUMN audit_logs.target_id IS 'ID of the affected entity';
COMMENT ON COLUMN audit_logs.ip_address IS 'IP address of the admin/employee who performed the action';
COMMENT ON COLUMN audit_logs.user_agent IS 'User agent string of the client used to perform the action';
