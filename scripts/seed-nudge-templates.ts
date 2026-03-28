/**
 * Seed script to populate nudge message templates
 * Run with: npx ts-node scripts/seed-nudge-templates.ts
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { NudgeMessageType } from '../src/shared/models/nudge-message-template.model';

async function seedNudgeTemplates() {
  console.log('🌱 Seeding nudge message templates...\n');

  const app = await NestFactory.createApplicationContext(AppModule);
  const sequelize = app.get('SEQUELIZE');

  const templates = [
    // ROTATION MESSAGES (Generic, rotate through these)
    {
      title: '3x more opportunities with MAX 🚀',
      body: 'MAX members earn 3x more on average. Get unlimited applications, priority in campaigns & exclusive perks for ₹199/month',
      messageType: NudgeMessageType.ROTATION,
      rotationOrder: 1,
      priority: 5,
      isActive: true,
    },
    {
      title: 'Unlock unlimited campaigns 🎯',
      body: 'Stop waiting for credits to reset! MAX subscribers apply to unlimited campaigns and never miss opportunities. Join now for ₹199/month',
      messageType: NudgeMessageType.ROTATION,
      rotationOrder: 2,
      priority: 5,
      isActive: true,
    },
    {
      title: 'Get priority access 👑',
      body: 'MAX members get priority in campaign selections and exclusive high-paying opportunities. Upgrade today and boost your earnings!',
      messageType: NudgeMessageType.ROTATION,
      rotationOrder: 3,
      priority: 5,
      isActive: true,
    },
    {
      title: 'Join 10,000+ MAX members 💫',
      body: 'The most successful creators on Incollab use MAX. Get unlimited applications + priority access for just ₹199/month',
      messageType: NudgeMessageType.ROTATION,
      rotationOrder: 4,
      priority: 5,
      isActive: true,
    },
    {
      title: 'Double your campaign success rate 📈',
      body: 'MAX members get selected 2x more often with unlimited applications and priority matching. Start your MAX journey today!',
      messageType: NudgeMessageType.ROTATION,
      rotationOrder: 5,
      priority: 5,
      isActive: true,
    },

    // OUT OF CREDITS MESSAGES (High priority, urgent)
    {
      title: 'Out of credits? Upgrade to MAX! 🔥',
      body: 'Never run out of applications again! MAX members get UNLIMITED campaign applications for just ₹199/month. Upgrade now!',
      messageType: NudgeMessageType.OUT_OF_CREDITS,
      requiresZeroCredits: true,
      priority: 10,
      isActive: true,
    },
    {
      title: "Don't let credits stop you! 💪",
      body: "You've used all your weekly credits. MAX subscribers never wait - they apply to unlimited campaigns instantly. Join MAX for ₹199/month",
      messageType: NudgeMessageType.OUT_OF_CREDITS,
      requiresZeroCredits: true,
      priority: 10,
      isActive: true,
    },

    // ACTIVE USER MESSAGES (For users with 5+ applications)
    {
      title: "You're on fire! 🔥 Take it further with MAX",
      body: "You've applied to {campaignApplications} campaigns! Imagine what you could do with UNLIMITED applications. Join MAX for ₹199/month",
      messageType: NudgeMessageType.ACTIVE_USER,
      minCampaignApplications: 5,
      priority: 8,
      isActive: true,
    },
    {
      title: 'Active creators love MAX 💎',
      body: 'With {campaignApplications} applications, you clearly love campaigns! MAX gives you unlimited access + priority selection. Upgrade now!',
      messageType: NudgeMessageType.ACTIVE_USER,
      minCampaignApplications: 5,
      priority: 8,
      isActive: true,
    },
  ];

  try {
    // Clear existing templates (optional - comment out if you want to keep existing ones)
    console.log('🗑️  Clearing existing templates...');
    await sequelize.query('TRUNCATE TABLE nudge_message_templates RESTART IDENTITY CASCADE');

    // Insert new templates
    console.log('📝 Inserting new templates...\n');

    for (const template of templates) {
      await sequelize.query(
        `
        INSERT INTO nudge_message_templates (
          title,
          body,
          message_type,
          rotation_order,
          min_campaign_applications,
          requires_zero_credits,
          is_active,
          priority,
          created_at,
          updated_at
        ) VALUES (
          :title,
          :body,
          :messageType,
          :rotationOrder,
          :minCampaignApplications,
          :requiresZeroCredits,
          :isActive,
          :priority,
          NOW(),
          NOW()
        )
      `,
        {
          replacements: {
            title: template.title,
            body: template.body,
            messageType: template.messageType,
            rotationOrder: template.rotationOrder || null,
            minCampaignApplications: template.minCampaignApplications || null,
            requiresZeroCredits: template.requiresZeroCredits || false,
            isActive: template.isActive,
            priority: template.priority,
          },
        },
      );

      console.log(`✅ Created: ${template.title}`);
    }

    console.log(`\n✅ Successfully seeded ${templates.length} nudge message templates!`);

    // Show summary
    const [summary] = await sequelize.query(`
      SELECT
        message_type,
        COUNT(*) as count,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active_count
      FROM nudge_message_templates
      GROUP BY message_type
      ORDER BY message_type
    `);

    console.log('\n📊 Summary:');
    console.table(summary);

    console.log(`
✅ Setup complete!

The nudge cron job will now:
1. Run daily at 10:00 AM server time
2. Use these templates with smart rotation and personalization
3. Target non-Pro users based on their behavior

To test immediately, run:
  npx ts-node scripts/debug-nudge-cron.ts
    `);
  } catch (error) {
    console.error('❌ Error seeding templates:', error.message);
    console.error(error);
    process.exit(1);
  }

  await app.close();
  process.exit(0);
}

seedNudgeTemplates().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
