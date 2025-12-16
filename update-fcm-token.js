// Update FCM Token Script
// Usage: node update-fcm-token.js <userId> <fcmToken>

const { Sequelize } = require('sequelize');
require('dotenv').config();

const userId = process.argv[2];
const fcmToken = process.argv[3];

if (!userId || !fcmToken) {
  console.error('❌ Usage: node update-fcm-token.js <userId> <fcmToken>');
  console.error('   Example: node update-fcm-token.js 7 "dM2BknbvGWqInf..."');
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

async function updateToken() {
  try {
    console.log(`\n🔄 Updating FCM token for user ID ${userId}...`);
    console.log(`📝 Token length: ${fcmToken.length} characters`);
    console.log(`📝 Token preview: ${fcmToken.substring(0, 50)}...`);

    await sequelize.authenticate();
    console.log('✅ Database connected');

    // Validate token format (basic check)
    if (fcmToken.length < 100) {
      console.error('⚠️  Warning: Token seems too short (< 100 chars)');
    }

    if (fcmToken.includes('\n') || fcmToken.includes('\r')) {
      console.error('❌ Error: Token contains line breaks! Please provide token as one line.');
      process.exit(1);
    }

    // Update the token
    const [results, metadata] = await sequelize.query(
      'UPDATE influencers SET "fcmToken" = :token WHERE id = :userId RETURNING id, name, "fcmToken"',
      {
        replacements: { token: fcmToken, userId },
      }
    );

    if (results.length === 0) {
      console.error(`❌ User ID ${userId} not found`);
      process.exit(1);
    }

    const updated = results[0];
    console.log('\n✅ Token updated successfully!');
    console.log(`   User: ${updated.name} (ID: ${updated.id})`);
    console.log(`   Token length in DB: ${updated.fcmToken.length}`);
    console.log(`   Token matches: ${updated.fcmToken === fcmToken ? '✅ Yes' : '❌ No'}`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

updateToken();
