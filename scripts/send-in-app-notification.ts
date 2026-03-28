/**
 * Script: Send In-App Notification to Specific Installation
 *
 * This creates a notification in the in_app_notifications table
 * that will appear when the user opens the app and fetches notifications
 *
 * Usage:
 *   npx ts-node scripts/send-in-app-notification.ts
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { InAppNotificationService } from '../src/shared/in-app-notification.service';
import { NotificationType, NotificationPriority } from '../src/shared/models/in-app-notification.model';

async function sendInAppNotification() {
  console.log('🚀 Starting in-app notification script...\n');

  // Create NestJS application context
  const app = await NestFactory.createApplicationContext(AppModule);
  const notificationService = app.get(InAppNotificationService);

  // Target device details
  const userId = 15;
  const userType = 'influencer';
  const installationId = 'e5OP97DsSey9TIGJTLHCcM';

  console.log('📱 Target Device Info:');
  console.log(`   User ID: ${userId}`);
  console.log(`   User Type: ${userType}`);
  console.log(`   Installation ID: ${installationId}`);
  console.log('');

  // Create in-app notification
  console.log('📝 Creating in-app notification...');

  const notification = await notificationService.createNotification({
    userId: userId,
    userType: userType as 'influencer' | 'brand',
    title: '🎯 Test from Script!',
    body: `This in-app notification was sent from localhost script at ${new Date().toLocaleTimeString()}. Installation: ${installationId.substring(0, 10)}...`,
    type: NotificationType.SYSTEM_ANNOUNCEMENT,
    actionUrl: 'app://home',
    actionType: 'open_home',
    relatedEntityType: 'test',
    metadata: {
      installationId: installationId,
      sentViaScript: true,
      timestamp: new Date().toISOString(),
      device: 'samsung SM-S921E',
      testMessage: true,
    },
    priority: NotificationPriority.HIGH,
  });

  console.log('✅ In-app notification created successfully!\n');

  console.log('📊 Notification Details:');
  console.log(`   ID: ${notification.id}`);
  console.log(`   Title: ${notification.title}`);
  console.log(`   Type: ${notification.type}`);
  console.log(`   Priority: ${notification.priority}`);
  console.log(`   Created At: ${notification.createdAt}`);
  console.log('');

  console.log('📲 How to see this notification in your app:\n');
  console.log('   1. Open your app on the device (samsung SM-S921E)');
  console.log('   2. Navigate to the notifications section');
  console.log('   3. The app will call: GET /api/notifications');
  console.log('   4. You should see your notification appear!');
  console.log('');

  console.log('🔍 Or verify in database:');
  console.log(`   SELECT * FROM in_app_notifications WHERE id = ${notification.id};`);
  console.log('');

  console.log('✨ Done!');

  await app.close();
  process.exit(0);
}

// Run the script
sendInAppNotification().catch((error) => {
  console.error('❌ Error sending in-app notification:', error);
  process.exit(1);
});
