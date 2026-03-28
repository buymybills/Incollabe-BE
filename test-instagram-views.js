/**
 * Test script to fetch Instagram reel view count
 * Usage: INSTAGRAM_TOKEN=your_token node test-instagram-views.js
 */

const axios = require('axios');

// Instagram reel URL to test
const INSTAGRAM_URL = 'https://www.instagram.com/p/DQmIv4bDHMP/';

// Instagram user ID from database
const INSTAGRAM_USER_ID = '26679950948279616';

// Get token from environment variable or use the one from database
const ACCESS_TOKEN = process.env.INSTAGRAM_TOKEN || '0gHLZcm+jI0UFabPUBKN8g==:nsbMWKE8GkeRXIt3lJ8mEQ==:HnBMKkae8pTmkiftS1ZwMS+uMCWxFRhZQ1ip1iIP9JLkyMprwpRnSAAqxyftAd0/H9BIlvqsxvRyLow55jyD0O/iYLzxuUDTfhZQFZJ1ilp6D68B55bXkKy0sjzkLa6wbgPHAHRsvEruCTTPiURE/PQJfLVG6hrNlzsWa1mE2VkjFIvHMlWDGXDW1bnnGVijWHl9SqubJz9QZmppUWg=';

/**
 * Extract shortcode from Instagram URL
 */
function extractShortcode(url) {
  const patterns = [
    /instagram\.com\/(?:reel|p|tv)\/([A-Za-z0-9_-]+)/,
    /instagr\.am\/p\/([A-Za-z0-9_-]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

/**
 * Get Instagram media ID from shortcode
 */
async function getMediaId(shortcode, accessToken) {
  try {
    console.log(`\n🔍 Step 1: Getting media ID for shortcode: ${shortcode}`);

    // Get all media from user's account and find by shortcode
    const mediaUrl = `https://graph.instagram.com/v21.0/${INSTAGRAM_USER_ID}/media?fields=id,shortcode,media_type,timestamp,permalink&limit=100&access_token=${accessToken}`;

    const mediaResponse = await axios.get(mediaUrl);

    console.log(`\n📊 Found ${mediaResponse.data.data.length} media items for user`);

    // Find the media by shortcode
    const media = mediaResponse.data.data.find(m => m.shortcode === shortcode);

    if (media) {
      console.log('✓ Found media:');
      console.log('   ID:', media.id);
      console.log('   Shortcode:', media.shortcode);
      console.log('   Type:', media.media_type);
      console.log('   Posted:', media.timestamp);
      console.log('   URL:', media.permalink);
      return media.id;
    }

    console.log('\n❌ Media not found in user\'s media list');
    console.log('   This reel might not belong to this Instagram account');
    return null;
  } catch (error) {
    console.error('❌ Error getting media ID:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Fetch Instagram media insights (view count)
 */
async function fetchViewCount(mediaId, accessToken) {
  try {
    console.log(`\n🔍 Step 2: Fetching insights for media ID: ${mediaId}`);

    // For reels, we need to use ig_reels_aggregated_all_plays_count metric
    const insightsUrl = `https://graph.instagram.com/v21.0/${mediaId}/insights?metric=ig_reels_aggregated_all_plays_count,reach,impressions&access_token=${accessToken}`;

    console.log('   API URL:', insightsUrl.replace(accessToken, 'TOKEN_HIDDEN'));

    const response = await axios.get(insightsUrl);

    console.log('\n✓ Raw insights response:', JSON.stringify(response.data, null, 2));

    const data = response.data.data;

    const viewCountMetric = data.find(m => m.name === 'ig_reels_aggregated_all_plays_count');
    const reachMetric = data.find(m => m.name === 'reach');
    const impressionsMetric = data.find(m => m.name === 'impressions');

    return {
      viewCount: viewCountMetric?.values?.[0]?.value || null,
      reach: reachMetric?.values?.[0]?.value || null,
      impressions: impressionsMetric?.values?.[0]?.value || null,
    };
  } catch (error) {
    console.error('❌ Error fetching insights:');
    if (error.response?.data) {
      console.error(JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
    throw error;
  }
}

/**
 * Main test function
 */
async function testInstagramViewCount() {
  try {
    console.log('=== Instagram View Count Test ===\n');
    console.log('🎥 Reel URL:', INSTAGRAM_URL);
    console.log('👤 Instagram User ID:', INSTAGRAM_USER_ID);
    console.log('🔑 Access Token:', ACCESS_TOKEN.substring(0, 30) + '...');

    // Step 1: Extract shortcode
    const shortcode = extractShortcode(INSTAGRAM_URL);
    console.log('\n✓ Shortcode extracted:', shortcode);

    if (!shortcode) {
      throw new Error('Could not extract shortcode from URL');
    }

    // Step 2: Get media ID
    const mediaId = await getMediaId(shortcode, ACCESS_TOKEN);

    if (!mediaId) {
      console.log('\n⚠️  Could not find media ID. Possible reasons:');
      console.log('   1. The reel does not belong to Instagram user 26679950948279616 (@collabkaroo)');
      console.log('   2. The reel was deleted');
      console.log('   3. The access token expired or is invalid');
      console.log('\n💡 Make sure the reel URL belongs to the same Instagram account');
      return;
    }

    // Step 3: Fetch view count
    const insights = await fetchViewCount(mediaId, ACCESS_TOKEN);

    console.log('\n✅ SUCCESS! Fetched Instagram insights:');
    console.log('┌─────────────────────────────────────┐');
    console.log('│  View Count:', (insights.viewCount?.toLocaleString() || 'N/A').padEnd(21), '│');
    console.log('│  Reach:     ', (insights.reach?.toLocaleString() || 'N/A').padEnd(21), '│');
    console.log('│  Impressions:', (insights.impressions?.toLocaleString() || 'N/A').padEnd(21), '│');
    console.log('└─────────────────────────────────────┘');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);

    if (error.response?.status === 401) {
      console.log('\n💡 Authentication failed. Please check:');
      console.log('   1. Is the access token valid?');
      console.log('   2. Has the token expired?');
      console.log('   3. Does the token have the required permissions (instagram_basic, instagram_manage_insights)?');
    }

    process.exit(1);
  }
}

// Run the test
testInstagramViewCount();
