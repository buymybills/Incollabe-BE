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

  // Try metrics that are likely to work for REELS
  const metricSets = [
    'plays',
    'likes',
    'comments',
    'shares',
    'saved',
    'reach',
    'total_interactions',
    'ig_reels_avg_watch_time',
    'clips_replays_count',
    'plays,likes,comments,shares',
    'reach,plays,likes,comments',
  ];

  for (const metrics of metricSets) {
    console.log(`\n--- Testing: ${metrics} ---`);
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
    console.log('=== Testing REELS Metrics ===\n');

    const userId = await getUserId(ACCESS_TOKEN);
    const shortcode = extractShortcode(INSTAGRAM_URL);
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
