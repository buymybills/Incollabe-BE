import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import axios from 'axios';
import { getModelToken } from '@nestjs/sequelize';
import { Influencer } from './src/auth/model/influencer.model';

/**
 * Test script to fetch Instagram reel view count
 * Usage: npm run build && node dist/test-instagram-api.js
 */

const INSTAGRAM_URL = 'https://www.instagram.com/p/DQmIv4bDHMP/';
const INFLUENCER_ID = 18;

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    console.log('=== Instagram View Count Test ===\n');

    // Get influencer model from DI container
    const influencerModel = app.get<typeof Influencer>(getModelToken(Influencer));

    // Fetch influencer from database
    const influencer = await influencerModel.findByPk(INFLUENCER_ID);

    if (!influencer) {
      console.error('❌ Influencer not found');
      process.exit(1);
    }

    console.log('👤 Influencer:', influencer.username);
    console.log('📱 Instagram Username:', influencer.instagramUsername);
    console.log('🆔 Instagram User ID:', influencer.instagramUserId);
    console.log('🔑 Access Token:', influencer.instagramAccessToken?.substring(0, 30) + '...');
    console.log('⏰ Token Expires:', influencer.instagramTokenExpiresAt);

    if (!influencer.instagramAccessToken) {
      console.error('\n❌ No Instagram access token found');
      process.exit(1);
    }

    if (!influencer.instagramUserId) {
      console.error('\n❌ No Instagram user ID found');
      process.exit(1);
    }

    // Check if token is expired
    if (influencer.instagramTokenExpiresAt && new Date(influencer.instagramTokenExpiresAt) < new Date()) {
      console.error('\n⚠️  Instagram access token has expired!');
      console.error('   Expired at:', influencer.instagramTokenExpiresAt);
      console.error('   Current time:', new Date());
    }

    // Extract shortcode from URL
    const shortcode = extractShortcode(INSTAGRAM_URL);
    console.log('\n🎥 Reel shortcode:', shortcode);

    if (!shortcode) {
      console.error('❌ Could not extract shortcode from URL');
      process.exit(1);
    }

    // Step 1: Get media ID
    console.log('\n🔍 Step 1: Finding media ID...');
    const mediaId = await getMediaId(
      influencer.instagramUserId,
      shortcode,
      influencer.instagramAccessToken
    );

    if (!mediaId) {
      console.log('\n⚠️  Could not find media. This reel might not belong to @' + influencer.instagramUsername);
      process.exit(1);
    }

    console.log('✓ Found media ID:', mediaId);

    // Step 2: Fetch insights
    console.log('\n🔍 Step 2: Fetching insights...');
    const insights = await fetchInsights(mediaId, influencer.instagramAccessToken);

    console.log('\n✅ SUCCESS! Instagram Insights:');
    console.log('┌─────────────────────────────────────┐');
    console.log('│  View Count:', (insights.viewCount?.toLocaleString() || 'N/A').padEnd(21), '│');
    console.log('│  Reach:     ', (insights.reach?.toLocaleString() || 'N/A').padEnd(21), '│');
    console.log('│  Impressions:', (insights.impressions?.toLocaleString() || 'N/A').padEnd(21), '│');
    console.log('└─────────────────────────────────────┘');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response?.data) {
      console.error('API Error:', JSON.stringify(error.response.data, null, 2));
    }
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  } finally {
    await app.close();
  }
}

function extractShortcode(url: string): string | null {
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

async function getMediaId(userId: string, shortcode: string, accessToken: string): Promise<string | null> {
  try {
    console.log(`   Fetching media for user ${userId}...`);
    const url = `https://graph.instagram.com/v21.0/${userId}/media?fields=id,shortcode,media_type,timestamp&limit=100&access_token=${accessToken}`;

    const response = await axios.get(url);
    console.log(`   Found ${response.data.data.length} media items`);

    const media = response.data.data.find((m: any) => m.shortcode === shortcode);

    if (media) {
      console.log(`   ✓ Matched shortcode: ${media.shortcode}`);
    }

    return media?.id || null;
  } catch (error) {
    console.error('Error fetching media:');
    if (error.response?.data) {
      console.error(JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
    throw error;
  }
}

async function fetchInsights(mediaId: string, accessToken: string) {
  try {
    const url = `https://graph.instagram.com/v21.0/${mediaId}/insights?metric=ig_reels_aggregated_all_plays_count,reach,impressions&access_token=${accessToken}`;

    console.log('   Requesting insights...');
    const response = await axios.get(url);
    const data = response.data.data;

    console.log('   Raw response:', JSON.stringify(data, null, 2));

    const viewCountMetric = data.find((m: any) => m.name === 'ig_reels_aggregated_all_plays_count');
    const reachMetric = data.find((m: any) => m.name === 'reach');
    const impressionsMetric = data.find((m: any) => m.name === 'impressions');

    return {
      viewCount: viewCountMetric?.values?.[0]?.value || null,
      reach: reachMetric?.values?.[0]?.value || null,
      impressions: impressionsMetric?.values?.[0]?.value || null,
    };
  } catch (error) {
    console.error('Error fetching insights:');
    if (error.response?.data) {
      console.error(JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
    throw error;
  }
}

bootstrap();
