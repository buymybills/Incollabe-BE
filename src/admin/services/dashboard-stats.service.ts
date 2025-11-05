import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Influencer } from '../../auth/model/influencer.model';
import { Brand } from '../../brand/model/brand.model';
import { Campaign } from '../../campaign/models/campaign.model';
import { CampaignApplication } from '../../campaign/models/campaign-application.model';
import { CampaignDeliverable } from '../../campaign/models/campaign-deliverable.model';
import { CampaignCity } from '../../campaign/models/campaign-city.model';
import { City } from '../../shared/models/city.model';
import { Niche } from '../../auth/model/niche.model';
import { ProfileReview } from '../models/profile-review.model';
import { ProfileType, ReviewStatus } from '../models/profile-review.model';
import { Post } from '../../post/models/post.model';
import {
  MainDashboardResponseDto,
  InfluencerDashboardResponseDto,
  BrandDashboardResponseDto,
  CampaignDashboardResponseDto,
  PostDashboardResponseDto,
  DashboardTimeFrame,
} from '../dto/admin-dashboard.dto';

@Injectable()
export class DashboardStatsService {
  constructor(
    @InjectModel(Influencer)
    private readonly influencerModel: typeof Influencer,
    @InjectModel(Brand)
    private readonly brandModel: typeof Brand,
    @InjectModel(Campaign)
    private readonly campaignModel: typeof Campaign,
    @InjectModel(CampaignApplication)
    private readonly campaignApplicationModel: typeof CampaignApplication,
    @InjectModel(CampaignDeliverable)
    private readonly campaignDeliverableModel: typeof CampaignDeliverable,
    @InjectModel(CampaignCity)
    private readonly campaignCityModel: typeof CampaignCity,
    @InjectModel(City)
    private readonly cityModel: typeof City,
    @InjectModel(Niche)
    private readonly nicheModel: typeof Niche,
    @InjectModel(ProfileReview)
    private readonly profileReviewModel: typeof ProfileReview,
    @InjectModel(Post)
    private readonly postModel: typeof Post,
  ) {}

  async getMainDashboardStats(): Promise<MainDashboardResponseDto> {
    const now = new Date();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Influencer metrics
    const [
      totalInfluencers,
      verifiedInfluencers,
      unverifiedInfluencers,
      lastMonthTotalInfluencers,
      lastMonthVerifiedInfluencers,
      lastMonthUnverifiedInfluencers,
      influencersPending,
    ] = await Promise.all([
      this.influencerModel.count({ where: { isActive: true } }),
      this.influencerModel.count({
        where: { isActive: true, isVerified: true },
      }),
      this.influencerModel.count({
        where: { isActive: true, isVerified: false },
      }),
      this.influencerModel.count({
        where: {
          isActive: true,
          createdAt: { [Op.between]: [lastMonthStart, lastMonthEnd] },
        },
      }),
      this.influencerModel.count({
        where: {
          isActive: true,
          isVerified: true,
          createdAt: { [Op.between]: [lastMonthStart, lastMonthEnd] },
        },
      }),
      this.influencerModel.count({
        where: {
          isActive: true,
          isVerified: false,
          createdAt: { [Op.between]: [lastMonthStart, lastMonthEnd] },
        },
      }),
      this.profileReviewModel.count({
        where: {
          profileType: ProfileType.INFLUENCER,
          status: ReviewStatus.PENDING,
        },
      }),
    ]);

    // Brand metrics
    const [
      totalBrands,
      verifiedBrands,
      unverifiedBrands,
      lastMonthTotalBrands,
      lastMonthVerifiedBrands,
      lastMonthUnverifiedBrands,
      brandsPending,
    ] = await Promise.all([
      this.brandModel.count({ where: { isActive: true } }),
      this.brandModel.count({ where: { isActive: true, isVerified: true } }),
      this.brandModel.count({ where: { isActive: true, isVerified: false } }),
      this.brandModel.count({
        where: {
          isActive: true,
          createdAt: { [Op.between]: [lastMonthStart, lastMonthEnd] },
        },
      }),
      this.brandModel.count({
        where: {
          isActive: true,
          isVerified: true,
          createdAt: { [Op.between]: [lastMonthStart, lastMonthEnd] },
        },
      }),
      this.brandModel.count({
        where: {
          isActive: true,
          isVerified: false,
          createdAt: { [Op.between]: [lastMonthStart, lastMonthEnd] },
        },
      }),
      this.profileReviewModel.count({
        where: {
          profileType: ProfileType.BRAND,
          status: ReviewStatus.PENDING,
        },
      }),
    ]);

    // Campaign metrics
    const [
      totalCampaigns,
      campaignsLive,
      campaignsCompleted,
      lastMonthTotalCampaigns,
      lastMonthCampaignsLive,
      lastMonthCampaignsCompleted,
      totalApplications,
    ] = await Promise.all([
      this.campaignModel.count({ where: { isActive: true } }),
      this.campaignModel.count({ where: { isActive: true, status: 'active' } }),
      this.campaignModel.count({
        where: { isActive: true, status: 'completed' },
      }),
      this.campaignModel.count({
        where: {
          isActive: true,
          createdAt: { [Op.between]: [lastMonthStart, lastMonthEnd] },
        },
      }),
      this.campaignModel.count({
        where: {
          isActive: true,
          status: 'active',
          createdAt: { [Op.between]: [lastMonthStart, lastMonthEnd] },
        },
      }),
      this.campaignModel.count({
        where: {
          isActive: true,
          status: 'completed',
          createdAt: { [Op.between]: [lastMonthStart, lastMonthEnd] },
        },
      }),
      this.campaignApplicationModel.count(),
    ]);

    // Top Influencers (by followers or engagement)
    const topInfluencers = await this.influencerModel.findAll({
      where: { isActive: true, isTopInfluencer: true },
      limit: 32,
      order: [['createdAt', 'DESC']],
      attributes: ['id', 'name', 'username', 'profileImage', 'isVerified'],
    });

    // Top Brands (by campaigns or activity)
    const topBrands = await this.brandModel.findAll({
      where: { isActive: true, isTopBrand: true },
      limit: 10,
      order: [['createdAt', 'DESC']],
      attributes: ['id', 'brandName', 'username', 'profileImage', 'isVerified'],
    });

    // Top Campaigns (by applications)
    const topCampaigns = await this.campaignModel.findAll({
      where: { isActive: true },
      include: [
        {
          model: this.brandModel,
          attributes: ['brandName', 'profileImage'],
        },
        {
          model: CampaignDeliverable,
        },
      ],
      limit: 12,
      order: [['createdAt', 'DESC']],
      attributes: ['id', 'name', 'category', 'deliverableFormat', 'status'],
    });

    // Get application counts for top campaigns
    const topCampaignsWithCounts = await Promise.all(
      topCampaigns.map(async (campaign) => {
        const applicationCount = await this.campaignApplicationModel.count({
          where: { campaignId: campaign.id },
        });
        const campaignData = campaign.toJSON();
        const deliverables = (campaignData as any).deliverables || [];

        // Calculate total budget from deliverables
        const totalBudget = deliverables.reduce(
          (sum: number, deliverable: any) =>
            sum + (deliverable.budget || 0) * (deliverable.quantity || 1),
          0,
        );

        return {
          id: campaign.id,
          name: campaign.name,
          brandName: (campaign as any).brand?.brandName || '',
          brandLogo: (campaign as any).brand?.profileImage || '',
          category: campaign.category || '',
          deliverableFormat: campaign.deliverableFormat || '',
          status: campaign.status,
          budget: totalBudget,
          deliverables: deliverables,
          applicationCount,
        };
      }),
    );

    return {
      influencerMetrics: {
        totalInfluencers: {
          count: totalInfluencers,
          percentageChange: this.calculatePercentageChange(
            totalInfluencers,
            lastMonthTotalInfluencers,
          ),
        },
        verifiedInfluencers: {
          count: verifiedInfluencers,
          percentageChange: this.calculatePercentageChange(
            verifiedInfluencers,
            lastMonthVerifiedInfluencers,
          ),
        },
        unverifiedInfluencers: {
          count: unverifiedInfluencers,
          percentageChange: this.calculatePercentageChange(
            unverifiedInfluencers,
            lastMonthUnverifiedInfluencers,
          ),
        },
        influencersPendingVerification: influencersPending,
      },
      brandMetrics: {
        totalBrands: {
          count: totalBrands,
          percentageChange: this.calculatePercentageChange(
            totalBrands,
            lastMonthTotalBrands,
          ),
        },
        verifiedBrands: {
          count: verifiedBrands,
          percentageChange: this.calculatePercentageChange(
            verifiedBrands,
            lastMonthVerifiedBrands,
          ),
        },
        unverifiedBrands: {
          count: unverifiedBrands,
          percentageChange: this.calculatePercentageChange(
            unverifiedBrands,
            lastMonthUnverifiedBrands,
          ),
        },
        brandsPendingVerification: brandsPending,
      },
      campaignMetrics: {
        totalCampaigns: {
          count: totalCampaigns,
          percentageChange: this.calculatePercentageChange(
            totalCampaigns,
            lastMonthTotalCampaigns,
          ),
        },
        campaignsLive: {
          count: campaignsLive,
          percentageChange: this.calculatePercentageChange(
            campaignsLive,
            lastMonthCampaignsLive,
          ),
        },
        campaignsCompleted: {
          count: campaignsCompleted,
          percentageChange: this.calculatePercentageChange(
            campaignsCompleted,
            lastMonthCampaignsCompleted,
          ),
        },
        totalCampaignApplications: totalApplications,
      },
      topInfluencers: topInfluencers.map((influencer, index) => ({
        rank: index + 1,
        id: influencer.id,
        name: influencer.name,
        username: influencer.username,
        profileImage: influencer.profileImage || '',
        isVerified: influencer.isVerified,
        score: 0, // Can be calculated based on engagement or followers
      })),
      topBrands: topBrands.map((brand, index) => ({
        rank: index + 1,
        id: brand.id,
        brandName: brand.brandName,
        username: brand.username,
        profileImage: brand.profileImage || '',
        isVerified: brand.isVerified,
        score: 0, // Can be calculated based on campaigns
      })),
      topCampaigns: topCampaignsWithCounts,
    };
  }

  async getInfluencerDashboardStats(
    timeFrame: DashboardTimeFrame,
    startDate?: string,
    endDate?: string,
  ): Promise<InfluencerDashboardResponseDto> {
    const now = new Date();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    let chartStartDate: Date;
    let chartEndDate: Date = now;

    // Handle custom date range
    if (timeFrame === DashboardTimeFrame.CUSTOM && startDate && endDate) {
      chartStartDate = new Date(startDate);
      chartEndDate = new Date(endDate);
    } else {
      // Handle predefined time frames
      switch (timeFrame) {
        case DashboardTimeFrame.LAST_24_HOURS:
          chartStartDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case DashboardTimeFrame.LAST_3_DAYS:
          chartStartDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
          break;
        case DashboardTimeFrame.LAST_7_DAYS:
          chartStartDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case DashboardTimeFrame.LAST_15_DAYS:
          chartStartDate = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
          break;
        case DashboardTimeFrame.LAST_30_DAYS:
          chartStartDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          chartStartDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }
    }

    // Get influencer metrics (reuse from main dashboard)
    const [
      totalInfluencers,
      verifiedInfluencers,
      unverifiedInfluencers,
      lastMonthTotalInfluencers,
      lastMonthVerifiedInfluencers,
      lastMonthUnverifiedInfluencers,
      influencersPending,
    ] = await Promise.all([
      this.influencerModel.count({ where: { isActive: true } }),
      this.influencerModel.count({
        where: { isActive: true, isVerified: true },
      }),
      this.influencerModel.count({
        where: { isActive: true, isVerified: false },
      }),
      this.influencerModel.count({
        where: {
          isActive: true,
          createdAt: { [Op.between]: [lastMonthStart, lastMonthEnd] },
        },
      }),
      this.influencerModel.count({
        where: {
          isActive: true,
          isVerified: true,
          createdAt: { [Op.between]: [lastMonthStart, lastMonthEnd] },
        },
      }),
      this.influencerModel.count({
        where: {
          isActive: true,
          isVerified: false,
          createdAt: { [Op.between]: [lastMonthStart, lastMonthEnd] },
        },
      }),
      this.profileReviewModel.count({
        where: {
          profileType: ProfileType.INFLUENCER,
          status: ReviewStatus.PENDING,
        },
      }),
    ]);

    // City Presence
    const distinctCitiesNow = await this.influencerModel.findAll({
      attributes: [
        [
          this.influencerModel.sequelize!.fn(
            'COUNT',
            this.influencerModel.sequelize!.fn(
              'DISTINCT',
              this.influencerModel.sequelize!.col('cityId'),
            ),
          ),
          'count',
        ],
      ],
      where: { cityId: { [Op.ne]: null }, isActive: true },
      raw: true,
    });

    const distinctCitiesLastMonth = await this.influencerModel.findAll({
      attributes: [
        [
          this.influencerModel.sequelize!.fn(
            'COUNT',
            this.influencerModel.sequelize!.fn(
              'DISTINCT',
              this.influencerModel.sequelize!.col('cityId'),
            ),
          ),
          'count',
        ],
      ],
      where: {
        cityId: { [Op.ne]: null },
        isActive: true,
        createdAt: { [Op.between]: [lastMonthStart, lastMonthEnd] },
      },
      raw: true,
    });

    const totalCitiesNow = parseInt((distinctCitiesNow[0] as any).count) || 0;
    const totalCitiesLastMonth =
      parseInt((distinctCitiesLastMonth[0] as any).count) || 0;
    const changeVsLastMonth = totalCitiesNow - totalCitiesLastMonth;
    const percentageChange =
      totalCitiesLastMonth > 0
        ? (changeVsLastMonth / totalCitiesLastMonth) * 100
        : 0;

    // City Distribution
    const cityDistribution = await this.influencerModel.findAll({
      attributes: [
        'cityId',
        [
          this.influencerModel.sequelize!.fn(
            'COUNT',
            this.influencerModel.sequelize!.col('Influencer.id'),
          ),
          'count',
        ],
      ],
      include: [
        {
          model: this.cityModel,
          attributes: ['id', 'name'],
        },
      ],
      where: { cityId: { [Op.ne]: null }, isActive: true },
      group: ['cityId', 'city.id'],
      order: [[this.influencerModel.sequelize!.literal('count'), 'DESC']],
      raw: true,
    });

    const topCities = cityDistribution.slice(0, 3);
    const otherCitiesCount = cityDistribution
      .slice(3)
      .reduce((sum, city: any) => sum + parseInt(city.count), 0);

    const cityDist = [
      ...topCities.map((city: any) => ({
        cityName: city['city.name'] || 'Unknown',
        influencerCount: parseInt(city.count),
        percentage: parseFloat(
          ((parseInt(city.count) / totalInfluencers) * 100).toFixed(1),
        ),
      })),
      {
        cityName: 'Others',
        influencerCount: otherCitiesCount,
        percentage: parseFloat(
          ((otherCitiesCount / totalInfluencers) * 100).toFixed(1),
        ),
      },
    ];

    // Daily Active Influencers Time Series
    const timeSeriesData = await this.generateTimeSeriesData(
      chartStartDate,
      chartEndDate,
    );

    // Niche Distribution
    const nicheDistribution = await this.getNicheDistribution(totalInfluencers);

    return {
      influencerMetrics: {
        totalInfluencers: {
          count: totalInfluencers,
          percentageChange: this.calculatePercentageChange(
            totalInfluencers,
            lastMonthTotalInfluencers,
          ),
        },
        verifiedInfluencers: {
          count: verifiedInfluencers,
          percentageChange: this.calculatePercentageChange(
            verifiedInfluencers,
            lastMonthVerifiedInfluencers,
          ),
        },
        unverifiedInfluencers: {
          count: unverifiedInfluencers,
          percentageChange: this.calculatePercentageChange(
            unverifiedInfluencers,
            lastMonthUnverifiedInfluencers,
          ),
        },
        influencersPendingVerification: influencersPending,
      },
      cityPresence: {
        totalCities: totalCitiesNow,
        changeVsLastMonth,
        percentageChange: parseFloat(percentageChange.toFixed(1)),
      },
      cityDistribution: cityDist,
      dailyActiveInfluencers: {
        currentVerifiedCount: verifiedInfluencers,
        currentUnverifiedCount: unverifiedInfluencers,
        timeSeriesData,
      },
      nicheDistribution,
    };
  }

  private async generateTimeSeriesData(startDate: Date, endDate: Date) {
    const timeSeriesData: Array<{
      date: string;
      verifiedCount: number;
      unverifiedCount: number;
      totalCount: number;
    }> = [];
    const daysDiff = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000),
    );

    for (let i = 0; i <= daysDiff; i++) {
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const endOfDay = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        23,
        59,
        59,
      );

      const [verifiedCount, unverifiedCount] = await Promise.all([
        this.influencerModel.count({
          where: {
            isActive: true,
            isVerified: true,
            createdAt: { [Op.lte]: endOfDay },
          },
        }),
        this.influencerModel.count({
          where: {
            isActive: true,
            isVerified: false,
            createdAt: { [Op.lte]: endOfDay },
          },
        }),
      ]);

      timeSeriesData.push({
        date: date.toISOString().split('T')[0],
        verifiedCount,
        unverifiedCount,
        totalCount: verifiedCount + unverifiedCount,
      });
    }

    return timeSeriesData;
  }

  private async getNicheDistribution(totalInfluencers: number) {
    // Get all niches with influencer counts
    const nicheData = await this.nicheModel.findAll({
      attributes: [
        'id',
        'name',
        [
          this.nicheModel.sequelize!.literal(
            '(SELECT COUNT(DISTINCT "influencerId") FROM "influencer_niches" WHERE "influencer_niches"."nicheId" = "Niche"."id")',
          ),
          'influencerCount',
        ],
      ],
      raw: true,
    });

    // Group niches into categories
    const nicheGroups: { [key: string]: number } = {
      'Fashion, Lifestyle, Beauty': 0,
      'Food, Travel': 0,
      'Electronics, Music': 0,
      'Sports, Podcast, Motivational Speakers': 0,
      'Others + Custom': 0,
    };

    nicheData.forEach((niche: any) => {
      const nicheName = niche.name.toLowerCase();
      const count = parseInt(niche.influencerCount) || 0;

      if (
        nicheName.includes('fashion') ||
        nicheName.includes('lifestyle') ||
        nicheName.includes('beauty')
      ) {
        nicheGroups['Fashion, Lifestyle, Beauty'] += count;
      } else if (nicheName.includes('food') || nicheName.includes('travel')) {
        nicheGroups['Food, Travel'] += count;
      } else if (
        nicheName.includes('electronics') ||
        nicheName.includes('music') ||
        nicheName.includes('technology')
      ) {
        nicheGroups['Electronics, Music'] += count;
      } else if (
        nicheName.includes('sports') ||
        nicheName.includes('podcast') ||
        nicheName.includes('motivat')
      ) {
        nicheGroups['Sports, Podcast, Motivational Speakers'] += count;
      } else {
        nicheGroups['Others + Custom'] += count;
      }
    });

    return Object.entries(nicheGroups).map(([nicheName, count]) => ({
      nicheName,
      influencerCount: count,
      percentage: parseFloat(((count / totalInfluencers) * 100).toFixed(1)),
    }));
  }

  private calculatePercentageChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return parseFloat((((current - previous) / previous) * 100).toFixed(1));
  }

  /**
   * Get brand dashboard statistics
   */
  async getBrandDashboardStats(
    timeFrame: DashboardTimeFrame,
    startDateStr?: string,
    endDateStr?: string,
  ): Promise<BrandDashboardResponseDto> {
    // Calculate date range based on timeFrame
    let startDate: Date;
    let endDate: Date = new Date();

    // Handle custom date range
    if (timeFrame === DashboardTimeFrame.CUSTOM && startDateStr && endDateStr) {
      startDate = new Date(startDateStr);
      endDate = new Date(endDateStr);
    } else {
      // Handle predefined time frames
      switch (timeFrame) {
        case DashboardTimeFrame.LAST_24_HOURS:
          startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
          break;
        case DashboardTimeFrame.LAST_3_DAYS:
          startDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
          break;
        case DashboardTimeFrame.LAST_7_DAYS:
          startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          break;
        case DashboardTimeFrame.LAST_15_DAYS:
          startDate = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
          break;
        case DashboardTimeFrame.LAST_30_DAYS:
          startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      }
    }

    const currentDate = new Date();
    const lastMonthStart = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() - 1,
      1,
    );
    const lastMonthEnd = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      0,
      23,
      59,
      59,
    );

    // Get brand metrics
    const [
      totalBrands,
      verifiedBrands,
      unverifiedBrands,
      lastMonthTotalBrands,
      lastMonthVerifiedBrands,
      lastMonthUnverifiedBrands,
      brandsPendingVerification,
    ] = await Promise.all([
      this.brandModel.count({ where: { isActive: true } }),
      this.brandModel.count({ where: { isActive: true, isVerified: true } }),
      this.brandModel.count({ where: { isActive: true, isVerified: false } }),
      this.brandModel.count({
        where: {
          isActive: true,
          createdAt: { [Op.between]: [lastMonthStart, lastMonthEnd] },
        },
      }),
      this.brandModel.count({
        where: {
          isActive: true,
          isVerified: true,
          createdAt: { [Op.between]: [lastMonthStart, lastMonthEnd] },
        },
      }),
      this.brandModel.count({
        where: {
          isActive: true,
          isVerified: false,
          createdAt: { [Op.between]: [lastMonthStart, lastMonthEnd] },
        },
      }),
      this.profileReviewModel.count({
        where: {
          profileType: ProfileType.BRAND,
          status: ReviewStatus.PENDING,
        },
      }),
    ]);

    const brandMetrics = {
      totalBrands: {
        count: totalBrands,
        percentageChange: this.calculatePercentageChange(
          totalBrands,
          lastMonthTotalBrands,
        ),
      },
      verifiedBrands: {
        count: verifiedBrands,
        percentageChange: this.calculatePercentageChange(
          verifiedBrands,
          lastMonthVerifiedBrands,
        ),
      },
      unverifiedBrands: {
        count: unverifiedBrands,
        percentageChange: this.calculatePercentageChange(
          unverifiedBrands,
          lastMonthUnverifiedBrands,
        ),
      },
      brandsPendingVerification,
    };

    // Get city presence
    const cityPresence = await this.getBrandCityPresence();

    // Get city distribution (top 3 cities + others)
    const cityDistribution = await this.getBrandCityDistribution();

    // Get daily active brands
    const dailyActiveBrands = await this.getDailyActiveBrands(
      startDate,
      endDate,
    );

    // Get niche distribution
    const nicheDistribution = await this.getBrandNicheDistribution();

    return {
      brandMetrics,
      cityPresence,
      cityDistribution,
      dailyActiveBrands,
      nicheDistribution,
    };
  }

  private async getBrandCityPresence() {
    const currentDate = new Date();
    const lastMonthDate = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() - 1,
      currentDate.getDate(),
    );

    // Get unique cities with brands currently
    const currentBrands = await this.brandModel.findAll({
      attributes: ['headquarterCityId'],
      where: {
        isActive: true,
        headquarterCityId: { [Op.ne]: null as any },
      },
      group: ['headquarterCityId'],
    });

    // Get unique cities with brands last month
    const lastMonthBrands = await this.brandModel.findAll({
      attributes: ['headquarterCityId'],
      where: {
        isActive: true,
        headquarterCityId: { [Op.ne]: null as any },
        createdAt: { [Op.lte]: lastMonthDate },
      },
      group: ['headquarterCityId'],
    });

    const currentCities = currentBrands.length;
    const lastMonthCities = lastMonthBrands.length;
    const change = currentCities - lastMonthCities;
    const percentageChange = this.calculatePercentageChange(
      currentCities,
      lastMonthCities,
    );

    return {
      totalCities: currentCities,
      changeVsLastMonth: change,
      percentageChange,
    };
  }

  private async getBrandCityDistribution() {
    // Get total active brands count for percentage calculation
    const totalActiveBrands = await this.brandModel.count({
      where: { isActive: true },
    });

    // Get all brands with city information
    const brands = await this.brandModel.findAll({
      attributes: ['id', 'headquarterCityId'],
      include: [
        {
          model: City,
          as: 'headquarterCity',
          attributes: ['id', 'name'],
        },
      ],
      where: {
        isActive: true,
      },
    });

    const cityCounts: { [key: string]: number } = {};

    brands.forEach((brand) => {
      const cityName = brand.headquarterCity?.name || 'Not Specified';
      cityCounts[cityName] = (cityCounts[cityName] || 0) + 1;
    });

    // Sort by count and get top 3
    const sortedCities = Object.entries(cityCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);

    const top3Count = sortedCities.reduce((sum, [, count]) => sum + count, 0);
    const othersCount = totalActiveBrands - top3Count;

    const distribution = sortedCities.map(([cityName, count]) => ({
      cityName,
      brandCount: count,
      percentage: parseFloat(((count / totalActiveBrands) * 100).toFixed(1)),
    }));

    if (othersCount > 0) {
      distribution.push({
        cityName: 'Others',
        brandCount: othersCount,
        percentage: parseFloat(((othersCount / totalActiveBrands) * 100).toFixed(1)),
      });
    }

    return distribution;
  }

  private async getDailyActiveBrands(startDate: Date, endDate: Date) {
    const timeSeriesData: Array<{
      date: string;
      verifiedCount: number;
      unverifiedCount: number;
      totalCount: number;
    }> = [];

    // Generate daily data points
    for (
      let date = new Date(startDate);
      date <= endDate;
      date.setDate(date.getDate() + 1)
    ) {
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);

      // Count verified brands that existed and were active on this day
      // (created before or on this day)
      const verifiedCount = await this.brandModel.count({
        where: {
          isVerified: true,
          isActive: true,
          createdAt: {
            [Op.lte]: dayEnd,
          },
        },
      });

      // Count unverified brands that existed and were active on this day
      // (created before or on this day)
      const unverifiedCount = await this.brandModel.count({
        where: {
          isVerified: false,
          isActive: true,
          createdAt: {
            [Op.lte]: dayEnd,
          },
        },
      });

      timeSeriesData.push({
        date: dayStart.toISOString().split('T')[0],
        verifiedCount,
        unverifiedCount,
        totalCount: verifiedCount + unverifiedCount,
      });
    }

    // Get current totals (as of endDate)
    const currentVerifiedCount = await this.brandModel.count({
      where: { 
        isVerified: true, 
        isActive: true,
        createdAt: {
          [Op.lte]: endDate,
        },
      },
    });

    const currentUnverifiedCount = await this.brandModel.count({
      where: { 
        isVerified: false, 
        isActive: true,
        createdAt: {
          [Op.lte]: endDate,
        },
      },
    });

    return {
      currentVerifiedCount,
      currentUnverifiedCount,
      timeSeriesData,
    };
  }

  private async getBrandNicheDistribution() {
    // Get all brands with their niches
    const brands = await this.brandModel.findAll({
      include: [
        {
          model: Niche,
          as: 'niches',
          attributes: ['id', 'name'],
          through: { attributes: [] },
        },
      ],
    });

    const totalBrands = brands.length;
    const nicheCounts: { [key: string]: number } = {};

    brands.forEach((brand) => {
      if (brand.niches && brand.niches.length > 0) {
        brand.niches.forEach((niche) => {
          const nicheName = niche.name;
          nicheCounts[nicheName] = (nicheCounts[nicheName] || 0) + 1;
        });
      }
    });

    // Group niches into categories
    const nicheGroups: { [key: string]: number } = {
      'Fashion, Lifestyle, Beauty': 0,
      'Food, Travel': 0,
      'Electronics, Music': 0,
      'Sports, Podcast, Motivational Speakers': 0,
      'Others + Custom': 0,
    };

    Object.entries(nicheCounts).forEach(([nicheName, count]) => {
      const nicheLower = nicheName.toLowerCase();
      if (
        nicheLower.includes('fashion') ||
        nicheLower.includes('lifestyle') ||
        nicheLower.includes('beauty')
      ) {
        nicheGroups['Fashion, Lifestyle, Beauty'] += count;
      } else if (nicheLower.includes('food') || nicheLower.includes('travel')) {
        nicheGroups['Food, Travel'] += count;
      } else if (
        nicheLower.includes('electronics') ||
        nicheLower.includes('music')
      ) {
        nicheGroups['Electronics, Music'] += count;
      } else if (
        nicheLower.includes('sports') ||
        nicheLower.includes('podcast') ||
        nicheLower.includes('motivat')
      ) {
        nicheGroups['Sports, Podcast, Motivational Speakers'] += count;
      } else {
        nicheGroups['Others + Custom'] += count;
      }
    });

    return Object.entries(nicheGroups).map(([nicheName, count]) => ({
      nicheName,
      brandCount: count,
      percentage: parseFloat(((count / totalBrands) * 100).toFixed(1)),
    }));
  }

  /**
   * Get available date range from the system
   * Returns the earliest and latest dates where data exists
   */
  async getAvailableDateRange(): Promise<{
    minDate: string;
    maxDate: string;
    influencerMinDate: string;
    influencerMaxDate: string;
    brandMinDate: string;
    brandMaxDate: string;
    campaignMinDate: string;
    campaignMaxDate: string;
    postMinDate: string;
    postMaxDate: string;
  }> {
    // Get min/max dates from influencers
    const influencerDates = await this.influencerModel.findAll({
      attributes: [
        [
          this.influencerModel.sequelize!.fn(
            'MIN',
            this.influencerModel.sequelize!.col('createdAt'),
          ),
          'minDate',
        ],
        [
          this.influencerModel.sequelize!.fn(
            'MAX',
            this.influencerModel.sequelize!.col('createdAt'),
          ),
          'maxDate',
        ],
      ],
      raw: true,
    });

    // Get min/max dates from brands
    const brandDates = await this.brandModel.findAll({
      attributes: [
        [
          this.brandModel.sequelize!.fn(
            'MIN',
            this.brandModel.sequelize!.col('createdAt'),
          ),
          'minDate',
        ],
        [
          this.brandModel.sequelize!.fn(
            'MAX',
            this.brandModel.sequelize!.col('createdAt'),
          ),
          'maxDate',
        ],
      ],
      raw: true,
    });

    // Get min/max dates from campaigns
    const campaignDates = await this.campaignModel.findAll({
      attributes: [
        [
          this.campaignModel.sequelize!.fn(
            'MIN',
            this.campaignModel.sequelize!.col('createdAt'),
          ),
          'minDate',
        ],
        [
          this.campaignModel.sequelize!.fn(
            'MAX',
            this.campaignModel.sequelize!.col('createdAt'),
          ),
          'maxDate',
        ],
      ],
      where: {
        isActive: true,
      },
      raw: true,
    });

    // Get min/max dates from posts
    const postDates = await this.postModel.findAll({
      attributes: [
        [
          this.postModel.sequelize!.fn(
            'MIN',
            this.postModel.sequelize!.col('createdAt'),
          ),
          'minDate',
        ],
        [
          this.postModel.sequelize!.fn(
            'MAX',
            this.postModel.sequelize!.col('createdAt'),
          ),
          'maxDate',
        ],
      ],
      where: {
        isActive: true,
      },
      raw: true,
    });

    const influencerMinDate = influencerDates[0]?.['minDate'] as Date;
    const influencerMaxDate = influencerDates[0]?.['maxDate'] as Date;
    const brandMinDate = brandDates[0]?.['minDate'] as Date;
    const brandMaxDate = brandDates[0]?.['maxDate'] as Date;
    const campaignMinDate = campaignDates[0]?.['minDate'] as Date;
    const campaignMaxDate = campaignDates[0]?.['maxDate'] as Date;
    const postMinDate = postDates[0]?.['minDate'] as Date;
    const postMaxDate = postDates[0]?.['maxDate'] as Date;

    // Get the overall min and max dates across all entities
    const minDate = new Date(
      Math.min(
        influencerMinDate?.getTime() || Date.now(),
        brandMinDate?.getTime() || Date.now(),
        campaignMinDate?.getTime() || Date.now(),
        postMinDate?.getTime() || Date.now(),
      ),
    );
    const maxDate = new Date(
      Math.max(
        influencerMaxDate?.getTime() || Date.now(),
        brandMaxDate?.getTime() || Date.now(),
        campaignMaxDate?.getTime() || Date.now(),
        postMaxDate?.getTime() || Date.now(),
      ),
    );

    return {
      minDate: minDate.toISOString().split('T')[0],
      maxDate: maxDate.toISOString().split('T')[0],
      influencerMinDate: influencerMinDate
        ? influencerMinDate.toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
      influencerMaxDate: influencerMaxDate
        ? influencerMaxDate.toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
      brandMinDate: brandMinDate
        ? brandMinDate.toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
      brandMaxDate: brandMaxDate
        ? brandMaxDate.toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
      campaignMinDate: campaignMinDate
        ? campaignMinDate.toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
      campaignMaxDate: campaignMaxDate
        ? campaignMaxDate.toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
      postMinDate: postMinDate
        ? postMinDate.toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
      postMaxDate: postMaxDate
        ? postMaxDate.toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
    };
  }

  /**
   * Get campaign dashboard statistics
   * Supports two separate date ranges:
   * 1. Chart time frame (24h, 3d, 7d, 15d, 30d) for time series
   * 2. Metrics date range (monthly: Sep 2025 - Oct 2025) for aggregate data
   */
  async getCampaignDashboardStats(
    chartTimeFrame: DashboardTimeFrame,
    chartStartDateStr?: string,
    chartEndDateStr?: string,
    metricsStartDateStr?: string,
    metricsEndDateStr?: string,
  ): Promise<CampaignDashboardResponseDto> {
    // Calculate chart date range based on timeFrame
    let chartStartDate: Date;
    let chartEndDate: Date = new Date();

    // Handle custom date range for chart
    if (
      chartTimeFrame === DashboardTimeFrame.CUSTOM &&
      chartStartDateStr &&
      chartEndDateStr
    ) {
      chartStartDate = new Date(chartStartDateStr);
      chartEndDate = new Date(chartEndDateStr);
    } else {
      // Handle predefined time frames for chart
      switch (chartTimeFrame) {
        case DashboardTimeFrame.LAST_24_HOURS:
          chartStartDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
          break;
        case DashboardTimeFrame.LAST_3_DAYS:
          chartStartDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
          break;
        case DashboardTimeFrame.LAST_7_DAYS:
          chartStartDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          break;
        case DashboardTimeFrame.LAST_15_DAYS:
          chartStartDate = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
          break;
        case DashboardTimeFrame.LAST_30_DAYS:
          chartStartDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          chartStartDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      }
    }

    // Calculate metrics date range (for aggregate data like cards, city presence, categories)
    // If not provided, use current month
    let metricsStartDate: Date;
    let metricsEndDate: Date;

    if (metricsStartDateStr && metricsEndDateStr) {
      metricsStartDate = new Date(metricsStartDateStr);
      metricsEndDate = new Date(metricsEndDateStr);
    } else {
      // Default to current month
      const now = new Date();
      metricsStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
      metricsEndDate = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
      );
    }

    // Calculate previous period for comparison (same duration as metrics range)
    const metricsDuration =
      metricsEndDate.getTime() - metricsStartDate.getTime();
    const previousPeriodEnd = new Date(
      metricsStartDate.getTime() - 24 * 60 * 60 * 1000,
    ); // Day before metrics start
    const previousPeriodStart = new Date(
      previousPeriodEnd.getTime() - metricsDuration,
    );

    // Get campaign metrics (using metrics date range)
    const [
      totalCampaigns,
      campaignsLive,
      campaignsCompleted,
      previousPeriodTotalCampaigns,
      previousPeriodCampaignsLive,
      previousPeriodCampaignsCompleted,
      totalApplications,
    ] = await Promise.all([
      this.campaignModel.count({
        where: {
          isActive: true,
          createdAt: { [Op.between]: [metricsStartDate, metricsEndDate] },
        },
      }),
      this.campaignModel.count({
        where: {
          isActive: true,
          status: 'active',
          createdAt: { [Op.between]: [metricsStartDate, metricsEndDate] },
        },
      }),
      this.campaignModel.count({
        where: {
          isActive: true,
          status: 'completed',
          createdAt: { [Op.between]: [metricsStartDate, metricsEndDate] },
        },
      }),
      this.campaignModel.count({
        where: {
          isActive: true,
          createdAt: {
            [Op.between]: [previousPeriodStart, previousPeriodEnd],
          },
        },
      }),
      this.campaignModel.count({
        where: {
          isActive: true,
          status: 'active',
          createdAt: {
            [Op.between]: [previousPeriodStart, previousPeriodEnd],
          },
        },
      }),
      this.campaignModel.count({
        where: {
          isActive: true,
          status: 'completed',
          createdAt: {
            [Op.between]: [previousPeriodStart, previousPeriodEnd],
          },
        },
      }),
      this.campaignApplicationModel.count({
        where: {
          createdAt: { [Op.between]: [metricsStartDate, metricsEndDate] },
        },
      }),
    ]);

    const campaignMetrics = {
      totalCampaigns: {
        count: totalCampaigns,
        percentageChange: this.calculatePercentageChange(
          totalCampaigns,
          previousPeriodTotalCampaigns,
        ),
      },
      campaignsLive: {
        count: campaignsLive,
        percentageChange: this.calculatePercentageChange(
          campaignsLive,
          previousPeriodCampaignsLive,
        ),
      },
      campaignsCompleted: {
        count: campaignsCompleted,
        percentageChange: this.calculatePercentageChange(
          campaignsCompleted,
          previousPeriodCampaignsCompleted,
        ),
      },
      totalCampaignApplications: totalApplications,
    };

    // Get total city presence (using metrics date range)
    const totalCityPresence = await this.getCampaignCityPresence(
      metricsStartDate,
      metricsEndDate,
    );

    // Get cities with most active campaigns (using metrics date range)
    const citiesWithMostActiveCampaigns =
      await this.getCitiesWithMostActiveCampaigns(
        metricsStartDate,
        metricsEndDate,
      );

    // Get campaign posted vs applications time series (using chart date range)
    const campaignPostedVsApplications =
      await this.getCampaignPostedVsApplications(chartStartDate, chartEndDate);

    // Get campaign category distribution (using metrics date range)
    const campaignCategoryDistribution =
      await this.getCampaignCategoryDistribution(
        metricsStartDate,
        metricsEndDate,
      );

    return {
      campaignMetrics,
      totalCityPresence,
      citiesWithMostActiveCampaigns,
      campaignPostedVsApplications,
      campaignCategoryDistribution,
    };
  }

  private async getCampaignCityPresence(
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    // Get unique cities with campaigns created in date range
    const uniqueCities = await this.campaignCityModel.findAll({
      attributes: ['cityId'],
      include: [
        {
          model: Campaign,
          as: 'campaign',
          where: {
            isActive: true,
            createdAt: { [Op.between]: [startDate, endDate] },
          },
          attributes: [],
        },
      ],
      group: ['cityId'],
      raw: true,
    });

    return uniqueCities.length;
  }

  private async getCitiesWithMostActiveCampaigns(
    startDate: Date,
    endDate: Date,
  ) {
    // Get city counts from campaigns created in date range
    const cityCounts = await this.campaignCityModel.findAll({
      attributes: [
        'cityId',
        [
          this.campaignCityModel.sequelize!.fn(
            'COUNT',
            this.campaignCityModel.sequelize!.col('CampaignCity.id'),
          ),
          'count',
        ],
      ],
      include: [
        {
          model: Campaign,
          as: 'campaign',
          where: {
            isActive: true,
            createdAt: { [Op.between]: [startDate, endDate] },
          },
          attributes: [],
        },
        {
          model: City,
          as: 'city',
          attributes: ['name'],
        },
      ],
      group: ['CampaignCity.cityId', 'city.id', 'city.name'],
      order: [[this.campaignCityModel.sequelize!.literal('count'), 'DESC']],
      raw: true,
    });

    if (cityCounts.length === 0) {
      return [];
    }

    // Calculate total entries
    const totalCampaignCityEntries = cityCounts.reduce(
      (sum: number, city: any) => sum + parseInt(city.count),
      0,
    );

    // Get top 3 cities
    const top3 = cityCounts.slice(0, 3);
    const others = cityCounts.slice(3);

    const distribution = top3.map((city: any) => ({
      cityName: city['city.name'] || 'Unknown',
      percentage: parseFloat(
        ((parseInt(city.count) / totalCampaignCityEntries) * 100).toFixed(1),
      ),
    }));

    // Add "Others" if there are more cities
    if (others.length > 0) {
      const othersCount = others.reduce(
        (sum: number, city: any) => sum + parseInt(city.count),
        0,
      );
      distribution.push({
        cityName: 'Others',
        percentage: parseFloat(
          ((othersCount / totalCampaignCityEntries) * 100).toFixed(1),
        ),
      });
    }

    return distribution;
  }

  private async getCampaignPostedVsApplications(
    startDate: Date,
    endDate: Date,
  ) {
    // Get verified and unverified profile applicants
    const [verifiedCount, unverifiedCount] = await Promise.all([
      this.campaignApplicationModel.count({
        include: [
          {
            model: Influencer,
            as: 'influencer',
            where: { isVerified: true },
            attributes: [],
          },
        ],
      }),
      this.campaignApplicationModel.count({
        include: [
          {
            model: Influencer,
            as: 'influencer',
            where: { isVerified: false },
            attributes: [],
          },
        ],
      }),
    ]);

    // Generate time series data
    const timeSeriesData: Array<{
      date: string;
      campaignsPosted: number;
      applicationsReceived: number;
    }> = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const nextDate = new Date(currentDate);
      nextDate.setDate(nextDate.getDate() + 1);

      const [campaignsPosted, applicationsReceived] = await Promise.all([
        this.campaignModel.count({
          where: {
            createdAt: {
              [Op.between]: [currentDate, nextDate],
            },
            isActive: true,
          },
        }),
        this.campaignApplicationModel.count({
          where: {
            createdAt: {
              [Op.between]: [currentDate, nextDate],
            },
          },
        }),
      ]);

      timeSeriesData.push({
        date: currentDate.toISOString().split('T')[0],
        campaignsPosted,
        applicationsReceived,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return {
      currentVerifiedProfileApplicants: verifiedCount,
      currentUnverifiedProfileApplicants: unverifiedCount,
      timeSeriesData,
    };
  }

  /*
   * Get campaign category distribution
   */
  private async getCampaignCategoryDistribution(
    startDate: Date,
    endDate: Date,
  ) {
    // Get campaigns created in date range with categories
    const campaigns = await this.campaignModel.findAll({
      attributes: ['category'],
      where: {
        isActive: true,
        category: { [Op.ne]: null as any },
        createdAt: { [Op.between]: [startDate, endDate] },
      },
    });

    const totalCampaigns = campaigns.length;
    const categoryCounts: { [key: string]: number } = {};

    campaigns.forEach((campaign) => {
      const category = campaign.category || 'Other';
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });

    // Sort by count (descending) and return all categories
    const sortedCategories = Object.entries(categoryCounts).sort(
      ([, a], [, b]) => b - a,
    );

    return sortedCategories.map(([categoryName, count]) => ({
      categoryName,
      campaignCount: count,
      percentage: parseFloat(((count / totalCampaigns) * 100).toFixed(1)),
    }));
  }

  /**
   * Get Post Dashboard Statistics
   */
  async getPostDashboardStats(filters: any): Promise<PostDashboardResponseDto> {
    const {
      chartTimeFrame = DashboardTimeFrame.LAST_7_DAYS,
      chartStartDate: chartStartDateStr,
      chartEndDate: chartEndDateStr,
      metricsStartDate: metricsStartDateStr,
      metricsEndDate: metricsEndDateStr,
    } = filters;

    // Calculate chart date range
    let chartStartDate: Date;
    let chartEndDate: Date = new Date();

    if (
      chartTimeFrame === DashboardTimeFrame.CUSTOM &&
      chartStartDateStr &&
      chartEndDateStr
    ) {
      chartStartDate = new Date(chartStartDateStr);
      chartEndDate = new Date(chartEndDateStr);
    } else {
      // Handle predefined time frames for chart
      switch (chartTimeFrame) {
        case DashboardTimeFrame.LAST_24_HOURS:
          chartStartDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
          break;
        case DashboardTimeFrame.LAST_3_DAYS:
          chartStartDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
          break;
        case DashboardTimeFrame.LAST_7_DAYS:
          chartStartDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          break;
        case DashboardTimeFrame.LAST_15_DAYS:
          chartStartDate = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
          break;
        case DashboardTimeFrame.LAST_30_DAYS:
          chartStartDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          chartStartDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      }
    }

    // Calculate date ranges for metrics
    let metricsStart: Date;
    let metricsEnd: Date;

    if (metricsStartDateStr && metricsEndDateStr) {
      metricsStart = new Date(metricsStartDateStr);
      metricsEnd = new Date(metricsEndDateStr);
    } else {
      // Default to current month for metrics
      const now = new Date();
      metricsStart = new Date(now.getFullYear(), now.getMonth(), 1);
      metricsEnd = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
      );
    }

    // Calculate previous period for comparison
    const periodDuration = metricsEnd.getTime() - metricsStart.getTime();
    const prevPeriodEnd = new Date(
      metricsStart.getTime() - 24 * 60 * 60 * 1000,
    );
    const prevPeriodStart = new Date(prevPeriodEnd.getTime() - periodDuration);

    // Get post metrics
    const postMetrics = await this.getPostMetrics(
      metricsStart,
      metricsEnd,
      prevPeriodStart,
      prevPeriodEnd,
    );

    // Get city presence
    const totalCityPresence = await this.getPostCityPresence(
      metricsStart,
      metricsEnd,
    );

    // Get cities with most posts
    const citiesWithMostPosts = await this.getCitiesWithMostPosts(
      metricsStart,
      metricsEnd,
    );

    // Get content posted vs engagement
    const contentPostedVsEngagement = await this.getContentPostedVsEngagement(
      chartStartDate,
      chartEndDate,
    );

    // Get content category distribution
    const contentCategoryDistribution = await this.getPostCategoryDistribution(
      metricsStart,
      metricsEnd,
    );

    return {
      postMetrics,
      totalCityPresence,
      citiesWithMostPosts,
      contentPostedVsEngagement,
      contentCategoryDistribution,
    };
  }

  /**
   * Calculate post metrics with comparison to previous period
   */
  private async getPostMetrics(
    currentStart: Date,
    currentEnd: Date,
    prevStart: Date,
    prevEnd: Date,
  ) {
    // Current period metrics
    const currentPosts = await this.postModel.count({
      where: {
        isActive: true,
        createdAt: { [Op.between]: [currentStart, currentEnd] },
      },
    });

    const currentLikes = await this.postModel.sum('likesCount', {
      where: {
        isActive: true,
        createdAt: { [Op.between]: [currentStart, currentEnd] },
      },
    });

    // Previous period metrics
    const prevPosts = await this.postModel.count({
      where: {
        isActive: true,
        createdAt: { [Op.between]: [prevStart, prevEnd] },
      },
    });

    const prevLikes = await this.postModel.sum('likesCount', {
      where: {
        isActive: true,
        createdAt: { [Op.between]: [prevStart, prevEnd] },
      },
    });

    // Calculate changes
    const totalPostsChange = this.calculatePercentageChange(
      currentPosts,
      prevPosts,
    );

    // Calculate daily averages
    const currentDays = Math.max(
      1,
      Math.ceil(
        (currentEnd.getTime() - currentStart.getTime()) / (1000 * 60 * 60 * 24),
      ),
    );
    const prevDays = Math.max(
      1,
      Math.ceil(
        (prevEnd.getTime() - prevStart.getTime()) / (1000 * 60 * 60 * 24),
      ),
    );

    const dailyAvgPosts = parseFloat((currentPosts / currentDays).toFixed(2));
    const prevDailyAvgPosts = parseFloat((prevPosts / prevDays).toFixed(2));
    const dailyAvgPostsChange = this.calculatePercentageChange(
      dailyAvgPosts,
      prevDailyAvgPosts,
    );

    // For now, engagement is likes (shares not in model yet)
    const totalEngagement = currentLikes || 0;
    const prevEngagement = prevLikes || 0;
    const totalEngagementChange = this.calculatePercentageChange(
      totalEngagement,
      prevEngagement,
    );

    // Engagement rate (likes per post)
    const engagementRate =
      currentPosts > 0
        ? parseFloat(((totalEngagement / currentPosts) * 100).toFixed(2))
        : 0;
    const prevEngagementRate =
      prevPosts > 0
        ? parseFloat(((prevEngagement / prevPosts) * 100).toFixed(2))
        : 0;
    const engagementRateChange = this.calculatePercentageChange(
      engagementRate,
      prevEngagementRate,
    );

    // Average likes per post
    const avgLikesPerPost =
      currentPosts > 0
        ? parseFloat((totalEngagement / currentPosts).toFixed(2))
        : 0;
    const prevAvgLikesPerPost =
      prevPosts > 0 ? parseFloat((prevEngagement / prevPosts).toFixed(2)) : 0;
    const avgLikesPerPostChange = this.calculatePercentageChange(
      avgLikesPerPost,
      prevAvgLikesPerPost,
    );

    // Shares (placeholder - not in model yet, using 0)
    const totalShares = 0;
    const avgSharesPerPost = 0;
    const avgSharesPerPostChange = 0;

    return {
      totalPosts: currentPosts,
      totalPostsChange,
      dailyAvgPosts,
      dailyAvgPostsChange,
      totalEngagement,
      totalEngagementChange,
      engagementRate,
      engagementRateChange,
      totalLikes: totalEngagement,
      avgLikesPerPost,
      avgLikesPerPostChange,
      totalShares,
      avgSharesPerPost,
      avgSharesPerPostChange,
    };
  }

  /**
   * Get total city presence for posts
   */
  private async getPostCityPresence(startDate: Date, endDate: Date) {
    // Get unique cities from influencers and brands who posted
    const posts = await this.postModel.findAll({
      attributes: ['influencerId', 'brandId', 'userType'],
      where: {
        isActive: true,
        createdAt: { [Op.between]: [startDate, endDate] },
      },
      include: [
        {
          model: Influencer,
          as: 'influencer',
          attributes: ['cityId'],
          required: false,
          include: [
            {
              model: City,
              as: 'city',
              attributes: ['id', 'name'],
            },
          ],
        },
        {
          model: Brand,
          as: 'brand',
          attributes: ['headquarterCityId'],
          required: false,
          include: [
            {
              model: City,
              as: 'headquarterCity',
              attributes: ['id', 'name'],
            },
          ],
        },
      ],
    });

    const uniqueCityIds = new Set<number>();
    posts.forEach((post) => {
      const cityId =
        post.influencer?.city?.id || post.brand?.headquarterCity?.id;
      if (cityId) {
        uniqueCityIds.add(cityId);
      }
    });

    return uniqueCityIds.size;
  }

  /**
   * Get cities with most posts
   */
  private async getCitiesWithMostPosts(startDate: Date, endDate: Date) {
    const posts = await this.postModel.findAll({
      attributes: ['influencerId', 'brandId', 'userType'],
      where: {
        isActive: true,
        createdAt: { [Op.between]: [startDate, endDate] },
      },
      include: [
        {
          model: Influencer,
          as: 'influencer',
          attributes: ['cityId'],
          required: false,
          include: [
            {
              model: City,
              as: 'city',
              attributes: ['id', 'name'],
            },
          ],
        },
        {
          model: Brand,
          as: 'brand',
          attributes: ['headquarterCityId'],
          required: false,
          include: [
            {
              model: City,
              as: 'headquarterCity',
              attributes: ['id', 'name'],
            },
          ],
        },
      ],
    });

    const cityCounts: { [key: string]: number } = {};
    let totalPosts = 0;

    posts.forEach((post) => {
      const cityName =
        post.influencer?.city?.name || post.brand?.headquarterCity?.name;
      if (cityName) {
        cityCounts[cityName] = (cityCounts[cityName] || 0) + 1;
        totalPosts++;
      }
    });

    // Sort and get top 4 cities
    const sortedCities = Object.entries(cityCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 4);

    // Calculate "Others" percentage
    const top4Count = sortedCities.reduce((sum, [, count]) => sum + count, 0);
    const othersCount = totalPosts - top4Count;

    const result = sortedCities.map(([cityName, count]) => ({
      cityName,
      percentage: parseFloat(((count / totalPosts) * 100).toFixed(1)),
    }));

    // Add "Others" if there are more cities
    if (othersCount > 0) {
      result.push({
        cityName: 'Others',
        percentage: parseFloat(((othersCount / totalPosts) * 100).toFixed(1)),
      });
    }

    return result;
  }

  /**
   * Get content posted vs engagement time series
   */
  private async getContentPostedVsEngagement(startDate: Date, endDate: Date) {
    // Get verified posts count
    const verifiedPosts = await this.postModel.count({
      where: {
        isActive: true,
        createdAt: { [Op.between]: [startDate, endDate] },
      },
      include: [
        {
          model: Influencer,
          as: 'influencer',
          attributes: [],
          where: { isVerified: true },
          required: false,
        },
        {
          model: Brand,
          as: 'brand',
          attributes: [],
          where: { isVerified: true },
          required: false,
        },
      ],
    });

    // Get all posts in range
    const totalPosts = await this.postModel.count({
      where: {
        isActive: true,
        createdAt: { [Op.between]: [startDate, endDate] },
      },
    });

    const unverifiedPosts = totalPosts - verifiedPosts;

    // Get time series data (daily posts and engagement)
    const timeSeriesData = await this.getPostTimeSeriesData(startDate, endDate);

    return {
      verifiedProfilePosts: verifiedPosts,
      unverifiedProfilePosts: unverifiedPosts,
      timeSeriesData,
    };
  }

  /**
   * Get daily time series data for posts and engagement
   */
  private async getPostTimeSeriesData(startDate: Date, endDate: Date) {
    const posts = await this.postModel.findAll({
      attributes: ['createdAt', 'likesCount'],
      where: {
        isActive: true,
        createdAt: { [Op.between]: [startDate, endDate] },
      },
      order: [['createdAt', 'ASC']],
    });

    // Group by date
    const dataByDate: {
      [key: string]: { postsCount: number; engagementCount: number };
    } = {};

    posts.forEach((post) => {
      const date = post.createdAt.toISOString().split('T')[0];
      if (!dataByDate[date]) {
        dataByDate[date] = { postsCount: 0, engagementCount: 0 };
      }
      dataByDate[date].postsCount++;
      dataByDate[date].engagementCount += post.likesCount || 0;
    });

    // Fill in missing dates with zero values
    const result: Array<{
      date: string;
      postsCount: number;
      engagementCount: number;
    }> = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      result.push({
        date: dateStr,
        postsCount: dataByDate[dateStr]?.postsCount || 0,
        engagementCount: dataByDate[dateStr]?.engagementCount || 0,
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return result;
  }

  /**
   * Get post category distribution
   */
  private async getPostCategoryDistribution(startDate: Date, endDate: Date) {
    // Get posts with user niches
    const posts = await this.postModel.findAll({
      attributes: ['influencerId', 'brandId', 'userType'],
      where: {
        isActive: true,
        createdAt: { [Op.between]: [startDate, endDate] },
      },
      include: [
        {
          model: Influencer,
          as: 'influencer',
          attributes: ['id'],
          required: false,
          include: [
            {
              model: Niche,
              as: 'niches',
              attributes: ['id', 'name'],
              through: { attributes: [] },
            },
          ],
        },
        {
          model: Brand,
          as: 'brand',
          attributes: ['id'],
          required: false,
          include: [
            {
              model: Niche,
              as: 'niches',
              attributes: ['id', 'name'],
              through: { attributes: [] },
            },
          ],
        },
      ],
    });

    const totalPosts = posts.length;
    const nicheCounts: { [key: string]: number } = {};

    // Count posts per niche
    posts.forEach((post) => {
      const niches = post.influencer?.niches || post.brand?.niches || [];
      if (niches.length === 0) {
        nicheCounts['Others + Custom'] =
          (nicheCounts['Others + Custom'] || 0) + 1;
      } else {
        niches.forEach((niche: any) => {
          const nicheName = niche.name || 'Others + Custom';
          nicheCounts[nicheName] = (nicheCounts[nicheName] || 0) + 1;
        });
      }
    });

    // Sort by count and return all
    const sortedNiches = Object.entries(nicheCounts).sort(
      ([, a], [, b]) => b - a,
    );

    return sortedNiches.map(([categoryName, count]) => ({
      categoryName,
      percentage: parseFloat(((count / totalPosts) * 100).toFixed(1)),
    }));
  }
}
