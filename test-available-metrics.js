const axios = require('axios');

const INSTAGRAM_URL = 'https://www.instagram.com/p/DTzuZG-kTDk/';
const ACCESS_TOKEN = 'IGAA8Eq0SZAddlBZAGFZASGRmU1E5RU41Sm5ZATHgyeG95MjdhZADZAmcUk0RG9ic0VfdVplbUlNVjFEOWI0emltNldNQzhtZA0NtZAUFmQkNRclZAKazM2dkR4OTdLNGdpSU5TNjFyR0lWZA3REb0h4YVJCUFZAtMU1B';

async function getUserId(accessToken) {
  const url = `https://graph.instagram.com/v21.0/me?fields=id,username&access_token=${accessToken}`;
  const response = await axios.get(url);
  return response.data.id;
}

function extractShortcode(url) {
  const patterns = [
    /instagram\.com\/(?:reel|p|tv)\/([A-Za-z0-9_-]+)/,
    /instagr\.am\/p\/([A-Za-z0-9_-]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

async function getMediaId(userId, shortcode, accessToken) {
  const url = `https://graph.instagram.com/v21.0/${userId}/media?fields=id,shortcode,media_type,media_product_type,timestamp,permalink&limit=100&access_token=${accessToken}`;
  const response = await axios.get(url);
  const media = response.data.data.find(m => m.shortcode === shortcode);
  return media || null;
}

async function testMetrics(media, accessToken) {
  const mediaId = media.id;

  console.log('\n=== Media Information ===');
  console.log('Media ID:', mediaId);
  console.log('Media Type:', media.media_type);
  console.log('Media Product Type:', media.media_product_type);
  console.log('Posted:', media.timestamp);
  console.log('URL:', media.permalink);

  // Try different metric combinations
  const metricSets = [
    'reach,impressions',
    'engagement,saved',
    'ig_reels_aggregated_all_plays_count',
    'plays,total_interactions',
    'video_views',
    'reach,impressions,engagement',
    'ig_reels_video_view_total_time',
  ];

  for (const metrics of metricSets) {
    console.log(`\n--- Testing metrics: ${metrics} ---`);
    try {
      const url = `https://graph.instagram.com/v21.0/${mediaId}/insights?metric=${metrics}&access_token=${accessToken}`;
      const response = await axios.get(url);
      console.log('✓ SUCCESS!');
      console.log(JSON.stringify(response.data.data, null, 2));
    } catch (error) {
      console.log('✗ Failed:', error.response?.data?.error?.message || error.message);
    }
  }
}

async function main() {
  try {
    console.log('=== Testing Available Metrics ===\n');

    const userId = await getUserId(ACCESS_TOKEN);
    console.log('User ID:', userId);

    const shortcode = extractShortcode(INSTAGRAM_URL);
    console.log('Shortcode:', shortcode);

    const media = await getMediaId(userId, shortcode, ACCESS_TOKEN);

    if (!media) {
      console.error('Media not found');
      process.exit(1);
    }

    await testMetrics(media, ACCESS_TOKEN);

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
