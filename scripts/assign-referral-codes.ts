/**
 * Script to assign unique referral codes to all existing influencers
 * Run with: npx ts-node scripts/assign-referral-codes.ts
 */

import { Sequelize } from 'sequelize-typescript';
import { config } from 'dotenv';
import { Influencer } from '../src/auth/model/influencer.model';

// Load environment variables
config();

const sequelize = new Sequelize({
  dialect: 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: Number(process.env.POSTGRES_PORT) || 5432,
  username: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'root',
  database: process.env.POSTGRES_DB || 'incollab_db',
  models: [Influencer],
  logging: false,
});

/**
 * Generate unique 8-character referral code
 * Same logic as in auth.service.ts
 */
async function generateUniqueReferralCode(): Promise<string> {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  let isUnique = false;

  while (!isUnique) {
    code = '';
    for (let i = 0; i < 8; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    // Check if code already exists
    const existing = await Influencer.findOne({
      where: { referralCode: code },
    });

    if (!existing) {
      isUnique = true;
    }
  }

  return code;
}

async function assignReferralCodes() {
  try {
    console.log('🔗 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Database connected successfully\n');

    // Get all influencers without referral codes
    const influencersWithoutCodes = await Influencer.findAll({
      where: { referralCode: null },
      attributes: ['id', 'email', 'name'],
    });

    const total = influencersWithoutCodes.length;
    console.log(`📊 Found ${total} influencers without referral codes\n`);

    if (total === 0) {
      console.log('✅ All influencers already have referral codes!');
      process.exit(0);
    }

    console.log('🚀 Starting referral code assignment...\n'); 

    let processed = 0;
    const errors: Array<{ id: number; error: string }> = [];

    for (const influencer of influencersWithoutCodes) {
      try {
        const code = await generateUniqueReferralCode();
        await influencer.update({ referralCode: code });

        processed++;
        console.log(
          `✅ [${processed}/${total}] Assigned code "${code}" to influencer ID ${influencer.id} (${influencer.name})`,
        );
      } catch (error) {
        errors.push({
          id: influencer.id,
          error: error.message,
        });
        console.error(
          `❌ [${processed + 1}/${total}] Failed for influencer ID ${influencer.id}: ${error.message}`,
        );
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`✅ Successfully assigned ${processed} referral codes`);

    if (errors.length > 0) {
      console.log(`❌ Failed for ${errors.length} influencers:`);
      errors.forEach((err) => {
        console.log(`   - Influencer ID ${err.id}: ${err.error}`);
      });
    }

    // Verify results
    const totalWithCodes = await Influencer.count({
      where: { referralCode: { $ne: null } },
    });
    const totalInfluencers = await Influencer.count();

    console.log('\n📊 Final Statistics:');
    console.log(`   Total Influencers: ${totalInfluencers}`);
    console.log(`   With Referral Codes: ${totalWithCodes}`);
    console.log(`   Without Referral Codes: ${totalInfluencers - totalWithCodes}`);
    console.log('='.repeat(60) + '\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the script
assignReferralCodes();
