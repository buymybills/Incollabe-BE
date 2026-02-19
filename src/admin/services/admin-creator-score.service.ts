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

    // Get the latest score per influencer
    const latestScores = await this.influencerProfileScoreModel.findAll({
      where: {
        influencerId: { [Op.in]: influencerIds },
        id: {
          [Op.in]: literal(`(
            SELECT DISTINCT ON (influencer_id) id
            FROM influencer_profile_scores
            WHERE influencer_id IN (${influencerIds.join(',')})
            ORDER BY influencer_id, calculated_at DESC
          )`),
        },
      },
      attributes: ['influencerId', 'totalScore', 'grade', 'profileSummary', 'calculatedAt'],
    });

    const scoreMap = new Map<number, InfluencerProfileScore>();
    for (const score of latestScores) {
      scoreMap.set(score.influencerId, score);
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
                totalScore: latestScore.totalScore,
                grade: latestScore.grade,
                profileSummary: latestScore.profileSummary,
                calculatedAt: latestScore.calculatedAt,
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
    const result = (await this.influencerProfileScoreModel.findOne({
      attributes: [
        [fn('COUNT', fn('DISTINCT', col('influencer_id'))), 'totalActive'],
        [fn('MAX', col('total_score')), 'highest'],
        [fn('MIN', col('total_score')), 'lowest'],
        [fn('AVG', col('total_score')), 'avgTotal'],
        [fn('AVG', col('engagement_strength_score')), 'avgEngagement'],
        [fn('AVG', col('monetisation_score')), 'avgMonetisation'],
        [fn('AVG', col('content_relevance_score')), 'avgContentRelevance'],
        [fn('AVG', col('audience_quality_score')), 'avgAudienceQuality'],
        [fn('AVG', col('content_quality_score')), 'avgContentQuality'],
        [fn('AVG', col('growth_momentum_score')), 'avgGrowthMomentum'],
      ],
      where: {
        calculatedAt: { [Op.between]: [from, to] },
      },
      raw: true,
    })) as any;

    return result ?? {};
  }
}
