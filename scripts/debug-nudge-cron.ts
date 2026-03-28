/**
 * Debug script for nudge notification cron job
 * Run with: npx ts-node scripts/debug-nudge-cron.ts
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { SubscriptionMarketingService } from '../src/influencer/services/subscription-marketing.service';

async function debugNudgeCron() {
  console.log('🔍 Debugging Nudge Notification Cron Job...\n');

  const app = await NestFactory.createApplicationContext(AppModule);
  const subscriptionMarketingService = app.get(SubscriptionMarketingService);

  // Get Sequelize instance to run raw queries
  const sequelize = app.get('SEQUELIZE');

  console.log('='.repeat(60));
  console.log('1. CHECKING SERVER TIMEZONE');
  console.log('='.repeat(60));
  const now = new Date();
  console.log(`Server time: ${now.toLocaleString()}`);
  console.log(`Server timezone offset: UTC${now.getTimezoneOffset() / -60 >= 0 ? '+' : ''}${now.getTimezoneOffset() / -60}`);
  console.log(`Cron runs at: 10:00 AM ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
  console.log('');

  console.log('='.repeat(60));
  console.log('2. CHECKING NUDGE MESSAGE TEMPLATES');
  console.log('='.repeat(60));

  try {
    const [templates] = await sequelize.query(`
      SELECT
        id,
        title,
        message_type,
        is_active,
        rotation_order,
        times_sent,
        valid_from,
        valid_until
      FROM nudge_message_templates
      ORDER BY message_type, rotation_order
    `);

    if (!templates || templates.length === 0) {
      console.log('❌ NO TEMPLATES FOUND!');
      console.log('   This is likely why notifications are not being sent.');
      console.log('   You need to create templates via the admin panel or run the seed script.\n');
    } else {
      console.log(`✅ Found ${templates.length} template(s):`);
      console.table(templates);
      console.log('');
    }
  } catch (error) {
    console.error('❌ Error fetching templates:', error.message);
    console.log('');
  }

  console.log('='.repeat(60));
  console.log('3. CHECKING ELIGIBLE USERS FOR NUDGES');
  console.log('='.repeat(60));

  try {
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    const [users] = await sequelize.query(`
      SELECT
        COUNT(*) as total_non_pro,
        COUNT(CASE WHEN created_at < :threeDaysAgo THEN 1 END) as past_grace_period,
        COUNT(CASE WHEN is_verified = true THEN 1 END) as verified,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active,
        COUNT(CASE WHEN
          is_verified = true AND
          is_active = true AND
          created_at < :threeDaysAgo
        THEN 1 END) as eligible_for_nudge
      FROM influencers
      WHERE is_pro = false AND deleted_at IS NULL
    `, {
      replacements: { threeDaysAgo }
    });

    console.table(users);
    console.log('');

    // Show sample of eligible users
    const [sampleUsers] = await sequelize.query(`
      SELECT
        id,
        name,
        username,
        created_at,
        last_nudge_sent_at,
        first_nudge_sent_at,
        nudge_count,
        weekly_credits
      FROM influencers
      WHERE
        is_pro = false AND
        is_verified = true AND
        is_active = true AND
        created_at < :threeDaysAgo AND
        deleted_at IS NULL
      ORDER BY COALESCE(last_nudge_sent_at, '1970-01-01') ASC
      LIMIT 5
    `, {
      replacements: { threeDaysAgo }
    });

    console.log('Sample of eligible users:');
    console.table(sampleUsers);
    console.log('');

  } catch (error) {
    console.error('❌ Error checking users:', error.message);
    console.log('');
  }

  console.log('='.repeat(60));
  console.log('4. CHECKING DEVICE TOKENS (FCM)');
  console.log('='.repeat(60));

  try {
    const [tokenStats] = await sequelize.query(`
      SELECT
        COUNT(DISTINCT user_id) as users_with_tokens,
        COUNT(*) as total_tokens
      FROM device_tokens
      WHERE user_type = 'influencer' AND deleted_at IS NULL
    `);

    console.table(tokenStats);
    console.log('');

    if (tokenStats[0]?.users_with_tokens === 0) {
      console.log('⚠️  WARNING: No FCM tokens found!');
      console.log('   Users need to log in to the mobile app to register FCM tokens.');
      console.log('');
    }
  } catch (error) {
    console.error('❌ Error checking device tokens:', error.message);
    console.log('');
  }

  console.log('='.repeat(60));
  console.log('5. TESTING CRON JOB MANUALLY');
  console.log('='.repeat(60));
  console.log('Running the cron job now...\n');

  try {
    await subscriptionMarketingService.sendDailySubscriptionNudges();
    console.log('\n✅ Cron job completed successfully!');
    console.log('   Check the logs above for details about notifications sent.');
  } catch (error) {
    console.error('\n❌ Error running cron job:', error.message);
    console.error('Stack:', error.stack);
  }

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY & RECOMMENDATIONS');
  console.log('='.repeat(60));
  console.log(`
If notifications are still not being sent, check:

1. ✅ Templates exist in database (see section 2)
   - Run: npm run seed:nudge-templates (if you create this seed)
   - OR: Create via admin panel at /admin/nudge-templates

2. ✅ Eligible users exist (see section 3)
   - Users must be: non-Pro, verified, active, joined >3 days ago
   - Users must not have received nudge in last X days (based on smart frequency)

3. ✅ FCM tokens exist (see section 4)
   - Users must have logged into mobile app
   - Tokens are stored in device_tokens table

4. ✅ Cron is running (see section 5)
   - Scheduled for 10:00 AM server time (${Intl.DateTimeFormat().resolvedOptions().timeZone})
   - To change time, edit @Cron decorator in subscription-marketing.service.ts

5. ✅ Check application logs for errors
   - Look for: "Starting smart frequency subscription nudges"
   - Look for: "Smart nudges complete"
   - Check for any error messages

6. ✅ Verify ScheduleModule is imported in app.module.ts
   - Cron jobs require @nestjs/schedule to be set up
  `);

  await app.close();
  process.exit(0);
}

debugNudgeCron().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
