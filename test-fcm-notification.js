// Test FCM Notification Script
// Run with: node test-fcm-notification.js

const { Sequelize } = require('sequelize');
const admin = require('firebase-admin');
require('dotenv').config();

// Initialize Firebase Admin
const serviceAccount = {
  type: 'service_account',
  projectId: process.env.FIREBASE_PROJECT_ID,
  privateKeyId: process.env.FIREBASE_PRIVATE_KEY_ID,
  privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  clientId: process.env.FIREBASE_CLIENT_ID,
  authUri: process.env.FIREBASE_AUTH_URI || 'https://accounts.google.com/o/oauth2/auth',
  tokenUri: process.env.FIREBASE_TOKEN_URI || 'https://oauth2.googleapis.com/token',
  authProviderX509CertUrl: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL || 'https://www.googleapis.com/oauth2/v1/certs',
  clientC509CertUrl: process.env.FIREBASE_CLIENT_CERT_URL,
  universeDomain: process.env.FIREBASE_UNIVERSE_DOMAIN || 'googleapis.com',
};

try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.projectId,
  });
  console.log('✅ Firebase initialized successfully');
} catch (error) {
  console.error('❌ Firebase initialization error:', error.message);
  process.exit(1);
}

// Connect to database
const sequelize = new Sequelize(
  process.env.POSTGRES_DB,
  process.env.POSTGRES_USER,
  process.env.POSTGRES_PASSWORD,
  {
    host: process.env.POSTGRES_HOST,
    port: process.env.POSTGRES_PORT,
    dialect: 'postgres',
    logging: false,
  }
);

async function testNotification() {
  try {
    console.log('🔍 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Database connected');

    // Get FCM token for user ID 7
    console.log('\n🔍 Fetching FCM token for influencer ID 7...');
    const [results] = await sequelize.query(
      'SELECT id, name, "fcmToken" FROM influencers WHERE id = 7'
    );

    if (!results || results.length === 0) {
      console.error('❌ Influencer ID 7 not found');
      process.exit(1);
    }

    const influencer = results[0];
    console.log('✅ Influencer found:', influencer.name);

    if (!influencer.fcmToken) {
      console.error('❌ No FCM token found for this influencer');
      console.log('   Please update the FCM token first');
      process.exit(1);
    }

    console.log('✅ FCM Token found:', influencer.fcmToken.substring(0, 50) + '...');

    // Send test notification
    console.log('\n📤 Sending test notification...');
    const message = {
      notification: {
        title: '🔔 Test Notification',
        body: 'This is a test push notification from your backend!',
      },
      data: {
        type: 'test',
        timestamp: Date.now().toString(),
      },
      token: influencer.fcmToken,
    };

    const response = await admin.messaging().send(message);
    console.log('✅ Notification sent successfully!');
    console.log('📋 Message ID:', response);
    console.log('\n✨ Check the frontend device for the notification!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.code) {
      console.error('   Error Code:', error.code);
    }
    if (error.details) {
      console.error('   Details:', error.details);
    }
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

testNotification();
