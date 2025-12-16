// pages/api/auth/instagram/token.js
import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { code, redirect_uri } = req.body || {};
  if (!code || !redirect_uri) return res.status(400).json({ error: 'Missing code or redirect_uri' });

  const client_id = process.env.IG_APP_ID;
  const client_secret = process.env.IG_APP_SECRET;

  if (!client_id || !client_secret) {
    return res.status(500).json({ error: 'Server config error: missing IG_APP_ID or IG_APP_SECRET' });
  }

  try {
    // 1) Exchange code -> short-lived token
    const params = new URLSearchParams({
      client_id,
      client_secret,
      grant_type: 'authorization_code',
      redirect_uri,
      code
    });

    const tokenResp = await axios.post('https://api.instagram.com/oauth/access_token', params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const shortToken = tokenResp.data.access_token;
    const user_id = tokenResp.data.user_id;

    // 2) Exchange short-lived -> long-lived (recommended)
    const longResp = await axios.get('https://graph.instagram.com/access_token', {
      params: {
        grant_type: 'ig_exchange_token',
        client_secret,
        access_token: shortToken
      }
    });

    const longToken = longResp.data.access_token;
    const expires_in = longResp.data.expires_in; // seconds

    // You can persist longToken & expires_in & user_id to DB here.

    return res.status(200).json({ access_token: longToken, user_id, expires_in });
  } catch (err) {
    console.error('Instagram token error:', err.response?.data || err.message);
    const details = err.response?.data || err.message;
    return res.status(500).json({ error: 'token_exchange_failed', details });
  }
}
