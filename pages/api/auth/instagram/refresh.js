// pages/api/auth/instagram/refresh.js
import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { access_token } = req.body || {};
  if (!access_token) return res.status(400).json({ error: 'Missing access_token' });

  try {
    const r = await axios.get('https://graph.instagram.com/refresh_access_token', {
      params: { grant_type: 'ig_refresh_token', access_token }
    });
    console.log('Refreshed Instagram access token:', r.data);
    return res.status(200).json(r.data);
  } catch (err) {
    console.error(err.response?.data || err.message);
    return res.status(500).json({ error: 'refresh_failed', details: err.response?.data || err.message });
  }
}
