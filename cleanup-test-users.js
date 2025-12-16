/**
 * Cleanup Test Users Script
 * 
 * Removes all test users created during load testing from production database
 * Run after load testing: node cleanup-test-users.js
 */

import { Sequelize } from 'sequelize';
import * as dotenv from 'dotenv';

dotenv.config();

const sequelize = new Sequelize({
  dialect: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  logging: console.log,
});

async function cleanupTestUsers() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database');

    // Start transaction for safety
    const transaction = await sequelize.transaction();

    try {
      // Count test users before cleanup
      const [brandsBefore] = await sequelize.query(
        `SELECT COUNT(*) as count FROM brands WHERE email LIKE 'loadtest%@example.com'`,
        { transaction }
      );
      const [influencersBefore] = await sequelize.query(
        `SELECT COUNT(*) as count FROM influencers WHERE email LIKE 'loadtest%@example.com'`,
        { transaction }
      );

      console.log('\n📊 Before cleanup:');
      console.log(`   Test Brands: ${brandsBefore[0].count}`);
      console.log(`   Test Influencers: ${influencersBefore[0].count}`);

      // Delete test users (cascade will handle related records)
      const [deletedBrands] = await sequelize.query(
        `DELETE FROM brands 
         WHERE email LIKE 'loadtest%@example.com' 
           AND created_at > NOW() - INTERVAL '2 days'
         RETURNING id`,
        { transaction }
      );

      const [deletedInfluencers] = await sequelize.query(
        `DELETE FROM influencers 
         WHERE email LIKE 'loadtest%@example.com' 
           AND created_at > NOW() - INTERVAL '2 days'
         RETURNING id`,
        { transaction }
      );

      console.log('\n🗑️  Deleted:');
      console.log(`   Brands: ${deletedBrands.length}`);
      console.log(`   Influencers: ${deletedInfluencers.length}`);

      // Verify cleanup
      const [brandsAfter] = await sequelize.query(
        `SELECT COUNT(*) as count FROM brands WHERE email LIKE 'loadtest%@example.com'`,
        { transaction }
      );
      const [influencersAfter] = await sequelize.query(
        `SELECT COUNT(*) as count FROM influencers WHERE email LIKE 'loadtest%@example.com'`,
        { transaction }
      );

      console.log('\n📊 After cleanup:');
      console.log(`   Remaining Test Brands: ${brandsAfter[0].count}`);
      console.log(`   Remaining Test Influencers: ${influencersAfter[0].count}`);

      // Commit if everything looks good
      await transaction.commit();
      console.log('\n✅ Cleanup completed successfully');

    } catch (error) {
      await transaction.rollback();
      console.error('\n❌ Error during cleanup, transaction rolled back:', error);
      throw error;
    }

  } catch (error) {
    console.error('❌ Database connection error:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run cleanup
cleanupTestUsers()
  .then(() => {
    console.log('\n✨ All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Cleanup failed:', error);
    process.exit(1);
  });
