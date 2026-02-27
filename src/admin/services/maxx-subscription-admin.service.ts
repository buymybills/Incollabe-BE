import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, fn, col, literal } from 'sequelize';
import { ProSubscription } from '../../influencer/models/pro-subscription.model';
import { ProInvoice, InvoiceStatus } from '../../influencer/models/pro-invoice.model';
import { Influencer } from '../../auth/model/influencer.model';
import { City } from '../../shared/models/city.model';
import { SubscriptionStatus, PaymentMethod } from '../../influencer/models/payment-enums';
import { toIST, createDatabaseDate } from '../../shared/utils/date.utils';
import { ProSubscriptionService } from '../../influencer/services/pro-subscription.service';
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
  AdminCancelSubscriptionDto,
  SubscriptionActionResponseDto,
  FixMissingInvoiceResponseDto,
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
    @InjectModel(City)
    private readonly cityModel: typeof City,
    private readonly proSubscriptionService: ProSubscriptionService,
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
    // Note: We'll filter by search after fetching to enable priority-based sorting
    const subscriptions = await this.proSubscriptionModel.findAll({
      where: whereClause,
      include: [
        {
          model: Influencer,
          as: 'influencer',
          attributes: ['id', 'name', 'username', 'profileImage', 'cityId'],
          required: true,
          include: [
            {
              model: this.cityModel,
              attributes: ['name'],
              required: false,
            },
          ],
        },
      ],
      order: orderField,
      subQuery: false,
    });

    // Calculate search priority helper function
    // Prioritizes matches by field (name first, then username, then city), then by position
    const calculateSearchPriority = (
      name: string,
      username: string,
      cityName: string,
      searchTerm: string,
    ): number => {
      if (!searchTerm) return 0;

      const lowerSearchTerm = searchTerm.toLowerCase();
      const lowerName = name.toLowerCase();
      const lowerUsername = username.toLowerCase();
      const lowerCity = cityName.toLowerCase();

      const nameIndex = lowerName.indexOf(lowerSearchTerm);
      const usernameIndex = lowerUsername.indexOf(lowerSearchTerm);
      const cityIndex = lowerCity.indexOf(lowerSearchTerm);

      // Priority tiers:
      // 1000-1999: Match in name (1000 = starts with, 1001 = position 1, etc.)
      // 2000-2999: Match in username (2000 = starts with, 2001 = position 1, etc.)
      // 3000-3999: Match in city (3000 = starts with, 3001 = position 1, etc.)
      // 9999: No match

      if (nameIndex >= 0) {
        return 1000 + nameIndex;
      } else if (usernameIndex >= 0) {
        return 2000 + usernameIndex;
      } else if (cityIndex >= 0) {
        return 3000 + cityIndex;
      }

      return 9999;
    };

    // Helper function to format status (remove underscores, convert to camelCase)
    const formatStatus = (status: string): string => {
      return status.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    };

    // Build response data with search filtering and priority
    const allData: (MaxxSubscriptionItemDto & { searchPriority: number })[] = subscriptions
      .map((subscription) => {
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
      // Check autoRenew flag to identify autopay vs monthly
      // autoRenew: true = autopay (automatic recurring payments)
      // autoRenew: false = monthly (manual/one-time payments)
      const paymentType = subscription.autoRenew ? 'autopay' : 'monthly';

      // Calculate search priority
      const profileName = influencer?.name || 'N/A';
      const userName = influencer?.username || 'N/A';
      const cityName = influencer?.city?.name || 'N/A';
      const searchPriority = calculateSearchPriority(
        profileName,
        userName,
        cityName,
        search || '',
      );

      return {
        id: subscription.id,
        influencerId: subscription.influencerId,
        profileName,
        username: userName,
        location: cityName,
        profileStatus: formatStatus(profileStatus),
        usageMonths,
        paymentType,
        validTillDate: toIST(subscription.currentPeriodEnd),
        subscriptionStartDate: toIST(subscription.startDate),
        profileImage: influencer?.profileImage,
        isAutoRenew: subscription.autoRenew,
        razorpaySubscriptionId: subscription.razorpaySubscriptionId,
        searchPriority,
      };
    })
    .filter((item) => {
      // Filter by search if provided
      if (!search) return true;
      return item.searchPriority < 9999; // Only include items that matched the search
    });

    // Sort by search priority when search is active
    if (search) {
      allData.sort((a, b) => a.searchPriority - b.searchPriority);
    }

    // Apply pagination
    const total = allData.length;
    const totalPages = Math.ceil(total / limit);
    const paginatedData = allData.slice(offset, offset + limit);

    // Remove searchPriority from response
    const data = paginatedData.map(({ searchPriority, ...item }) => item);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
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

    // Helper function to format status (remove underscores, convert to camelCase)
    const formatStatus = (status: string): string => {
      return status.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    };

    // Build payment history - exclude only cancelled invoices that were never paid
    const paymentHistory: PaymentHistoryItemDto[] = (subscription.invoices || [])
      .filter((invoice) => {
        // Exclude cancelled invoices only if they were never paid
        if (invoice.paymentStatus === InvoiceStatus.CANCELLED && !invoice.paidAt) {
          return false;
        }
        return true;
      })
      .map((invoice) => ({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.totalAmount / 100, // Convert from paise to Rs
        paymentDate: invoice.paidAt ? toIST(invoice.paidAt) : null,
        paymentStatus: formatStatus(invoice.paymentStatus),
        razorpayPaymentId: invoice.razorpayPaymentId,
      }));

    // Get last payment date
    const lastPaymentDate = paidInvoices.length > 0
      ? toIST(paidInvoices.sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())[0].paidAt)
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
      subscriptionStatus: formatStatus(subscription.status),
      // Check autoRenew flag to identify autopay vs monthly
      // autoRenew: true = autopay (automatic recurring payments)
      // autoRenew: false = monthly (manual/one-time payments)
      paymentType: subscription.autoRenew ? 'autopay' : 'monthly',
      razorpaySubscriptionId: subscription.razorpaySubscriptionId,
      subscriptionStartDate: toIST(subscription.startDate),
      subscriptionEndDate: toIST(subscription.currentPeriodEnd),
      usageMonths,
      totalAmount,
      amountPerMonth: subscription.subscriptionAmount / 100,
      isAutoRenew: subscription.autoRenew,
      nextBillingDate: subscription.nextBillingDate ? toIST(subscription.nextBillingDate) : null,
      lastPaymentDate,
      paymentHistory,
      isPaused: subscription.isPaused || false,
      createdAt: toIST(subscription.createdAt),
      updatedAt: toIST(subscription.updatedAt),
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
    dto: AdminCancelSubscriptionDto,
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
   * Cancel pending payment subscription for a specific influencer
   * This is useful for cleaning up orphaned payment_pending subscriptions
   * that were created with old/invalid payment gateway configurations
   */
  async cancelPendingSubscription(influencerId: number, reason?: string) {
    const subscription = await this.proSubscriptionModel.findOne({
      where: {
        influencerId,
        status: SubscriptionStatus.PAYMENT_PENDING,
      },
      include: [
        {
          model: ProInvoice,
          as: 'invoices',
          where: { paymentStatus: InvoiceStatus.PENDING },
          required: false,
        },
      ],
    });

    if (!subscription) {
      throw new NotFoundException('No pending subscription found for this influencer');
    }

    // Update subscription to cancelled
    // Set currentPeriodEnd to now to ensure isPro becomes false immediately
    await subscription.update({
      status: SubscriptionStatus.CANCELLED,
      cancelledAt: createDatabaseDate(),
      currentPeriodEnd: createDatabaseDate(),
      cancelReason: reason || 'Pending payment cancelled - gateway configuration issue',
    });

    // Cancel any pending invoices
    if (subscription.invoices && subscription.invoices.length > 0) {
      await this.proInvoiceModel.update(
        {
          paymentStatus: InvoiceStatus.CANCELLED,
          updatedAt: createDatabaseDate(),
        },
        {
          where: {
            subscriptionId: subscription.id,
            paymentStatus: InvoiceStatus.PENDING,
          },
        },
      );
    }

    console.log(`✅ Cancelled pending subscription ${subscription.id} for influencer ${influencerId}`);

    return {
      success: true,
      message: 'Pending subscription cancelled successfully. You can now create a new subscription.',
      cancelledSubscriptionId: subscription.id,
    };
  }

  /**
   * Clean up old stale pending subscriptions (older than specified hours)
   * Useful for batch cleanup of orphaned subscriptions
   */
  async cleanupStalePendingSubscriptions(olderThanHours: number = 24) {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - olderThanHours);

    const staleSubscriptions = await this.proSubscriptionModel.findAll({
      where: {
        status: SubscriptionStatus.PAYMENT_PENDING,
        createdAt: {
          [Op.lt]: cutoffDate,
        },
      },
    });

    const cancelledCount = staleSubscriptions.length;

    for (const subscription of staleSubscriptions) {
      await subscription.update({
        status: SubscriptionStatus.CANCELLED,
        cancelledAt: createDatabaseDate(),
        currentPeriodEnd: createDatabaseDate(),
        cancelReason: `Auto-cancelled: Payment pending for more than ${olderThanHours} hours`,
      });

      // Cancel related pending invoices
      await this.proInvoiceModel.update(
        {
          paymentStatus: InvoiceStatus.CANCELLED,
          updatedAt: createDatabaseDate(),
        },
        {
          where: {
            subscriptionId: subscription.id,
            paymentStatus: InvoiceStatus.PENDING,
          },
        },
      );
    }

    console.log(`🧹 Cleaned up ${cancelledCount} stale pending subscriptions older than ${olderThanHours} hours`);

    return {
      success: true,
      message: `Cleaned up ${cancelledCount} stale pending subscription(s)`,
      cancelledCount,
    };
  }

  /**
   * Fix missing invoices and subscription status for a given subscription
   * This method:
   * 1. Identifies missing invoices by checking gaps in billing periods
   * 2. Creates missing invoice records with proper billing periods
   * 3. Generates PDF invoices and uploads to S3
   * 4. Updates subscription status to 'active' if period is still valid
   */
  async fixMissingInvoice(subscriptionId: number): Promise<FixMissingInvoiceResponseDto> {
    // Fetch subscription with all related data
    const subscription = await this.proSubscriptionModel.findByPk(subscriptionId, {
      include: [
        {
          model: Influencer,
          as: 'influencer',
          include: [
            {
              model: this.cityModel,
              as: 'city',
            },
          ],
        },
        {
          model: ProInvoice,
          as: 'invoices',
          where: { paymentStatus: InvoiceStatus.PAID },
          required: false,
          order: [['billingPeriodEnd', 'DESC']],
        },
      ],
    });

    if (!subscription) {
      throw new NotFoundException(`Subscription with ID ${subscriptionId} not found`);
    }

    const influencer = subscription.influencer;
    const previousStatus = subscription.status;
    const createdInvoices: Array<{
      invoiceId: number;
      invoiceNumber: string;
      amount: number;
      billingPeriod: string;
      pdfUrl: string | null;
    }> = [];

    // Get existing paid invoices, sorted by billing period
    const existingInvoices = (subscription.invoices || [])
      .sort((a, b) => new Date(a.billingPeriodEnd).getTime() - new Date(b.billingPeriodEnd).getTime());

    // Find gaps in billing periods
    const missingPeriods: Array<{ start: Date; end: Date }> = [];

    if (existingInvoices.length === 0) {
      // No invoices exist - shouldn't happen, but handle it
      throw new BadRequestException('No existing invoices found for this subscription');
    }

    // Check if there's a gap between the last invoice and current period end
    const lastInvoice = existingInvoices[existingInvoices.length - 1];
    const lastInvoiceEnd = new Date(lastInvoice.billingPeriodEnd);
    const currentPeriodEnd = new Date(subscription.currentPeriodEnd);

    // If subscription extends beyond last invoice, we have missing period(s)
    if (currentPeriodEnd > lastInvoiceEnd) {
      // Calculate missing period - from last invoice end to current period end
      const periodStart = new Date(lastInvoiceEnd);
      periodStart.setSeconds(periodStart.getSeconds() + 1); // Start 1 second after last invoice ends

      // For simplicity, create one invoice for the missing period
      // In reality, this should match the subscription's billing cycle
      missingPeriods.push({
        start: subscription.currentPeriodStart ? new Date(subscription.currentPeriodStart) : periodStart,
        end: currentPeriodEnd,
      });
    }

    if (missingPeriods.length === 0) {
      throw new BadRequestException('No missing invoices detected for this subscription');
    }

    // Create missing invoices
    for (const period of missingPeriods) {
      // Calculate taxes based on influencer's city
      const cityName = influencer.city?.name?.toLowerCase() || '';
      const isDelhi = cityName === 'delhi' || cityName === 'new delhi';

      const baseAmount = 16864; // Rs 168.64 in paise
      const taxAmount = 3035;   // Rs 30.35 in paise (18% GST)
      const totalAmount = 19900; // Rs 199.00 in paise

      let cgst = 0;
      let sgst = 0;
      let igst = 0;

      if (isDelhi) {
        cgst = 1518;  // Rs 15.18 (9% CGST)
        sgst = 1517;  // Rs 15.17 (9% SGST)
        igst = 0;
      } else {
        cgst = 0;
        sgst = 0;
        igst = 3035;  // Rs 30.35 (18% IGST)
      }

      // Generate next invoice number
      const currentYear = new Date().getFullYear();
      const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
      const currentPrefix = `MAXXINV-${currentYear}${currentMonth}-`;

      const existingInvoiceNumbers = await this.proInvoiceModel.findAll({
        where: {
          influencerId: subscription.influencerId,
          invoiceNumber: {
            [Op.like]: `${currentPrefix}%`,
          },
        },
        attributes: ['invoiceNumber'],
      });

      let nextNumber = 1;
      for (const inv of existingInvoiceNumbers) {
        const parts = inv.invoiceNumber.split('-');
        const num = parseInt(parts[2], 10);
        if (!isNaN(num)) {
          nextNumber = Math.max(nextNumber, num + 1);
        }
      }

      const invoiceNumber = `${currentPrefix}${String(nextNumber).padStart(2, '0')}`;

      // Create invoice record
      const newInvoice = await this.proInvoiceModel.create({
        invoiceNumber,
        subscriptionId: subscription.id,
        influencerId: subscription.influencerId,
        amount: baseAmount,
        tax: taxAmount,
        cgst,
        sgst,
        igst,
        totalAmount,
        billingPeriodStart: period.start,
        billingPeriodEnd: period.end,
        paymentStatus: InvoiceStatus.PAID,
        paymentMethod: PaymentMethod.RAZORPAY,
        razorpayPaymentId: subscription.razorpaySubscriptionId || `admin_fix_${Date.now()}`,
        razorpayOrderId: null,
        paidAt: createDatabaseDate(),
        createdAt: createDatabaseDate(),
        updatedAt: createDatabaseDate(),
      });

      console.log(`✅ Created missing invoice ${invoiceNumber} for subscription ${subscriptionId}`);

      // Generate PDF and upload to S3
      let pdfUrl: string | null = null;
      try {
        await this.proSubscriptionService.generateInvoicePDF(newInvoice.id);

        // Fetch updated invoice to get PDF URL
        const updatedInvoice = await this.proInvoiceModel.findByPk(newInvoice.id);
        pdfUrl = updatedInvoice?.invoiceUrl || null;

        console.log(`📄 Generated PDF for invoice ${invoiceNumber}`);
      } catch (pdfError) {
        console.error(`Failed to generate PDF for invoice ${invoiceNumber}:`, pdfError);
      }

      // Add to created invoices list
      createdInvoices.push({
        invoiceId: newInvoice.id,
        invoiceNumber: newInvoice.invoiceNumber,
        amount: totalAmount / 100,
        billingPeriod: `${period.start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} - ${period.end.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`,
        pdfUrl,
      });
    }

    // Fix subscription status if needed
    let statusFixed = false;
    const now = new Date();
    if (subscription.currentPeriodEnd > now && subscription.status !== SubscriptionStatus.ACTIVE) {
      await subscription.update({
        status: SubscriptionStatus.ACTIVE,
        updatedAt: createDatabaseDate(),
      });
      statusFixed = true;
      console.log(`✅ Updated subscription ${subscriptionId} status to 'active'`);
    }

    const currentStatus = statusFixed ? SubscriptionStatus.ACTIVE : subscription.status;

    return {
      success: true,
      message: `Successfully fixed subscription ${subscriptionId}: Created ${createdInvoices.length} missing invoice(s)${statusFixed ? ', updated subscription status to active' : ''}`,
      details: {
        subscriptionId: subscription.id,
        influencerId: subscription.influencerId,
        influencerName: influencer.name,
        previousStatus,
        currentStatus,
        createdInvoices,
        subscriptionUpdated: true,
        statusFixed,
      },
      timestamp: new Date(),
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
