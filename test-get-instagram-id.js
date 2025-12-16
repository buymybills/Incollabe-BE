// Test script to get Instagram Business Account ID from authorization code
const axios = require('axios');

// Configuration
const FACEBOOK_APP_ID = '4227258287486425';
const FACEBOOK_APP_SECRET = '83ba757d76afa65c5f6df481a6f9f20c';
const REDIRECT_URI = 'https://unleft-unthinning-danielle.ngrok-free.dev/test-instagram-direct-login.html'; // Must match what you used in OAuth
const AUTHORIZATION_CODE = 'AQCmWX8wjq_2Ygi_yjqAV57QMNYeFmZQ_QtgzoP4ruBRUJfjBwq2M4qU7OBfTAUJO2H3MUibw8IEVeGZpfw576vzEZICt0ea5TX7RstVHZmNb5l4afXMhzYLmr3f0s8bLUlPhK_qBFYuNeNDx-Xv_Pjlj14uIycp6d0ymg6mZshW4Lnp0sBsIJP679gwWhTjH3PutfUNqEC88VlY9lWicj6N33FtjttHo8Fgl5mN19nZBQ';

async function getInstagramBusinessAccountId() {
  try {
    console.log('🔄 Step 1: Exchanging authorization code for access token...\n');

    // Step 1: Exchange authorization code for Facebook access token
    const tokenResponse = await axios.get(
      'https://graph.facebook.com/v18.0/oauth/access_token',
      {
        params: {
          client_id: FACEBOOK_APP_ID,
          client_secret: FACEBOOK_APP_SECRET,
          redirect_uri: REDIRECT_URI,
          code: AUTHORIZATION_CODE,
        },
      }
    );

    const userAccessToken = tokenResponse.data.access_token;
    console.log('✅ Step 1 Complete: Got Facebook User Access Token');
    console.log('Access Token:', userAccessToken.substring(0, 50) + '...\n');

    // Step 2: Get user's Facebook pages
    console.log('🔄 Step 2: Getting Facebook pages...\n');

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
      console.log('❌ No Facebook pages found.');
      console.log('You need to create a Facebook page and connect it to your Instagram Business account.');
      return;
    }

    console.log('✅ Step 2 Complete: Found Facebook Pages');
    console.log('Total Pages:', pagesResponse.data.data.length);
    pagesResponse.data.data.forEach((page, index) => {
      console.log(`  Page ${index + 1}: ${page.name} (ID: ${page.id})`);
    });
    console.log('');

    // Use the first page
    const page = pagesResponse.data.data[0];
    const pageAccessToken = page.access_token;
    const pageId = page.id;

    console.log(`📄 Using Page: ${page.name}`);
    console.log(`Page ID: ${pageId}`);
    console.log(`Page Access Token: ${pageAccessToken.substring(0, 50)}...\n`);

    // Step 3: Get Instagram Business Account connected to the page
    console.log('🔄 Step 3: Getting Instagram Business Account...\n');

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
      console.log('❌ No Instagram Business account connected to this Facebook page.');
      console.log('Please connect an Instagram Business or Creator account to your Facebook page.');
      console.log('\nHow to connect:');
      console.log('1. Go to your Facebook page settings');
      console.log('2. Click "Instagram" in the left sidebar');
      console.log('3. Click "Connect Account"');
      console.log('4. Log in with your Instagram Business account');
      return;
    }

    const instagramBusinessAccountId = igAccountResponse.data.instagram_business_account.id;

    console.log('✅ Step 3 Complete: Found Instagram Business Account!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 Instagram Business Account ID:', instagramBusinessAccountId);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Step 4: Get Instagram profile with followers/following
    console.log('🔄 Step 4: Fetching Instagram profile...\n');

    const profileResponse = await axios.get(
      `https://graph.facebook.com/v18.0/${instagramBusinessAccountId}`,
      {
        params: {
          fields: 'id,username,name,profile_picture_url,biography,website,followers_count,follows_count,media_count',
          access_token: pageAccessToken,
        },
      }
    );

    const profile = profileResponse.data;

    console.log('✅ Step 4 Complete: Instagram Profile Retrieved!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 INSTAGRAM PROFILE DATA:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Username:', profile.username || 'N/A');
    console.log('Name:', profile.name || 'N/A');
    console.log('Followers:', profile.followers_count?.toLocaleString() || 'N/A');
    console.log('Following:', profile.follows_count?.toLocaleString() || 'N/A');
    console.log('Media Count:', profile.media_count?.toLocaleString() || 'N/A');
    console.log('Biography:', profile.biography || 'N/A');
    console.log('Website:', profile.website || 'N/A');
    console.log('Profile Picture:', profile.profile_picture_url || 'N/A');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Step 5: Exchange for long-lived token (60 days)
    console.log('🔄 Step 5: Exchanging for long-lived token (60 days)...\n');

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
    const expiresIn = longLivedResponse.data.expires_in;
    const expiresInDays = Math.floor(expiresIn / (60 * 60 * 24));

    console.log('✅ Step 5 Complete: Long-lived token obtained!');
    console.log('Token expires in:', expiresInDays, 'days\n');

    // Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📝 SUMMARY - SAVE THESE VALUES:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('instagram_business_account_id:', instagramBusinessAccountId);
    console.log('access_token:', longLivedToken);
    console.log('page_id:', pageId);
    console.log('username:', profile.username);
    console.log('followers_count:', profile.followers_count);
    console.log('follows_count:', profile.follows_count);
    console.log('token_expires_in_days:', expiresInDays);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('💾 Save this data to your database for the influencer!');

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);

    if (error.response?.data?.error) {
      const fbError = error.response.data.error;
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('Facebook API Error Details:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('Message:', fbError.message);
      console.log('Type:', fbError.type);
      console.log('Code:', fbError.code);
      console.log('Subcode:', fbError.error_subcode);

      if (fbError.message.includes('expired')) {
        console.log('\n⚠️  The authorization code has expired!');
        console.log('Authorization codes are short-lived (few minutes).');
        console.log('You need to get a new one by going through the OAuth flow again.');
      }

      if (fbError.message.includes('redirect_uri')) {
        console.log('\n⚠️  Redirect URI mismatch!');
        console.log('The redirect_uri must EXACTLY match what you used in the OAuth flow.');
        console.log('Current redirect_uri:', REDIRECT_URI);
        console.log('Try changing it to the exact URL you used.');
      }
    }
  }
}

// Run the script
getInstagramBusinessAccountId();
