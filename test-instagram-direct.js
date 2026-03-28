const axios = require('axios');

// From user input
const INSTAGRAM_USER_ID = null; // Will fetch from token
const INSTAGRAM_URL = 'https://www.instagram.com/p/DTzuZG-kTDk/';
const ACCESS_TOKEN = 'IGAA8Eq0SZAddlBZAGFZASGRmU1E5RU41Sm5ZATHgyeG95MjdhZADZAmcUk0RG9ic0VfdVplbUlNVjFEOWI0emltNldNQzhtZA0NtZAUFmQkNRclZAKazM2dkR4OTdLNGdpSU5TNjFyR0lWZA3REb0h4YVJCUFZAtMU1B';

async function getUserId(accessToken) {
  try {
    console.log('   Fetching user info from access token...');
    const url = `https://graph.instagram.com/v21.0/me?fields=id,username&access_token=${accessToken}`;

    const response = await axios.get(url);
    console.log(`   ✓ User ID: ${response.data.id}`);
    console.log(`   ✓ Username: ${response.data.username}`);

    return response.data.id;
  } catch (error) {
    console.error('\n❌ Error fetching user info:');
    if (error.response?.data) {
      console.error(JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
    throw error;
  }
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
  try {
    console.log(`   Fetching media list for user ${userId}...`);
    const url = `https://graph.instagram.com/v21.0/${userId}/media?fields=id,shortcode,media_type,media_product_type,timestamp,permalink&limit=100&access_token=${accessToken}`;

    const response = await axios.get(url);
    console.log(`   Found ${response.data.data.length} media items`);

    const media = response.data.data.find(m => m.shortcode === shortcode);

    if (media) {
      console.log(`   ✓ Matched shortcode: ${media.shortcode}`);
      console.log(`   ✓ Media type: ${media.media_type}`);
      console.log(`   ✓ Media product type: ${media.media_product_type || 'N/A'}`);
      console.log(`   ✓ Posted: ${media.timestamp}`);
    }

    return media || null;
  } catch (error) {
    console.error('\n❌ Error fetching media:');
    if (error.response?.data) {
      console.error(JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
    throw error;
  }
}

async function fetchInsights(media, accessToken) {
  try {
    const mediaId = media.id;
    const mediaType = media.media_type;
    const mediaProductType = media.media_product_type;

    // Choose metrics based on media product type
    let metrics;
    if (mediaProductType === 'REELS') {
      // For REELS: views, reach, likes, comments, shares, saved, total_interactions
      metrics = 'views,reach,likes,comments,shares,saved,total_interactions';
    } else if (mediaType === 'VIDEO') {
      // For regular videos
      metrics = 'reach,likes,comments,shares,saved';
    } else if (mediaType === 'IMAGE' || mediaType === 'CAROUSEL_ALBUM') {
      // For images
      metrics = 'reach,likes,comments,shares,saved';
    } else {
      metrics = 'reach';
    }

    const url = `https://graph.instagram.com/v21.0/${mediaId}/insights?metric=${metrics}&access_token=${accessToken}`;

    console.log(`   Requesting insights for ${mediaType} (${mediaProductType || 'N/A'}) from Instagram Graph API...`);
    console.log(`   Metrics: ${metrics}`);
    const response = await axios.get(url);
    const data = response.data.data;

    console.log('   Raw insights response:');
    console.log(JSON.stringify(data, null, 2));

    const getValue = (name) => {
      const metric = data.find(m => m.name === name);
      return metric?.values?.[0]?.value ?? null;
    };

    const result = {
      mediaType: mediaType,
      mediaProductType: mediaProductType || 'N/A',
      reach: getValue('reach'),
      likes: getValue('likes'),
      comments: getValue('comments'),
      shares: getValue('shares'),
      saved: getValue('saved'),
    };

    // Add view count for reels
    if (mediaProductType === 'REELS') {
      result.views = getValue('views');
      result.totalInteractions = getValue('total_interactions');
    }

    return result;
  } catch (error) {
    console.error('\n❌ Error fetching insights:');
    if (error.response?.data) {
      console.error(JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
    throw error;
  }
}

async function main() {
  console.log('=== Instagram View Count Test (Direct Token) ===\n');
  console.log('🎥 Reel URL:', INSTAGRAM_URL);
  console.log('🔑 Access Token (first 50 chars):', ACCESS_TOKEN.substring(0, 50) + '...');

  try {
    // Get user ID from token if not provided
    let userId = INSTAGRAM_USER_ID;
    if (!userId) {
      console.log('\n🔍 Step 0: Getting Instagram User ID from token...');
      userId = await getUserId(ACCESS_TOKEN);
    }
    console.log('👤 Instagram User ID:', userId);

    // Extract shortcode
    const shortcode = extractShortcode(INSTAGRAM_URL);
    console.log('\n📝 Shortcode:', shortcode);

    if (!shortcode) {
      console.error('❌ Could not extract shortcode from URL');
      process.exit(1);
    }

    // Get media
    console.log('\n🔍 Step 1: Finding media...');
    const media = await getMediaId(userId, shortcode, ACCESS_TOKEN);

    if (!media) {
      console.log('\n⚠️  Media not found. Possible reasons:');
      console.log('   1. This post does not belong to user ' + userId);
      console.log('   2. The post was deleted');
      console.log('   3. The access token expired or invalid');
      process.exit(1);
    }

    console.log('\n✓ Found media ID:', media.id);

    // Fetch insights
    console.log('\n🔍 Step 2: Fetching insights...');
    const insights = await fetchInsights(media, ACCESS_TOKEN);

    console.log('\n✅ SUCCESS! Instagram Insights Retrieved:');
    console.log('┌─────────────────────────────────────┐');
    console.log('│  Media Type:', (insights.mediaProductType || insights.mediaType || 'N/A').padEnd(21), '│');

    if (insights.views !== undefined) {
      console.log('│  Views:     ', (insights.views !== null ? insights.views.toLocaleString() : 'N/A').padEnd(21), '│');
    }

    console.log('│  Reach:     ', (insights.reach !== null ? insights.reach.toLocaleString() : 'N/A').padEnd(21), '│');
    console.log('│  Likes:     ', (insights.likes !== null ? insights.likes.toLocaleString() : 'N/A').padEnd(21), '│');
    console.log('│  Comments:  ', (insights.comments !== null ? insights.comments.toLocaleString() : 'N/A').padEnd(21), '│');
    console.log('│  Shares:    ', (insights.shares !== null ? insights.shares.toLocaleString() : 'N/A').padEnd(21), '│');
    console.log('│  Saved:     ', (insights.saved !== null ? insights.saved.toLocaleString() : 'N/A').padEnd(21), '│');

    if (insights.totalInteractions !== undefined) {
      console.log('│  Total Interactions:', (insights.totalInteractions !== null ? insights.totalInteractions.toLocaleString() : 'N/A').padEnd(13), '│');
    }

    console.log('└─────────────────────────────────────┘');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

main();
