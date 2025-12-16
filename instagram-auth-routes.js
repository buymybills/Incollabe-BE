// Instagram OAuth Routes for Express (JavaScript)
// Usage: const instagramRoutes = require('./instagram-auth-routes');
//        app.use('/api/auth/instagram', instagramRoutes);

const express = require('express');
const router = express.Router();
const axios = require('axios');

// Configuration - Update these with your credentials
// Old credentials (commented out)
// const INSTAGRAM_APP_ID = '3465383796947612';
// const INSTAGRAM_APP_SECRET = 'c686acf6f91b8164e74f726095675726';
// const INSTAGRAM_APP_ID = '9258828604161618';
// const INSTAGRAM_APP_SECRET = 'eeb6bc83a30bbb3716e076e62191646a';

// Current credentials
const INSTAGRAM_APP_ID = '4227258287486425';
const INSTAGRAM_APP_SECRET = '83ba757d76afa65c5f6df481a6f9f20c';

// Exchange authorization code for access token
router.post('/token', async (req, res) => {
  try {
    const { code, redirect_uri } = req.body;
    console.log('Received code and redirect_uri:', { code, redirect_uri });

    if (!code || !redirect_uri) {
      return res.status(400).json({
        error: 'Missing code or redirect_uri',
      });
    }

    console.log('Exchanging code for token...');

    // Step 1: Exchange authorization code for short-lived access token
    const tokenResponse = await axios.post(
      'https://api.instagram.com/oauth/access_token',
      new URLSearchParams({
        client_id: INSTAGRAM_APP_ID,
        client_secret: INSTAGRAM_APP_SECRET,
        grant_type: 'authorization_code',
        redirect_uri: redirect_uri, 
        code: code,
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const tokenData = tokenResponse.data;
    console.log('Short-lived token received:', tokenData);

    // Step 2: Exchange short-lived token for long-lived token (60 days)
    const longLivedResponse = await axios.get(
      'https://graph.instagram.com/access_token',
      {
        params: {
          grant_type: 'ig_exchange_token',
          client_secret: INSTAGRAM_APP_SECRET,
          access_token: tokenData.access_token,
        },
      }
    );

    const longLivedData = longLivedResponse.data;
    console.log('Long-lived token received');

    return res.json({
      success: true,
      access_token: longLivedData.access_token,
      token_type: longLivedData.token_type,
      expires_in: longLivedData.expires_in, // 60 days
      user_id: tokenData.user_id,
    });

  } catch (error) {
    console.error('Instagram token exchange error:', error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to exchange token',
      details: error.response?.data || error.message,
    });
  }
});

// Get Instagram profile
router.post('/profile', async (req, res) => {
  try {
    const { access_token } = req.body;

    if (!access_token) {
      return res.status(400).json({
        error: 'Missing access_token',
      });
    }

    // Get user profile from Instagram Basic Display API
    // Try to get followers_count (this will fail or return error)
    const response = await axios.get(
      'https://graph.instagram.com/me',
      {
        params: {
          fields: 'id,username,account_type,media_count,followers_count,follows_count',
          access_token: access_token,
        },
      }
    );

    return res.json({
      success: true,
      profile: response.data,
    });

  } catch (error) {
    console.error('Instagram profile fetch error:', error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch profile',
      details: error.response?.data || error.message,
    });
  }
});

// Refresh long-lived token (extends expiration by another 60 days)
router.post('/refresh-token', async (req, res) => {
  try {
    const { access_token } = req.body;

    if (!access_token) {
      return res.status(400).json({
        error: 'Missing access_token',
      });
    }

    // Refresh long-lived token
    const response = await axios.get(
      'https://graph.instagram.com/refresh_access_token',
      {
        params: {
          grant_type: 'ig_refresh_token',
          access_token: access_token,
        },
      }
    );

    return res.json({
      success: true,
      access_token: response.data.access_token,
      token_type: response.data.token_type,
      expires_in: response.data.expires_in,
    });

  } catch (error) {
    console.error('Instagram token refresh error:', error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to refresh token',
      details: error.response?.data || error.message,
    });
  }
});

module.exports = router;
