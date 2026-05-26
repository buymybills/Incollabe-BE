import { Module } from '@nestjs/common';
import { SharedModule } from './shared.module';
import { ShoppingAgentModule } from '../shopping-agent/shopping-agent.module';
import { MetaWebhookController } from './controllers/meta-webhook.controller';

/**
 * Standalone module for the Meta/Instagram DM webhook.
 * Kept separate from SharedModule to avoid a circular import
 * (ShoppingAgentModule → SharedModule ← MetaWebhookModule → ShoppingAgentModule).
 */
@Module({
  imports: [SharedModule, ShoppingAgentModule],
  controllers: [MetaWebhookController],
})
export class MetaWebhookModule {}
