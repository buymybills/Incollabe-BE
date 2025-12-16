// Simple Express server for testing Instagram OAuth
// Run with: node test-instagram-server.js

const express = require('express');
const cors = require('cors');
const instagramRoutes = require('./instagram-auth-routes');

const app = express();
const PORT = 3002;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Instagram OAuth routes
app.use('/api/auth/instagram', instagramRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Instagram OAuth server is running' });
});

// Test endpoint
app.get('/test', (req, res) => {
  res.json({
    message: 'Instagram OAuth Test Server',
    endpoints: {
      token: 'POST /api/auth/instagram/token',
      profile: 'POST /api/auth/instagram/profile',
      refresh: 'POST /api/auth/instagram/refresh-token',
    },
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
🚀 Instagram OAuth Server running!

   Port: ${PORT}
   Health: http://localhost:${PORT}/health
   Test: http://localhost:${PORT}/test

   Endpoints:
   POST http://localhost:${PORT}/api/auth/instagram/token
   POST http://localhost:${PORT}/api/auth/instagram/profile
   POST http://localhost:${PORT}/api/auth/instagram/refresh-token
  `);
});

module.exports = app;
