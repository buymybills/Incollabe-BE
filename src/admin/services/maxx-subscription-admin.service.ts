import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, fn, col, literal } from 'sequelize';
import { ProSubscription } from '../../influencer/models/pro-subscription.model';
import { ProInvoice } from '../../influencer/models/pro-invoice.model';
import { Influencer } from '../../auth/model/influencer.model';
import { City } from '../../shared/models/city.model';
import { SubscriptionStatus, PaymentMethod } from '../../influencer/models/payment-enums';
import {
  GetMaxxSubscriptionsDto,
  MaxxSubscriptionStatisticsDto,
  MaxxSubscriptionsResponseDto,
  MaxxSubscriptionItemDto,
  SubscriptionDetailsDto,
  PaymentHistoryItemDto,
  ProfileStatusFilter,
  PaymentTypeFilter,
  PauseSubscriptionDto,
  ResumeSubscriptionDto,
  CancelSubscriptionDto,
  SubscriptionActionResponseDto,
} from '../dto/maxx-subscription.dto';

@Injectable()
export class MaxxSubscriptionAdminService {
  constructor(
    @InjectModel(ProSubscription)
    private readonly proSubscriptionModel: typeof ProSubscription,
    @InjectModel(ProInvoice)
    private readonly proInvoiceModel: typeof ProInvoice,
    @InjectModel(Influencer)
    private readonly influencerModel: typeof Influencer,
  ) {}

  /**
   * Get Maxx subscription statistics with month-over-month growth
   */
  async getMaxxSubscriptionStatistics(): Promise<MaxxSubscriptionStatisticsDto> {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // 1. Total Maxx Profiles (all subscriptions ever created)
    const totalMaxxProfiles = await this.proSubscriptionModel.count();
    const lastMonthTotalProfiles = await this.proSubscriptionModel.count({
      where: {
        createdAt: {
          [Op.lt]: currentMonthStart,
        },
      },
    });
    const totalMaxxProfilesGrowth = this.calculateGrowth(
      totalMaxxProfiles,
      lastMonthTotalProfiles,
    );

    // 2. Active Maxx Profiles
    const activeMaxxProfiles = await this.proSubscriptionModel.count({
      where: {
        status: SubscriptionStatus.ACTIVE,
      },
    });
    const lastMonthActiveProfiles = await this.proSubscriptionModel.count({
      where: {
        status: SubscriptionStatus.ACTIVE,
        createdAt: {
          [Op.lt]: currentMonthStart,
        },
      },
    });
    const activeMaxxProfilesGrowth = this.calculateGrowth(
      activeMaxxProfiles,
      lastMonthActiveProfiles,
    );

    // 3. Inactive Maxx Profiles (expired + payment_failed)
    const inactiveMaxxProfiles = await this.proSubscriptionModel.count({
      where: {
        status: {
          [Op.in]: [SubscriptionStatus.EXPIRED, SubscriptionStatus.PAYMENT_FAILED],
        },
      },
    });
    const lastMonthInactiveProfiles = await this.proSubscriptionModel.count({
      where: {
        status: {
          [Op.in]: [SubscriptionStatus.EXPIRED, SubscriptionStatus.PAYMENT_FAILED],
        },
        updatedAt: {
          [Op.lt]: currentMonthStart,
        },
      },
    });
    const inactiveMaxxProfilesGrowth = this.calculateGrowth(
      inactiveMaxxProfiles,
      lastMonthInactiveProfiles,
    );

    // 4. Subscription Cancelled
    const subscriptionCancelled = await this.proSubscriptionModel.count({
      where: {
        status: SubscriptionStatus.CANCELLED,
      },
    });
    const lastMonthCancelled = await this.proSubscriptionModel.count({
      where: {
        status: SubscriptionStatus.CANCELLED,
        cancelledAt: {
          [Op.lt]: currentMonthStart,
        },
      },
    });
    const subscriptionCancelledGrowth = this.calculateGrowth(
      subscriptionCancelled,
      lastMonthCancelled,
    );

    // 5. Average Usage Duration (in months)
    const subscriptionsWithDuration = await this.proSubscriptionModel.findAll({
      attributes: [
        [
          fn(
            'AVG',
            literal(
              `EXTRACT(EPOCH FROM (COALESCE("currentPeriodEnd", NOW()) - "startDate")) / (30.44 * 24 * 60 * 60)`,
            ),
          ),
          'avgDuration',
        ],
      ],
      raw: true,
    });
    const averageUsageDuration = Number(subscriptionsWithDuration[0]?.['avgDuration'] || 0);

    const lastMonthSubscriptionsWithDuration = await this.proSubscriptionModel.findAll({
      attributes: [
        [
          fn(
            'AVG',
            literal(
              `EXTRACT(EPOCH FROM (COALESCE("currentPeriodEnd", NOW()) - "startDate")) / (30.44 * 24 * 60 * 60)`,
            ),
          ),
          'avgDuration',
        ],
      ],
      where: {
        createdAt: {
          [Op.lt]: currentMonthStart,
        },
      },
      raw: true,
    });
    const lastMonthAvgDuration = Number(
      lastMonthSubscriptionsWithDuration[0]?.['avgDuration'] || 0,
    );
    const averageUsageDurationGrowth = this.calculateGrowth(
      averageUsageDuration,
      lastMonthAvgDuration,
    );

    // 6. Autopay Subscription Count
    const autopaySubscriptionCount = await this.proSubscriptionModel.count({
      where: {
        autoRenew: true,
        status: {
          [Op.notIn]: [SubscriptionStatus.CANCELLED, SubscriptionStatus.EXPIRED],
        },
      },
    });
    const lastMonthAutopayCount = await this.proSubscriptionModel.count({
      where: {
        autoRenew: true,
        status: {
          [Op.notIn]: [SubscriptionStatus.CANCELLED, SubscriptionStatus.EXPIRED],
        },
        createdAt: {
          [Op.lt]: currentMonthStart,
        },
      },
    });
    const autopaySubscriptionCountGrowth = this.calculateGrowth(
      autopaySubscriptionCount,
      lastMonthAutopayCount,
    );

    return {
      totalMaxxProfiles,
      totalMaxxProfilesGrowth,
      activeMaxxProfiles,
      activeMaxxProfilesGrowth,
      inactiveMaxxProfiles,
      inactiveMaxxProfilesGrowth,
      subscriptionCancelled,
      subscriptionCancelledGrowth,
      averageUsageDuration: Math.round(averageUsageDuration * 10) / 10,
      averageUsageDurationGrowth,
      autopaySubscriptionCount,
      autopaySubscriptionCountGrowth,
    };
  }

  /**
   * Get paginated list of Maxx subscriptions with filters
   */
  async getMaxxSubscriptions(
    filters: GetMaxxSubscriptionsDto,
  ): Promise<MaxxSubscriptionsResponseDto> {
    const {
      page = 1,
      limit = 20,
      profileStatus,
      paymentType,
      search,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      startDate,
      endDate,
      validTillStartDate,
      validTillEndDate,
    } = filters;

    const offset = (page - 1) * limit;

    // Build where clause for subscriptions
    const whereClause: any = {};

    // Status filter
    if (profileStatus && profileStatus !== ProfileStatusFilter.ALL) {
      switch (profileStatus) {
        case ProfileStatusFilter.ACTIVE:
          whereClause.status = SubscriptionStatus.ACTIVE;
          break;
        case ProfileStatusFilter.INACTIVE:
          whereClause.status = {
            [Op.in]: [SubscriptionStatus.EXPIRED, SubscriptionStatus.PAYMENT_FAILED],
          };
          break;
        case ProfileStatusFilter.CANCELLED:
          whereClause.status = SubscriptionStatus.CANCELLED;
          break;
        case ProfileStatusFilter.PAUSED:
          whereClause.status = SubscriptionStatus.PAUSED;
          break;
        case ProfileStatusFilter.PAYMENT_PENDING:
          whereClause.status = SubscriptionStatus.PAYMENT_PENDING;
          break;
        case ProfileStatusFilter.PAYMENT_FAILED:
          whereClause.status = SubscriptionStatus.PAYMENT_FAILED;
          break;
      }
    }

    // Payment type filter
    if (paymentType && paymentType !== PaymentTypeFilter.ALL) {
      if (paymentType === PaymentTypeFilter.AUTOPAY) {
        whereClause.autoRenew = true;
      } else if (paymentType === PaymentTypeFilter.MONTHLY) {
        whereClause.autoRenew = false;
      }
    }

    // Date range filter for subscription creation date
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) {
        whereClause.createdAt[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        whereClause.createdAt[Op.lte] = endDateTime;
      }
    }

    // Date range filter for valid till date
    if (validTillStartDate || validTillEndDate) {
      whereClause.currentPeriodEnd = {};
      if (validTillStartDate) {
        whereClause.currentPeriodEnd[Op.gte] = new Date(validTillStartDate);
      }
      if (validTillEndDate) {
        const endDateTime = new Date(validTillEndDate);
        endDateTime.setHours(23, 59, 59, 999);
        whereClause.currentPeriodEnd[Op.lte] = endDateTime;
      }
    }

    // Build search clause
    // When searching, we want to match profile name, username, OR location
    // This requires using Sequelize's $or syntax at the query root level
    if (search) {
      // Add search conditions to main where clause using Sequelize's nested column syntax
      whereClause[Op.or] = [
        { '$influencer.name$': { [Op.iLike]: `%${search}%` } },
        { '$influencer.username$': { [Op.iLike]: `%${search}%` } },
        { '$influencer.city.name$': { [Op.iLike]: `%${search}%` } },
      ];
    }

    // Determine sort field
    let orderField: any = [['createdAt', sortOrder]];
    if (sortBy === 'usageMonths') {
      orderField = [['startDate', sortOrder]];
    } else if (sortBy === 'validTill') {
      orderField = [['currentPeriodEnd', sortOrder]];
    } else if (sortBy === 'paymentType') {
      orderField = [['autoRenew', sortOrder]];
    }

    // Get subscriptions with influencer details
    const { count, rows: subscriptions } = await this.proSubscriptionModel.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Influencer,
          as: 'influencer',
          attributes: ['id', 'name', 'username', 'profileImage', 'cityId'],
          required: true,
          include: [
            {
              model: City,
              attributes: ['name'],
              required: false,
            },
          ],
        },
      ],
      limit,
      offset,
      order: orderField,
      subQuery: false,
      distinct: true,
    });

    // Build response data
    const data: MaxxSubscriptionItemDto[] = subscriptions.map((subscription) => {
      const influencer = subscription.influencer;

      // Calculate usage months
      const startDate = new Date(subscription.startDate);
      const endDate = subscription.currentPeriodEnd
        ? new Date(subscription.currentPeriodEnd)
        : new Date();
      const usageMonths = Math.max(
        1,
        Math.round(
          (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44),
        ),
      );

      // Map status to profile status
      let profileStatus = subscription.status;
      if (
        subscription.status === SubscriptionStatus.EXPIRED ||
        subscription.status === SubscriptionStatus.PAYMENT_FAILED
      ) {
        profileStatus = SubscriptionStatus.INACTIVE;
      }

      // Determine payment type
      const paymentType = subscription.autoRenew ? 'autopay' : 'monthly';

      return {
        id: subscription.id,
        influencerId: subscription.influencerId,
        profileName: influencer?.name || 'N/A',
        username: influencer?.username || 'N/A',
        location: influencer?.city?.name || 'N/A',
        profileStatus,
        usageMonths,
        paymentType,
        validTillDate: subscription.currentPeriodEnd,
        subscriptionStartDate: subscription.startDate,
        profileImage: influencer?.profileImage,
        isAutoRenew: subscription.autoRenew,
        razorpaySubscriptionId: subscription.razorpaySubscriptionId,
      };
    });

    return {
      data,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  /**
   * Get detailed subscription information
   */
  async getSubscriptionDetails(subscriptionId: number): Promise<SubscriptionDetailsDto> {
    const subscription = await this.proSubscriptionModel.findByPk(subscriptionId, {
      include: [
        {
          model: Influencer,
          as: 'influencer',
          attributes: ['id', 'name', 'username', 'profileImage', 'isVerified', 'cityId'],
          include: [
            {
              model: City,
              attributes: ['name'],
            },
          ],
        },
        {
          model: ProInvoice,
          as: 'invoices',
          order: [['createdAt', 'DESC']],
        },
      ],
    });

    if (!subscription) {
      throw new NotFoundException(`Subscription with ID ${subscriptionId} not found`);
    }

    const influencer = subscription.influencer;

    // Calculate usage months
    const startDate = new Date(subscription.startDate);
    const endDate = subscription.currentPeriodEnd
      ? new Date(subscription.currentPeriodEnd)
      : new Date();
    const usageMonths = Math.max(
      1,
      Math.round(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44),
      ),
    );

    // Calculate total amount paid
    const paidInvoices = subscription.invoices?.filter((inv) => inv.paymentStatus === 'paid') || [];
    const totalAmount = paidInvoices.reduce((sum, inv) => sum + (inv.totalAmount / 100), 0);

    // Build payment history
    const paymentHistory: PaymentHistoryItemDto[] = (subscription.invoices || []).map((invoice) => ({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      amount: invoice.totalAmount / 100, // Convert from paise to Rs
      paymentDate: invoice.paidAt,
      paymentStatus: invoice.paymentStatus,
      razorpayPaymentId: invoice.razorpayPaymentId,
    }));

    // Get last payment date
    const lastPaymentDate = paidInvoices.length > 0
      ? paidInvoices.sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())[0].paidAt
      : null;

    return {
      id: subscription.id,
      influencerId: subscription.influencerId,
      influencer: {
        id: influencer.id,
        name: influencer.name,
        username: influencer.username,
        location: influencer.city?.name || 'N/A',
        profileImage: influencer.profileImage,
        isVerified: influencer.isVerified,
      },
      subscriptionStatus: subscription.status,
      paymentType: subscription.autoRenew ? 'autopay' : 'monthly',
      razorpaySubscriptionId: subscription.razorpaySubscriptionId,
      subscriptionStartDate: subscription.startDate,
      subscriptionEndDate: subscription.currentPeriodEnd,
      usageMonths,
      totalAmount,
      amountPerMonth: subscription.subscriptionAmount / 100,
      isAutoRenew: subscription.autoRenew,
      nextBillingDate: subscription.nextBillingDate,
      lastPaymentDate,
      paymentHistory,
      isPaused: subscription.isPaused || false,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
    };
  }

  /**
   * Pause a subscription (admin action)
   */
  async pauseSubscription(
    subscriptionId: number,
    dto: PauseSubscriptionDto,
  ): Promise<SubscriptionActionResponseDto> {
    const subscription = await this.proSubscriptionModel.findByPk(subscriptionId);

    if (!subscription) {
      throw new NotFoundException(`Subscription with ID ${subscriptionId} not found`);
    }

    if (subscription.status === SubscriptionStatus.CANCELLED) {
      throw new BadRequestException('Cannot pause a cancelled subscription');
    }

    if (subscription.isPaused) {
      throw new BadRequestException('Subscription is already paused');
    }

    await subscription.update({
      status: SubscriptionStatus.PAUSED,
      isPaused: true,
      pausedAt: new Date(),
      pauseReason: dto.reason || 'Admin paused',
      pauseCount: subscription.pauseCount + 1,
    });

    return {
      success: true,
      message: 'Subscription paused successfully',
      subscriptionId: subscription.id,
      status: subscription.status,
      timestamp: new Date(),
    };
  }

  /**
   * Resume a paused subscription (admin action)
   */
  async resumeSubscription(
    subscriptionId: number,
    dto: ResumeSubscriptionDto,
  ): Promise<SubscriptionActionResponseDto> {
    const subscription = await this.proSubscriptionModel.findByPk(subscriptionId);

    if (!subscription) {
      throw new NotFoundException(`Subscription with ID ${subscriptionId} not found`);
    }

    if (!subscription.isPaused && subscription.status !== SubscriptionStatus.PAUSED) {
      throw new BadRequestException('Subscription is not paused');
    }

    // Calculate new dates
    const now = new Date();
    const pauseDuration = subscription.pausedAt
      ? Math.floor((now.getTime() - new Date(subscription.pausedAt).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    const newCurrentPeriodEnd = new Date(subscription.currentPeriodEnd);
    newCurrentPeriodEnd.setDate(newCurrentPeriodEnd.getDate() + pauseDuration);

    const newNextBillingDate = subscription.nextBillingDate
      ? new Date(new Date(subscription.nextBillingDate).getTime() + pauseDuration * 24 * 60 * 60 * 1000)
      : null;

    await subscription.update({
      status: SubscriptionStatus.ACTIVE,
      isPaused: false,
      pausedAt: null,
      resumeDate: now,
      pauseReason: null,
      totalPausedDays: subscription.totalPausedDays + pauseDuration,
      currentPeriodEnd: newCurrentPeriodEnd,
      nextBillingDate: newNextBillingDate,
    });

    return {
      success: true,
      message: 'Subscription resumed successfully',
      subscriptionId: subscription.id,
      status: subscription.status,
      timestamp: now,
    };
  }

  /**
   * Cancel a subscription (admin action)
   */
  async cancelSubscription(
    subscriptionId: number,
    dto: CancelSubscriptionDto,
  ): Promise<SubscriptionActionResponseDto> {
    const subscription = await this.proSubscriptionModel.findByPk(subscriptionId);

    if (!subscription) {
      throw new NotFoundException(`Subscription with ID ${subscriptionId} not found`);
    }

    if (subscription.status === SubscriptionStatus.CANCELLED) {
      throw new BadRequestException('Subscription is already cancelled');
    }

    const now = new Date();

    await subscription.update({
      status: SubscriptionStatus.CANCELLED,
      cancelledAt: now,
      cancelReason: dto.reason,
      autoRenew: false,
      currentPeriodEnd: dto.immediateEffect ? now : subscription.currentPeriodEnd,
      nextBillingDate: null,
    });

    return {
      success: true,
      message: dto.immediateEffect
        ? 'Subscription cancelled immediately'
        : 'Subscription will be cancelled at period end',
      subscriptionId: subscription.id,
      status: subscription.status,
      timestamp: now,
    };
  }

  /**
   * Helper function to calculate growth percentage
   */
  private calculateGrowth(current: number, previous: number): number {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }
    const growth = ((current - previous) / previous) * 100;
    return Math.round(growth * 10) / 10;
  }
}
