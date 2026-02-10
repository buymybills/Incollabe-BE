import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { SequelizeModule } from '@nestjs/sequelize';
import { NotificationQueueProcessor } from './notification.queue.processor';
import { PushNotification } from '../models/push-notification.model';
import { SharedModule } from '../../shared/shared.module';

@Module({
  imports: [
    // Register Bull queue
    BullModule.registerQueue({
      name: 'notifications',
    }),
    SequelizeModule.forFeature([PushNotification]),
    SharedModule, // Contains NotificationService, DeviceTokenService, FirebaseService, etc.
  ],
  providers: [NotificationQueueProcessor],
  exports: [BullModule],
})
export class NotificationQueueModule {}
