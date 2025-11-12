module.exports = {
  apps: [{
    name: 'incollab-api',
    script: './dist/main.js',

    // Clustering configuration - utilize all CPU cores
    instances: 'max',  // or specific number like 2, 4, etc.
    exec_mode: 'cluster',

    // Auto-restart configuration
    autorestart: true,
    watch: false,  // Set to true in development if you want auto-reload
    max_memory_restart: '1G',  // Restart if memory exceeds 1GB

    // Logging
    error_file: './logs/pm2/error.log',
    out_file: './logs/pm2/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,

    // Load environment variables from .env file
    env_file: '.env',

    // Environment variables (these are fallback defaults if .env doesn't have them)
    env: {
      PORT: 3002,
    },
    
    // Process management
    kill_timeout: 5000,  // Time to wait for graceful shutdown
    listen_timeout: 10000,  // Time to wait for app to be ready
    
    // Advanced features
    wait_ready: true,  // Wait for process.send('ready') signal
    instance_var: 'INSTANCE_ID',  // Expose instance ID to app
    
    // Health monitoring
    max_restarts: 10,  // Max restarts within min_uptime
    min_uptime: '10s',  // Min uptime before considered stable
    
    // Load balancing
    // PM2 will distribute incoming connections across all instances
  }]
};
