const axios = require('axios');
const crypto = require('crypto');

// From database
const ENCRYPTED_TOKEN = '1L9jvkeqeCw+JPnYgdyVlg==:08PbX2UrDq2KYUVTOd6N7g==:8NOqjM5RxgRm3uxEl7ks3WN6Vd7nu1tPOu67uNZH7g9szlcEHVpE/Z/oa4AhPAJxtGL0Qf5wSGmGyOyyNG25FbJh91gkesEN3nz8p3cjyGbA3JHxcJ11tmUu6Xx8JHiyAm9ShHycD3ITkjr+qAk7DCNiU1xeUJtt+Sm6IREgmGRBCTeqH2BE77gIhCBLE5XsGmP+9c2QPgtNAdnxFGg=';
const INSTAGRAM_USER_ID = '25660190496948191';
const INSTAGRAM_URL = 'https://www.instagram.com/p/DQwcgx2CBcG/';

/**
 * Decrypt Instagram token using AES-256-GCM
 * Uses scrypt to derive key from ENCRYPTION_KEY (same as EncryptionService)
 */
function decryptToken(encryptedToken) {
  // Get encryption key from environment
  const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

  if (!ENCRYPTION_KEY) {
    console.error('❌ ENCRYPTION_KEY environment variable not set!');
    console.log('\nPlease run:');
    console.log('source .env && node test-instagram-simple.js');
    process.exit(1);
  }

  try {
    // Derive 32-byte key using scrypt (same as EncryptionService line 21)
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);

    const [ivBase64, authTagBase64, encryptedDataBase64] = encryptedToken.split(':');

    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedDataBase64, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('❌ Decryption failed:', error.message);
    console.log('\nMake sure ENCRYPTION_KEY matches the one used to encrypt the token');
    process.exit(1);
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
    const url = `https://graph.instagram.com/v21.0/${userId}/media?fields=id,shortcode,media_type,timestamp,permalink&limit=100&access_token=${accessToken}`;

    const response = await axios.get(url);
    console.log(`   Found ${response.data.data.length} media items`);

    const media = response.data.data.find(m => m.shortcode === shortcode);

    if (media) {
      console.log(`   ✓ Matched shortcode: ${media.shortcode}`);
      console.log(`   ✓ Media type: ${media.media_type}`);
      console.log(`   ✓ Posted: ${media.timestamp}`);
    }

    return media?.id || null;
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

async function fetchInsights(mediaId, accessToken) {
  try {
    const url = `https://graph.instagram.com/v21.0/${mediaId}/insights?metric=ig_reels_aggregated_all_plays_count,reach,impressions&access_token=${accessToken}`;

    console.log('   Requesting insights from Instagram Graph API...');
    const response = await axios.get(url);
    const data = response.data.data;

    console.log('   Raw insights response:');
    console.log(JSON.stringify(data, null, 2));

    const viewCountMetric = data.find(m => m.name === 'ig_reels_aggregated_all_plays_count');
    const reachMetric = data.find(m => m.name === 'reach');
    const impressionsMetric = data.find(m => m.name === 'impressions');

    return {
      viewCount: viewCountMetric?.values?.[0]?.value || null,
      reach: reachMetric?.values?.[0]?.value || null,
      impressions: impressionsMetric?.values?.[0]?.value || null,
    };
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
  console.log('=== Instagram View Count Test ===\n');
  console.log('🎥 Reel URL:', INSTAGRAM_URL);
  console.log('👤 Instagram User ID:', INSTAGRAM_USER_ID);

  try {
    // Decrypt access token
    console.log('\n🔐 Decrypting Instagram access token...');
    const accessToken = decryptToken(ENCRYPTED_TOKEN);
    console.log('✓ Token decrypted successfully');
    console.log('   Token preview:', accessToken.substring(0, 40) + '...');

    // Extract shortcode
    const shortcode = extractShortcode(INSTAGRAM_URL);
    console.log('\n📝 Shortcode:', shortcode);

    if (!shortcode) {
      console.error('❌ Could not extract shortcode from URL');
      process.exit(1);
    }

    // Get media ID
    console.log('\n🔍 Step 1: Finding media ID...');
    const mediaId = await getMediaId(INSTAGRAM_USER_ID, shortcode, accessToken);

    if (!mediaId) {
      console.log('\n⚠️  Media not found. Possible reasons:');
      console.log('   1. This reel does not belong to user ' + INSTAGRAM_USER_ID);
      console.log('   2. The reel was deleted');
      console.log('   3. The access token expired');
      process.exit(1);
    }

    console.log('\n✓ Found media ID:', mediaId);

    // Fetch insights
    console.log('\n🔍 Step 2: Fetching insights...');
    const insights = await fetchInsights(mediaId, accessToken);

    console.log('\n✅ SUCCESS! Instagram Insights Retrieved:');
    console.log('┌─────────────────────────────────────┐');
    console.log('│  View Count:', (insights.viewCount?.toLocaleString() || 'N/A').padEnd(21), '│');
    console.log('│  Reach:     ', (insights.reach?.toLocaleString() || 'N/A').padEnd(21), '│');
    console.log('│  Impressions:', (insights.impressions?.toLocaleString() || 'N/A').padEnd(21), '│');
    console.log('└─────────────────────────────────────┘');

    console.log('\n✅ Conclusion: We CAN fetch view counts from Instagram Graph API!');
    console.log('   This means we can implement periodic updates to keep view counts fresh.');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

main();
