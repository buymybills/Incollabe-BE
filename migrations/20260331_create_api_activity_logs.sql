-- Create API Activity Logs table for admin monitoring
-- This table stores all API requests, responses, and performance metrics

CREATE TABLE IF NOT EXISTS api_activity_logs (
  id SERIAL PRIMARY KEY,

  -- Request Info
  method VARCHAR(10) NOT NULL,
  endpoint VARCHAR(500) NOT NULL,
  full_url TEXT,
  query_params JSONB,
  request_body JSONB,
  request_headers JSONB,

  -- User Info
  user_id INTEGER,
  user_type VARCHAR(50),
  user_email VARCHAR(255),
  username VARCHAR(255),
  ip_address VARCHAR(100),
  user_agent TEXT,

  -- Response Info
  status_code INTEGER NOT NULL,
  response_body JSONB,
  response_size_bytes INTEGER,

  -- Performance Metrics
  response_time_ms INTEGER NOT NULL,
  is_slow BOOLEAN DEFAULT FALSE,

  -- Error Info
  is_error BOOLEAN DEFAULT FALSE,
  error_message TEXT,
  error_stack TEXT,

  -- Metadata
  controller_name VARCHAR(100),
  action_name VARCHAR(100),
  tags JSONB,
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for fast lookups
CREATE INDEX idx_api_logs_user_id ON api_activity_logs(user_id);
CREATE INDEX idx_api_logs_user_type ON api_activity_logs(user_type);
CREATE INDEX idx_api_logs_method ON api_activity_logs(method);
CREATE INDEX idx_api_logs_status_code ON api_activity_logs(status_code);
CREATE INDEX idx_api_logs_created_at ON api_activity_logs(created_at DESC);
CREATE INDEX idx_api_logs_endpoint ON api_activity_logs(endpoint);
CREATE INDEX idx_api_logs_is_error ON api_activity_logs(is_error);
CREATE INDEX idx_api_logs_user_created ON api_activity_logs(user_id, created_at DESC);

-- Add comment
COMMENT ON TABLE api_activity_logs IS 'Stores all API activity for admin monitoring and debugging';
