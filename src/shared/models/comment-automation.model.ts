import { Table, Column, Model, DataType } from 'sequelize-typescript';

export enum CommentMatchType {
  CONTAINS = 'contains', // Comment contains the keyword anywhere
  EXACT = 'exact', // Comment text equals the keyword exactly
}

/**
 * Admin-configured rule that links a specific Instagram post/reel + a trigger
 * keyword to an automated public comment reply and an automated private DM.
 *
 * Only comments on a media that has a matching rule (and whose text matches the
 * keyword) trigger any automation — there is intentionally no "react to every
 * comment" behaviour.
 */
@Table({
  tableName: 'comment_automations',
  timestamps: true,
  underscored: true,
})
export class CommentAutomation extends Model {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  declare id: number;

  /** Human-friendly label shown in the admin panel. */
  @Column({
    type: DataType.STRING(255),
    allowNull: false,
  })
  declare title: string;

  /** The raw post/reel link the admin pasted. */
  @Column({
    type: DataType.TEXT,
    allowNull: false,
    field: 'media_url',
  })
  declare mediaUrl: string;

  /** Shortcode parsed from the link (e.g. the "Cabc123" in /reel/Cabc123/). */
  @Column({
    type: DataType.STRING(100),
    allowNull: true,
    field: 'media_shortcode',
  })
  declare mediaShortcode: string | null;

  /** Numeric IG media id — resolved lazily from the webhook and cached here. */
  @Column({
    type: DataType.STRING(100),
    allowNull: true,
    field: 'media_id',
  })
  declare mediaId: string | null;

  /** Comma-separated trigger keyword(s). */
  @Column({
    type: DataType.STRING(500),
    allowNull: false,
  })
  declare keyword: string;

  @Column({
    type: DataType.STRING(20),
    allowNull: false,
    defaultValue: CommentMatchType.CONTAINS,
    field: 'match_type',
  })
  declare matchType: CommentMatchType;

  /** Public reply posted under the matching comment. Optional. */
  @Column({
    type: DataType.TEXT,
    allowNull: true,
    field: 'comment_reply',
  })
  declare commentReply: string | null;

  /** Private DM sent to the commenter. Optional. */
  @Column({
    type: DataType.TEXT,
    allowNull: true,
    field: 'dm_message',
  })
  declare dmMessage: string | null;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_active',
  })
  declare isActive: boolean;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'trigger_count',
  })
  declare triggerCount: number;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'last_triggered_at',
  })
  declare lastTriggeredAt: Date | null;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: 'created_by',
  })
  declare createdBy: number | null;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    defaultValue: DataType.NOW,
    field: 'created_at',
  })
  declare createdAt: Date;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    defaultValue: DataType.NOW,
    field: 'updated_at',
  })
  declare updatedAt: Date;

  /** Split the comma-separated keyword column into a trimmed, non-empty list. */
  keywordList(): string[] {
    return (this.keyword ?? '')
      .split(',')
      .map((k) => k.trim().toLowerCase())
      .filter((k) => k.length > 0);
  }

  /** Does this rule's keyword(s) match the given comment text? */
  matchesText(commentText: string): boolean {
    const text = (commentText ?? '').trim().toLowerCase();
    if (!text) return false;
    const keywords = this.keywordList();
    if (keywords.length === 0) return false;

    if (this.matchType === CommentMatchType.EXACT) {
      return keywords.some((k) => text === k);
    }
    return keywords.some((k) => text.includes(k));
  }
}
