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
import {
  MainDashboardResponseDto,
  InfluencerDashboardResponseDto,
  BrandDashboardResponseDto,
  CampaignDashboardResponseDto,
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
        headquarterCityId: { [Op.ne]: null as any },
      },
    });

    const totalBrands = brands.length;
    const cityCounts: { [key: string]: number } = {};

    brands.forEach((brand) => {
      const cityName = brand.headquarterCity?.name || 'Unknown';
      cityCounts[cityName] = (cityCounts[cityName] || 0) + 1;
    });

    // Sort by count and get top 3
    const sortedCities = Object.entries(cityCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);

    const top3Count = sortedCities.reduce((sum, [, count]) => sum + count, 0);
    const othersCount = totalBrands - top3Count;

    const distribution = sortedCities.map(([cityName, count]) => ({
      cityName,
      influencerCount: count,
      percentage: parseFloat(((count / totalBrands) * 100).toFixed(1)),
    }));

    if (othersCount > 0) {
      distribution.push({
        cityName: 'Others',
        influencerCount: othersCount,
        percentage: parseFloat(((othersCount / totalBrands) * 100).toFixed(1)),
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

      // Count verified brands created on this day
      const verifiedCount = await this.brandModel.count({
        where: {
          isVerified: true,
          isActive: true,
          createdAt: {
            [Op.gte]: dayStart,
            [Op.lte]: dayEnd,
          },
        },
      });

      // Count unverified brands created on this day
      const unverifiedCount = await this.brandModel.count({
        where: {
          isVerified: false,
          isActive: true,
          createdAt: {
            [Op.gte]: dayStart,
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

    // Get current totals
    const currentVerifiedCount = await this.brandModel.count({
      where: { isVerified: true, isActive: true },
    });

    const currentUnverifiedCount = await this.brandModel.count({
      where: { isVerified: false, isActive: true },
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
      influencerCount: count,
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

    const influencerMinDate = influencerDates[0]?.['minDate'] as Date;
    const influencerMaxDate = influencerDates[0]?.['maxDate'] as Date;
    const brandMinDate = brandDates[0]?.['minDate'] as Date;
    const brandMaxDate = brandDates[0]?.['maxDate'] as Date;
    const campaignMinDate = campaignDates[0]?.['minDate'] as Date;
    const campaignMaxDate = campaignDates[0]?.['maxDate'] as Date;

    // Get the overall min and max dates across all entities
    const minDate = new Date(
      Math.min(
        influencerMinDate?.getTime() || Date.now(),
        brandMinDate?.getTime() || Date.now(),
        campaignMinDate?.getTime() || Date.now(),
      ),
    );
    const maxDate = new Date(
      Math.max(
        influencerMaxDate?.getTime() || Date.now(),
        brandMaxDate?.getTime() || Date.now(),
        campaignMaxDate?.getTime() || Date.now(),
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
      metricsEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
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
    const sortedCategories = Object.entries(categoryCounts)
      .sort(([, a], [, b]) => b - a);

    return sortedCategories.map(([categoryName, count]) => ({
      categoryName,
      campaignCount: count,
      percentage: parseFloat(((count / totalCampaigns) * 100).toFixed(1)),
    }));
  }
}
