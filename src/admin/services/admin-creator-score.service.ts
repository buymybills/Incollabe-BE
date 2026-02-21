import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, literal, fn, col } from 'sequelize';
import { Influencer } from '../../auth/model/influencer.model';
import { InfluencerProfileScore } from '../../shared/models/influencer-profile-score.model';
import { InfluencerProfileScoringService } from '../../shared/services/influencer-profile-scoring.service';
import { GetCreatorScoresDto, GetCreatorScoresDashboardDto } from '../dto/get-creator-scores.dto';

@Injectable()
export class AdminCreatorScoreService {
  constructor(
    @InjectModel(Influencer)
    private influencerModel: typeof Influencer,
    @InjectModel(InfluencerProfileScore)
    private influencerProfileScoreModel: typeof InfluencerProfileScore,
    private readonly influencerProfileScoringService: InfluencerProfileScoringService,
  ) {}

  async getCreatorScores(dto: GetCreatorScoresDto) {
    const { page = 1, limit = 20, search, startDate, endDate } = dto;
    const offset = (page - 1) * limit;

    const whereClause: any = {
      instagramConnectedAt: { [Op.ne]: null },
    };

    if (startDate || endDate) {
      whereClause.instagramConnectedAt = {
        [Op.ne]: null,
        ...(startDate && endDate
          ? { [Op.between]: [new Date(startDate), new Date(endDate + 'T23:59:59.999Z')] }
          : startDate
          ? { [Op.gte]: new Date(startDate) }
          : { [Op.lte]: new Date(endDate + 'T23:59:59.999Z') }),
      };
    }

    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { username: { [Op.iLike]: `%${search}%` } },
        { instagramUsername: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { rows, count } = await this.influencerModel.findAndCountAll({
      where: whereClause,
      attributes: [
        'id',
        'name',
        'username',
        'instagramUsername',
        'instagramConnectedAt',
        'profileImage',
      ],
      order: [['instagramConnectedAt', 'DESC']],
      limit,
      offset,
    });

    if (rows.length === 0) {
      return { data: [], total: count, page, limit, totalPages: 0 };
    }

    const influencerIds = rows.map((i) => i.id);

    // Get the latest score per influencer (using raw query for DISTINCT ON)
    const latestScores: any[] = await this.influencerProfileScoreModel.sequelize!.query(
      `
      SELECT DISTINCT ON (influencer_id)
        influencer_id,
        total_score,
        grade,
        profile_summary,
        calculated_at
      FROM influencer_profile_scores
      WHERE influencer_id IN (:influencerIds)
      ORDER BY influencer_id, calculated_at DESC
      `,
      {
        replacements: { influencerIds },
        type: require('sequelize').QueryTypes.SELECT,
        raw: true,
      },
    );

    const scoreMap = new Map<number, any>();
    for (const score of latestScores) {
      scoreMap.set(score.influencer_id, score);
    }

    return {
      data: rows.map((influencer) => {
        const latestScore = scoreMap.get(influencer.id) ?? null;
        return {
          id: influencer.id,
          name: influencer.name,
          username: influencer.username,
          instagramUsername: influencer.instagramUsername,
          instagramConnectedAt: influencer.instagramConnectedAt,
          profileImage: influencer.profileImage,
          profileScore: latestScore
            ? {
                totalScore: latestScore.total_score,
                grade: latestScore.grade,
                profileSummary: latestScore.profile_summary,
                calculatedAt: latestScore.calculated_at,
              }
            : null,
        };
      }),
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    };
  }

  async getCreatorScore(influencerId: number) {
    const [influencer, profileScore] = await Promise.all([
      this.influencerModel.findByPk(influencerId, {
        attributes: [
          'id',
          'name',
          'username',
          'profileImage',
          'instagramUserId',
          'instagramUsername',
          'instagramAccountType',
          'instagramFollowersCount',
          'instagramFollowsCount',
          'instagramMediaCount',
          'instagramProfilePictureUrl',
          'instagramBio',
          'instagramIsVerified',
          'instagramConnectedAt',
          'instagramTokenExpiresAt',
          'instagramUrl',
        ],
      }),
      this.influencerProfileScoringService.getCompleteProfileScore(influencerId),
    ]);

    return {
      influencer,
      profileScore,
    };
  }

  async getDashboardStats(dto: GetCreatorScoresDashboardDto) {
    const { startDate, endDate } = dto;

    const now = new Date();
    const periodEnd = endDate ? new Date(endDate + 'T23:59:59.999Z') : now;
    const periodStart = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Previous period: same length shifted back
    const periodLengthMs = periodEnd.getTime() - periodStart.getTime();
    const prevPeriodEnd = new Date(periodStart.getTime() - 1);
    const prevPeriodStart = new Date(periodStart.getTime() - periodLengthMs - 1);

    const [current, previous] = await Promise.all([
      this.aggregateStats(periodStart, periodEnd),
      this.aggregateStats(prevPeriodStart, prevPeriodEnd),
    ]);

    const pctChange = (curr: number | null, prev: number | null): number | null => {
      if (prev === null || prev === 0) return null;
      if (curr === null) return null;
      return parseFloat((((curr - prev) / prev) * 100).toFixed(1));
    };

    const round = (v: string | number | null) =>
      v !== null && v !== undefined ? parseFloat(Number(v).toFixed(2)) : null;

    return {
      period: { startDate: periodStart, endDate: periodEnd },
      stats: {
        totalActiveCreators: {
          value: Number(current.totalActive),
          change: pctChange(Number(current.totalActive), Number(previous.totalActive)),
        },
        highestCreatorScore: {
          value: round(current.highest),
          change: pctChange(round(current.highest), round(previous.highest)),
        },
        lowestCreatorScore: {
          value: round(current.lowest),
          change: pctChange(round(current.lowest), round(previous.lowest)),
        },
        avgCreatorScore: {
          value: round(current.avgTotal),
          change: pctChange(round(current.avgTotal), round(previous.avgTotal)),
        },
        avgEngagementScore: {
          value: round(current.avgEngagement),
          change: pctChange(round(current.avgEngagement), round(previous.avgEngagement)),
        },
        avgMonetisationScore: {
          value: round(current.avgMonetisation),
          change: pctChange(round(current.avgMonetisation), round(previous.avgMonetisation)),
        },
        avgContentRelevanceScore: {
          value: round(current.avgContentRelevance),
          change: pctChange(round(current.avgContentRelevance), round(previous.avgContentRelevance)),
        },
        avgAudienceQualityScore: {
          value: round(current.avgAudienceQuality),
          change: pctChange(round(current.avgAudienceQuality), round(previous.avgAudienceQuality)),
        },
        avgContentQualityScore: {
          value: round(current.avgContentQuality),
          change: pctChange(round(current.avgContentQuality), round(previous.avgContentQuality)),
        },
        avgGrowthMomentumScore: {
          value: round(current.avgGrowthMomentum),
          change: pctChange(round(current.avgGrowthMomentum), round(previous.avgGrowthMomentum)),
        },
      },
    };
  }

  private async aggregateStats(from: Date, to: Date) {
    // First, get all influencers who have at least one score in the period
    const influencersInPeriod = await this.influencerProfileScoreModel.findAll({
      attributes: [[fn('DISTINCT', col('influencer_id')), 'influencerId']],
      where: {
        calculatedAt: { [Op.between]: [from, to] },
      },
      raw: true,
    });

    if (!influencersInPeriod || influencersInPeriod.length === 0) {
      return {
        totalActive: 0,
        highest: null,
        lowest: null,
        avgTotal: null,
        avgEngagement: null,
        avgMonetisation: null,
        avgContentRelevance: null,
        avgAudienceQuality: null,
        avgContentQuality: null,
        avgGrowthMomentum: null,
      };
    }

    const influencerIds = influencersInPeriod.map((row: any) => row.influencerId);

    // Get the latest score per influencer (using DISTINCT ON with raw query)
    const latestScores: any[] = await this.influencerProfileScoreModel.sequelize!.query(
      `
      SELECT DISTINCT ON (influencer_id)
        influencer_id,
        total_score,
        engagement_strength_score,
        monetisation_score,
        content_relevance_score,
        audience_quality_score,
        content_quality_score,
        growth_momentum_score,
        calculated_at
      FROM influencer_profile_scores
      WHERE influencer_id IN (:influencerIds)
      ORDER BY influencer_id, calculated_at DESC
      `,
      {
        replacements: { influencerIds },
        type: require('sequelize').QueryTypes.SELECT,
        raw: true,
      },
    );

    // Manually calculate aggregates from the latest scores
    // Note: raw: true returns DB column names (snake_case due to underscored: true)
    const totalActive = latestScores.length;
    const scores = latestScores.map((s: any) => Number(s.total_score));
    const highest = scores.length > 0 ? Math.max(...scores) : null;
    const lowest = scores.length > 0 ? Math.min(...scores) : null;

    const avg = (field: string) => {
      const values = latestScores.map((s: any) => Number(s[field]) || 0);
      return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
    };

    return {
      totalActive,
      highest,
      lowest,
      avgTotal: avg('total_score'),
      avgEngagement: avg('engagement_strength_score'),
      avgMonetisation: avg('monetisation_score'),
      avgContentRelevance: avg('content_relevance_score'),
      avgAudienceQuality: avg('audience_quality_score'),
      avgContentQuality: avg('content_quality_score'),
      avgGrowthMomentum: avg('growth_momentum_score'),
    };
  }
}
