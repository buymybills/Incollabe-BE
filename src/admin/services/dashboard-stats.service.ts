import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Influencer } from '../../auth/model/influencer.model';
import { Brand } from '../../brand/model/brand.model';
import { Campaign } from '../../campaign/models/campaign.model';
import { CampaignApplication } from '../../campaign/models/campaign-application.model';
import { City } from '../../shared/models/city.model';
import { Niche } from '../../auth/model/niche.model';
import { ProfileReview } from '../models/profile-review.model';
import { ProfileType, ReviewStatus } from '../models/profile-review.model';
import {
  MainDashboardResponseDto,
  InfluencerDashboardResponseDto,
  BrandDashboardResponseDto,
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
        return {
          id: campaign.id,
          name: campaign.name,
          brandName: (campaign as any).brand?.brandName || '',
          brandLogo: (campaign as any).brand?.profileImage || '',
          category: campaign.category || '',
          deliverableFormat: campaign.deliverableFormat || '',
          status: campaign.status,
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
  ): Promise<InfluencerDashboardResponseDto> {
    const now = new Date();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    let chartStartDate: Date;
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
      case DashboardTimeFrame.LAST_30_DAYS:
        chartStartDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        chartStartDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
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
      now,
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
  ): Promise<BrandDashboardResponseDto> {
    // Calculate date range based on timeFrame
    let startDate: Date;
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
      case DashboardTimeFrame.LAST_30_DAYS:
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    }

    const currentDate = new Date();
    const currentMonthStart = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1,
    );
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
    const dailyActiveBrands = await this.getDailyActiveBrands(startDate);

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

  private async getDailyActiveBrands(startDate: Date) {
    const endDate = new Date();
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
}
