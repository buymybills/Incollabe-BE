import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity } from '@nestjs/swagger';
import { BotKeyGuard } from '../../bot-analytics/guards/bot-key.guard';
import { CommentAutomationService } from '../../shared/services/comment-automation.service';

/**
 * Bot-facing endpoint: the Instagram bot calls this when a comment arrives to
 * find a matching automation rule. The backend only STORES + matches the rules;
 * the bot performs the actual comment reply + DM via the Graph API.
 *
 * Secured by the shared x-bot-key (server-to-server, same as analytics).
 */
@ApiTags('Bot - Comment Automation')
@ApiSecurity('x-bot-key')
@Controller('bot-comment-automation')
@UseGuards(BotKeyGuard)
export class BotCommentAutomationController {
  constructor(private readonly commentAutomationService: CommentAutomationService) {}

  @Post('match')
  @ApiOperation({ summary: 'Find the automation rule matching a comment (and count the trigger)' })
  async match(
    @Body() body: { mediaId?: string; shortcode?: string; text?: string },
  ) {
    const rule = await this.commentAutomationService.findMatchingRule(
      body.mediaId ?? null,
      body.shortcode ?? null,
      body.text ?? '',
    );

    if (!rule) return { matched: false };

    // Count the trigger now; the bot does the actual reply + DM.
    await this.commentAutomationService.markTriggered(rule.id).catch(() => {});

    return {
      matched: true,
      rule: {
        id: rule.id,
        title: rule.title,
        commentReply: rule.commentReply,
        dmMessage: rule.dmMessage,
      },
    };
  }
}
