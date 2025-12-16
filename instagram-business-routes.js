// Instagram Graph API Routes for Business/Creator Accounts
// Usage: const instagramBusinessRoutes = require('./instagram-business-routes');
//        app.use('/api/auth/instagram-business', instagramBusinessRoutes);

const express = require('express');
const router = express.Router();
const axios = require('axios');

// Configuration - Update these with your Facebook App credentials
const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID || 'YOUR_FACEBOOK_APP_ID';
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET || 'YOUR_FACEBOOK_APP_SECRET';

// Exchange Facebook authorization code for access token and get Instagram Business Account
router.post('/token', async (req, res) => {
  try {
    const { code, redirect_uri } = req.body;
    console.log('Exchanging Facebook code for Instagram Business access...');

    if (!code || !redirect_uri) {
      return res.status(400).json({
        error: 'Missing code or redirect_uri',
      });
    }

    // Step 1: Exchange authorization code for Facebook access token
    const tokenResponse = await axios.get(
      'https://graph.facebook.com/v18.0/oauth/access_token',
      {
        params: {
          client_id: FACEBOOK_APP_ID,
          client_secret: FACEBOOK_APP_SECRET,
          redirect_uri: redirect_uri,
          code: code,
        },
      }
    );

    const { access_token: userAccessToken } = tokenResponse.data;
    console.log('Facebook user access token received');

    // Step 2: Get user's Facebook pages
    const pagesResponse = await axios.get(
      'https://graph.facebook.com/v18.0/me/accounts',
      {
        params: {
          access_token: userAccessToken,
          fields: 'id,name,access_token',
        },
      }
    );

    if (!pagesResponse.data.data || pagesResponse.data.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No Facebook pages found. Please create a Facebook page and connect it to your Instagram Business account.',
      });
    }

    const page = pagesResponse.data.data[0];
    const pageAccessToken = page.access_token;
    const pageId = page.id;
    console.log('Facebook page found:', page.name);

    // Step 3: Get Instagram Business Account connected to the page
    const igAccountResponse = await axios.get(
      `https://graph.facebook.com/v18.0/${pageId}`,
      {
        params: {
          fields: 'instagram_business_account',
          access_token: pageAccessToken,
        },
      }
    );

    if (!igAccountResponse.data.instagram_business_account) {
      return res.status(404).json({
        success: false,
        error: 'No Instagram Business account connected to your Facebook page. Please connect an Instagram Business or Creator account.',
      });
    }

    const instagramBusinessAccountId = igAccountResponse.data.instagram_business_account.id;
    console.log('Instagram Business Account ID:', instagramBusinessAccountId);

    // Step 4: Exchange short-lived token for long-lived token (60 days)
    const longLivedResponse = await axios.get(
      'https://graph.facebook.com/v18.0/oauth/access_token',
      {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: FACEBOOK_APP_ID,
          client_secret: FACEBOOK_APP_SECRET,
          fb_exchange_token: pageAccessToken,
        },
      }
    );

    const longLivedToken = longLivedResponse.data.access_token;
    console.log('Long-lived page access token received');

    return res.json({
      success: true,
      access_token: longLivedToken,
      instagram_business_account_id: instagramBusinessAccountId,
      page_id: pageId,
      page_name: page.name,
      expires_in: longLivedResponse.data.expires_in,
    });

  } catch (error) {
    console.error('Instagram Business authentication error:', error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to authenticate Instagram Business account',
      details: error.response?.data || error.message,
    });
  }
});

// Get Instagram Business Profile with followers/following count
router.post('/profile', async (req, res) => {
  try {
    const { access_token, instagram_business_account_id } = req.body;

    if (!access_token || !instagram_business_account_id) {
      return res.status(400).json({
        error: 'Missing access_token or instagram_business_account_id',
      });
    }

    // Get Instagram Business Account profile
    const response = await axios.get(
      `https://graph.facebook.com/v18.0/${instagram_business_account_id}`,
      {
        params: {
          fields: 'id,username,name,profile_picture_url,biography,website,followers_count,follows_count,media_count,ig_id',
          access_token: access_token,
        },
      }
    );

    return res.json({
      success: true,
      profile: {
        id: response.data.id,
        username: response.data.username,
        name: response.data.name,
        profile_picture_url: response.data.profile_picture_url,
        biography: response.data.biography,
        website: response.data.website,
        followers_count: response.data.followers_count,
        follows_count: response.data.follows_count,
        media_count: response.data.media_count,
        ig_id: response.data.ig_id,
      },
    });

  } catch (error) {
    console.error('Instagram Business profile fetch error:', error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch Instagram Business profile',
      details: error.response?.data || error.message,
    });
  }
});

// Get Instagram Business Account insights (engagement metrics)
router.post('/insights', async (req, res) => {
  try {
    const { access_token, instagram_business_account_id } = req.body;

    if (!access_token || !instagram_business_account_id) {
      return res.status(400).json({
        error: 'Missing access_token or instagram_business_account_id',
      });
    }

    // Get account insights
    const response = await axios.get(
      `https://graph.facebook.com/v18.0/${instagram_business_account_id}/insights`,
      {
        params: {
          metric: 'impressions,reach,profile_views,follower_count',
          period: 'day',
          access_token: access_token,
        },
      }
    );

    return res.json({
      success: true,
      insights: response.data.data,
    });

  } catch (error) {
    console.error('Instagram insights fetch error:', error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch Instagram insights',
      details: error.response?.data || error.message,
    });
  }
});

// Get Instagram media (posts)
router.post('/media', async (req, res) => {
  try {
    const { access_token, instagram_business_account_id, limit = 25 } = req.body;

    if (!access_token || !instagram_business_account_id) {
      return res.status(400).json({
        error: 'Missing access_token or instagram_business_account_id',
      });
    }

    // Get media
    const response = await axios.get(
      `https://graph.facebook.com/v18.0/${instagram_business_account_id}/media`,
      {
        params: {
          fields: 'id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,like_count,comments_count',
          limit: limit,
          access_token: access_token,
        },
      }
    );

    return res.json({
      success: true,
      media: response.data.data,
      paging: response.data.paging,
    });

  } catch (error) {
    console.error('Instagram media fetch error:', error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch Instagram media',
      details: error.response?.data || error.message,
    });
  }
});

// Refresh long-lived token
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
      'https://graph.facebook.com/v18.0/oauth/access_token',
      {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: FACEBOOK_APP_ID,
          client_secret: FACEBOOK_APP_SECRET,
          fb_exchange_token: access_token,
        },
      }
    );

    return res.json({
      success: true,
      access_token: response.data.access_token,
      token_type: 'bearer',
      expires_in: response.data.expires_in,
    });

  } catch (error) {
    console.error('Token refresh error:', error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to refresh token',
      details: error.response?.data || error.message,
    });
  }
});

module.exports = router;
