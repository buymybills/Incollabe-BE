import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CommentAutomation, CommentMatchType } from '../models/comment-automation.model';

export interface CreateCommentAutomationInput {
  title: string;
  mediaUrl: string;
  keyword: string;
  matchType?: CommentMatchType;
  commentReply?: string | null;
  dmMessage?: string | null;
  isActive?: boolean;
  createdBy?: number | null;
}

export type UpdateCommentAutomationInput = Partial<CreateCommentAutomationInput>;

@Injectable()
export class CommentAutomationService {
  private readonly logger = new Logger(CommentAutomationService.name);

  constructor(
    @InjectModel(CommentAutomation)
    private readonly commentAutomationModel: typeof CommentAutomation,
  ) {}

  /**
   * Parse the post/reel shortcode out of an Instagram URL.
   * Handles /p/<code>/, /reel/<code>/, /reels/<code>/, /tv/<code>/.
   */
  static parseShortcode(url: string): string | null {
    if (!url) return null;
    const match = url.match(/instagram\.com\/(?:[^/]+\/)?(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i);
    return match ? match[1] : null;
  }

  // ---- CRUD ----

  async create(input: CreateCommentAutomationInput): Promise<CommentAutomation> {
    return this.commentAutomationModel.create({
      title: input.title,
      mediaUrl: input.mediaUrl,
      mediaShortcode: CommentAutomationService.parseShortcode(input.mediaUrl),
      keyword: input.keyword,
      matchType: input.matchType ?? CommentMatchType.CONTAINS,
      commentReply: input.commentReply ?? null,
      dmMessage: input.dmMessage ?? null,
      isActive: input.isActive ?? true,
      createdBy: input.createdBy ?? null,
    } as any);
  }

  async findAll(params: { page?: number; limit?: number; isActive?: boolean; search?: string }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));

    const where: any = {};
    if (typeof params.isActive === 'boolean') where.isActive = params.isActive;

    const { rows, count } = await this.commentAutomationModel.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit,
      offset: (page - 1) * limit,
    });

    // Lightweight in-memory search across title/keyword/url (table is small).
    let automations = rows;
    if (params.search?.trim()) {
      const q = params.search.trim().toLowerCase();
      automations = rows.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.keyword.toLowerCase().includes(q) ||
          a.mediaUrl.toLowerCase().includes(q),
      );
    }

    return {
      automations,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    };
  }

  async findById(id: number): Promise<CommentAutomation> {
    const automation = await this.commentAutomationModel.findByPk(id);
    if (!automation) throw new NotFoundException('Comment automation not found');
    return automation;
  }

  async update(id: number, input: UpdateCommentAutomationInput): Promise<CommentAutomation> {
    const automation = await this.findById(id);

    if (input.title !== undefined) automation.title = input.title;
    if (input.mediaUrl !== undefined) {
      automation.mediaUrl = input.mediaUrl;
      automation.mediaShortcode = CommentAutomationService.parseShortcode(input.mediaUrl);
      automation.mediaId = null; // force re-resolution against the new link
    }
    if (input.keyword !== undefined) automation.keyword = input.keyword;
    if (input.matchType !== undefined) automation.matchType = input.matchType;
    if (input.commentReply !== undefined) automation.commentReply = input.commentReply;
    if (input.dmMessage !== undefined) automation.dmMessage = input.dmMessage;
    if (input.isActive !== undefined) automation.isActive = input.isActive;

    await automation.save();
    return automation;
  }

  async setActive(id: number, isActive: boolean): Promise<CommentAutomation> {
    const automation = await this.findById(id);
    automation.isActive = isActive;
    await automation.save();
    return automation;
  }

  async remove(id: number): Promise<void> {
    const automation = await this.findById(id);
    await automation.destroy();
  }

  // ---- Matching (used by the webhook) ----

  /**
   * Find the active rule that matches an incoming comment, scoped to the media
   * the comment was left on. Returns null when nothing matches — which is the
   * common case and means we do nothing (no "alert on every post").
   *
   * Matches media by stored mediaId (fast path) or by shortcode. When a match
   * is found by shortcode and mediaId is not yet stored, it is cached.
   */
  async findMatchingRule(
    mediaId: string | null,
    shortcode: string | null,
    commentText: string,
  ): Promise<CommentAutomation | null> {
    const active = await this.commentAutomationModel.findAll({ where: { isActive: true } });

    for (const rule of active) {
      const mediaMatches =
        (rule.mediaId && mediaId && rule.mediaId === mediaId) ||
        (rule.mediaShortcode && shortcode && rule.mediaShortcode === shortcode);

      if (!mediaMatches) continue;
      if (!rule.matchesText(commentText)) continue;

      // Cache the resolved media id for faster future matches.
      if (!rule.mediaId && mediaId) {
        rule.mediaId = mediaId;
        await rule.save().catch((e) => this.logger.warn(`Could not cache mediaId: ${e.message}`));
      }
      return rule;
    }

    return null;
  }

  /** Record that a rule fired. */
  async markTriggered(id: number): Promise<void> {
    await this.commentAutomationModel.increment('trigger_count', { where: { id } });
    await this.commentAutomationModel.update(
      { lastTriggeredAt: new Date() } as any,
      { where: { id } },
    );
  }
}
