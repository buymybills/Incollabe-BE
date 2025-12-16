import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, fn, col, literal } from 'sequelize';
import { Influencer } from '../../auth/model/influencer.model';
import { InfluencerReferralUsage } from '../../auth/model/influencer-referral-usage.model';
import { CreditTransaction, PaymentStatus } from '../models/credit-transaction.model';
import { City } from '../../shared/models/city.model';
import { DeviceTokenService } from '../../shared/device-token.service';
import { FirebaseService } from '../../shared/firebase.service';
import { UserType } from '../../shared/models/device-token.model';
import {
  GetNewAccountsWithReferralDto,
  ProfileStatusFilter,
  NewAccountsWithReferralResponseDto,
  NewAccountWithReferralItemDto,
  GetAccountReferrersDto,
  AccountReferrersResponseDto,
  AccountReferrerItemDto,
  GetReferralTransactionsDto,
  ReferralTransactionsResponseDto,
  ReferralTransactionItemDto,
  ReferralProgramStatisticsDto,
  GetRedemptionRequestsDto,
  RedemptionStatusFilter,
  RedemptionRequestsResponseDto,
  RedemptionRequestItemDto,
  ProcessRedemptionDto,
  ProcessRedemptionResponseDto,
} from '../dto/referral-program.dto';

@Injectable()
export class ReferralProgramService {
  constructor(
    @InjectModel(Influencer)
    private readonly influencerModel: typeof Influencer,
    @InjectModel(InfluencerReferralUsage)
    private readonly referralUsageModel: typeof InfluencerReferralUsage,
    @InjectModel(CreditTransaction)
    private readonly creditTransactionModel: typeof CreditTransaction,
    private readonly deviceTokenService: DeviceTokenService,
    private readonly firebaseService: FirebaseService,
  ) {}

  /**
   * Get referral program statistics with month-over-month growth
   */
  async getReferralStatistics(): Promise<ReferralProgramStatisticsDto> {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    // 1. Total Referral Codes Generated (sum of all invite button clicks)
    const totalReferralCodesResult = await this.influencerModel.findOne({
      attributes: [[fn('SUM', col('referral_invite_click_count')), 'total']],
      where: {
        referralCode: {
          [Op.ne]: null,
        },
      },
      raw: true,
    });

    const totalReferralCodes = Number(totalReferralCodesResult?.['total'] || 0);

    const lastMonthReferralCodesResult = await this.influencerModel.findOne({
      attributes: [[fn('SUM', col('referral_invite_click_count')), 'total']],
      where: {
        referralCode: {
          [Op.ne]: null,
        },
        createdAt: {
          [Op.lt]: currentMonthStart,
        },
      },
      raw: true,
    });

    const lastMonthReferralCodes = Number(lastMonthReferralCodesResult?.['total'] || 0);

    const referralCodesGrowth = this.calculateGrowth(
      totalReferralCodes,
      lastMonthReferralCodes,
    );

    // 2. Accounts Created With Referral (total referral usages)
    const totalAccountsWithReferral = await this.referralUsageModel.count();

    const lastMonthAccountsWithReferral = await this.referralUsageModel.count({
      where: {
        createdAt: {
          [Op.lt]: currentMonthStart,
        },
      },
    });

    const accountsWithReferralGrowth = this.calculateGrowth(
      totalAccountsWithReferral,
      lastMonthAccountsWithReferral,
    );

    // 3. Amount Spent in Referral (total paid transactions only)
    // Exclude consolidated redemption transactions to prevent double-counting
    const amountSpentResult = await this.creditTransactionModel.findOne({
      attributes: [[fn('SUM', col('amount')), 'total']],
      where: {
        transactionType: 'referral_bonus',
        paymentStatus: 'paid',
        description: {
          [Op.notLike]: 'Redemption request%',
        },
      },
      raw: true,
    });

    const totalAmountSpent = Number(amountSpentResult?.['total'] || 0);

    const lastMonthAmountSpentResult = await this.creditTransactionModel.findOne({
      attributes: [[fn('SUM', col('amount')), 'total']],
      where: {
        transactionType: 'referral_bonus',
        paymentStatus: 'paid',
        description: {
          [Op.notLike]: 'Redemption request%',
        },
        paidAt: {
          [Op.lt]: currentMonthStart,
        },
      },
      raw: true,
    });

    const lastMonthAmountSpent = Number(lastMonthAmountSpentResult?.['total'] || 0);

    const amountSpentGrowth = this.calculateGrowth(
      totalAmountSpent,
      lastMonthAmountSpent,
    );

    // 4. Redeem Requests Raised (only consolidated redemption transactions awaiting approval)
    const redeemRequests = await this.creditTransactionModel.count({
      where: {
        transactionType: 'referral_bonus',
        paymentStatus: 'processing',
        description: {
          [Op.like]: 'Redemption request%',
        },
      },
    });

    return {
      totalReferralCodesGenerated: totalReferralCodes,
      totalReferralCodesGeneratedGrowth: referralCodesGrowth,
      accountsCreatedWithReferral: totalAccountsWithReferral,
      accountsCreatedWithReferralGrowth: accountsWithReferralGrowth,
      amountSpentInReferral: totalAmountSpent,
      amountSpentInReferralGrowth: amountSpentGrowth,
      redeemRequestsRaised: redeemRequests,
    };
  }

  /**
   * Get list of new accounts created with referral codes
   */
  async getNewAccountsWithReferral(
    filters: GetNewAccountsWithReferralDto,
  ): Promise<NewAccountsWithReferralResponseDto> {
    const {
      page = 1,
      limit = 20,
      profileStatus,
      search,
      startDate,
      endDate,
    } = filters;

    const offset = (page - 1) * limit;

    // Build where clause for referred influencers
    const whereClause: any = {};

    if (profileStatus && profileStatus !== ProfileStatusFilter.ALL) {
      whereClause.isVerified =
        profileStatus === ProfileStatusFilter.VERIFIED ? true : false;
    }

    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { username: { [Op.iLike]: `%${search}%` } },
      ];
    }

    // Build where clause for referral usage
    const usageWhereClause: any = {};

    if (startDate || endDate) {
      usageWhereClause.createdAt = {};
      if (startDate) {
        usageWhereClause.createdAt[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        usageWhereClause.createdAt[Op.lte] = endDateTime;
      }
    }

    // Get referral usages with referred user details
    const { count, rows: referralUsages } =
      await this.referralUsageModel.findAndCountAll({
        where: usageWhereClause,
        limit,
        offset,
        order: [['createdAt', 'DESC']],
      });

    // Get referred user IDs and referrer user IDs
    const referredUserIds = referralUsages.map((r) => r.referredUserId);
    const referrerCodes = referralUsages.map((r) => r.referralCode);

    // Fetch referred users
    const referredUsers = await this.influencerModel.findAll({
      where: {
        id: { [Op.in]: referredUserIds },
        ...whereClause,
      },
      include: [
        {
          model: City,
          attributes: ['name'],
        },
      ],
    });

    // Fetch referrers
    const referrers = await this.influencerModel.findAll({
      where: {
        referralCode: { [Op.in]: referrerCodes },
      },
      attributes: ['id', 'username', 'referralCode', 
        'referralInviteClickCount'
      ],
    });

    // Create lookup maps
    const referredUsersMap = new Map(referredUsers.map((u) => [u.id, u]));
    const referrersMap = new Map(referrers.map((r) => [r.referralCode, r]));

    // Build response data
    const data: NewAccountWithReferralItemDto[] = referralUsages
      .map((usage) => {
        const referredUser = referredUsersMap.get(usage.referredUserId);
        const referrer = referrersMap.get(usage.referralCode);

        if (!referredUser) return null;

        return {
          id: referredUser.id,
          profileName: referredUser.name,
          username: referredUser.username,
          location: referredUser.city?.name || 'N/A',
          profileStatus: referredUser.isVerified ? 'verified' : 'unverified',
          referredBy: referrer?.username || 'N/A',
          referralCode: usage.referralCode,
          referrerInviteClickCount: referrer?.referralInviteClickCount || 0,
          referralDate: usage.createdAt,
          profileImage: referredUser.profileImage,
        };
      })
      .filter((item) => item !== null) as NewAccountWithReferralItemDto[];

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
   * Get list of influencers who have referred others (account referrers)
   */
  async getAccountReferrers(
    filters: GetAccountReferrersDto,
  ): Promise<AccountReferrersResponseDto> {
    const {
      page = 1,
      limit = 20,
      search,
      sortBy = 'totalReferrals',
      sortOrder = 'DESC',
    } = filters;

    const offset = (page - 1) * limit;

    // First, get all unique referral codes that have been used
    const usedReferralCodes = await this.referralUsageModel.findAll({
      attributes: [[fn('DISTINCT', col('referralCode')), 'referralCode']],
      raw: true,
    });

    const usedCodes = usedReferralCodes.map((r: any) => r.referralCode).filter(Boolean);

    if (usedCodes.length === 0) {
      // No referrals yet, return empty result
      return {
        data: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      };
    }

    // Build where clause for influencers whose referral codes have been used
    const whereClause: any = {
      referralCode: {
        //[Op.ne]: null,
        [Op.in]: usedCodes,
      },
    };

    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { username: { [Op.iLike]: `%${search}%` } },
        { referralCode: { [Op.iLike]: `%${search}%` } },
      ];
    }

    // Get influencers whose referral codes have been used
    const { count, rows: influencers } =
      await this.influencerModel.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: City,
            attributes: ['name'],
          },
        ],
        limit,
        offset,
        order:
          sortBy === 'createdAt'
            ? [['createdAt', sortOrder]]
            : [['id', sortOrder]], // Default ordering, will sort after aggregation
      });

    // Get referral statistics for each influencer
    const influencerIds = influencers.map((i) => i.id);

    // Get total referrals count
    const referralCounts = await this.referralUsageModel.findAll({
      attributes: [
        'influencerId',
        [fn('COUNT', col('id')), 'totalReferrals'],
      ],
      where: {
        influencerId: { [Op.in]: influencerIds },
      },
      group: ['influencerId'],
      raw: true,
    });

    // Get earnings data
    const earningsData = await this.creditTransactionModel.findAll({
      attributes: [
        'influencerId',
        [
          fn('SUM', col('amount')),
          'totalEarnings', // All transactions (pending + processing + paid)
        ],
        [
          fn(
            'SUM',
            literal(
              `CASE WHEN "paymentStatus" IN ('processing', 'paid') THEN amount ELSE 0 END`,
            ),
          ),
          'redeemed', // Amounts that have been redeemed (processing + paid)
        ],
        [
          fn(
            'SUM',
            literal(`CASE WHEN "paymentStatus" = 'pending' THEN amount ELSE 0 END`),
          ),
          'pending', // Only pending amounts (not yet redeemed)
        ],
      ],
      where: {
        influencerId: { [Op.in]: influencerIds },
        transactionType: 'referral_bonus',
        // Exclude consolidated redemption transactions to prevent double-counting
        description: {
          [Op.notLike]: 'Redemption request%',
        },
      },
      group: ['influencerId'],
      raw: true,
    });

    // Create lookup maps
    const referralCountsMap = new Map(
      referralCounts.map((r: any) => [r.influencerId, Number(r.totalReferrals)]),
    );
    const earningsMap = new Map(
      earningsData.map((e: any) => [
        e.influencerId,
        {
          totalEarnings: Number(e.totalEarnings) || 0,
          redeemed: Number(e.redeemed) || 0,
          pending: Number(e.pending) || 0,
        },
      ]),
    );

    // Build response data
    let data: AccountReferrerItemDto[] = influencers.map((influencer) => {
      const totalReferrals = referralCountsMap.get(influencer.id) || 0;
      const earnings = earningsMap.get(influencer.id) || {
        totalEarnings: 0,
        redeemed: 0,
        pending: 0,
      };

      return {
        id: influencer.id,
        profileName: influencer.name,
        username: influencer.username,
        location: influencer.city?.name || 'N/A',
        profileStatus: influencer.isVerified ? 'verified' : 'unverified',
        referralCode: influencer.referralCode || '',
        totalReferrals,
        inviteClickCount: influencer.referralInviteClickCount || 0,
        totalEarnings: earnings.totalEarnings,
        redeemed: earnings.redeemed,
        pending: earnings.pending,
        createdAt: influencer.createdAt,
        profileImage: influencer.profileImage,
      };
    });

    // Sort by custom fields if needed
    if (sortBy === 'totalReferrals') {
      data.sort((a, b) =>
        sortOrder === 'DESC'
          ? b.totalReferrals - a.totalReferrals
          : a.totalReferrals - b.totalReferrals,
      );
    } else if (sortBy === 'totalEarnings') {
      data.sort((a, b) =>
        sortOrder === 'DESC'
          ? b.totalEarnings - a.totalEarnings
          : a.totalEarnings - b.totalEarnings,
      );
    }

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
   * Get referral transaction history
   * Shows only consolidated redemption transactions (actual payouts), not individual credits
   * Only shows processed (paid) transactions by default
   */
  async getReferralTransactions(
    filters: GetReferralTransactionsDto,
  ): Promise<ReferralTransactionsResponseDto> {
    const {
      page = 1,
      limit = 20,
      paymentStatus,
      search,
      startDate,
      endDate,
    } = filters;

    const offset = (page - 1) * limit;

    // Build where clause for transactions
    // Only show consolidated redemption transactions (actual payouts), not individual credits
    const whereClause: any = {
      transactionType: 'referral_bonus',
      description: {
        [Op.like]: 'Redemption request%',
      },
    };

    // Only show processed/paid transactions by default
    // Pending/processing transactions should be viewed in redemption requests
    if (paymentStatus) {
      whereClause.paymentStatus = paymentStatus;
    } else {
      // Default: only show paid (processed) transactions
      whereClause.paymentStatus = PaymentStatus.PAID;
    }

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

    // Build influencer search clause if search is provided
    const influencerWhereClause: any = {};
    if (search) {
      influencerWhereClause[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { username: { [Op.iLike]: `%${search}%` } },
        { referralCode: { [Op.iLike]: `%${search}%` } },
      ];
    }

    // Get transactions with influencer details
    const { count, rows: transactions } =
      await this.creditTransactionModel.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: Influencer,
            as: 'influencer',
            attributes: ['id', 'name', 'username', 'referralCode', 'upiId'],
            where: Object.keys(influencerWhereClause).length > 0
              ? influencerWhereClause
              : undefined,
            required: Object.keys(influencerWhereClause).length > 0,
          },
        ],
        limit,
        offset,
        order: [['createdAt', 'DESC']],
      });

    // Build response data
    const data: ReferralTransactionItemDto[] = transactions.map((transaction) => {
      const influencer = transaction.influencer;

      return {
        id: transaction.id,
        influencerId: transaction.influencerId,
        influencerName: influencer?.name || 'N/A',
        username: influencer?.username || 'N/A',
        referralCode: influencer?.referralCode || 'N/A',
        transactionType: transaction.transactionType,
        amount: transaction.amount,
        paymentStatus: transaction.paymentStatus,
        upiId: influencer?.upiId || transaction.upiId || null,
        paymentReferenceId: transaction.paymentReferenceId,
        createdAt: transaction.createdAt,
        paidAt: transaction.paidAt,
        adminNotes: transaction.adminNotes,
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
   * Get redemption requests with pagination and filtering
   */
  async getRedemptionRequests(
    filters: GetRedemptionRequestsDto,
  ): Promise<RedemptionRequestsResponseDto> {
    const {
      page = 1,
      limit = 20,
      status,
      search,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      startDate,
      endDate,
    } = filters;

    const offset = (page - 1) * limit;

    // Build where clause for transactions
    // Only show consolidated redemption transactions, not individual credit transactions
    const whereClause: any = {
      transactionType: 'referral_bonus',
      description: {
        [Op.like]: 'Redemption request%',
      },
    };

    // Filter by status
    if (status && status !== RedemptionStatusFilter.ALL) {
      whereClause.paymentStatus = status;
    }

    // Date filtering
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

    // Build influencer search clause
    const influencerWhereClause: any = {};
    if (search) {
      influencerWhereClause[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { username: { [Op.iLike]: `%${search}%` } },
      ];
    }

    // Determine sort field
    const orderField = sortBy === 'amount' ? 'amount' : 'createdAt';

    // Get transactions with influencer details
    const { count, rows: transactions } =
      await this.creditTransactionModel.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: Influencer,
            as: 'influencer',
            attributes: ['id', 'name', 'username', 'profileImage', 'upiId'],
            where: Object.keys(influencerWhereClause).length > 0
              ? influencerWhereClause
              : undefined,
            required: true, // Inner join to ensure influencer exists
          },
        ],
        limit,
        offset,
        order: [[orderField, sortOrder]],
      });

    // Build response data
    const data: RedemptionRequestItemDto[] = transactions.map((transaction) => {
      const influencer = transaction.influencer;

      // Format date as "Nov 10, 2025 at 01:23 AM"
      const requestedAt = new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).format(new Date(transaction.createdAt));

      return {
        id: transaction.id,
        influencerId: transaction.influencerId,
        influencerName: influencer?.name || 'N/A',
        username: influencer?.username || 'N/A',
        upiId: influencer?.upiId || transaction.upiId || 'N/A',
        amount: transaction.amount,
        status: transaction.paymentStatus,
        requestedAt,
        profileImage: influencer?.profileImage || null,
        paymentReferenceId: transaction.paymentReferenceId,
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
   * Process a redemption request - mark as paid and send notification
   */
  async processRedemption(
    transactionId: number,
    adminId: number,
    dto: ProcessRedemptionDto,
  ): Promise<ProcessRedemptionResponseDto> {
    // Find the transaction
    const transaction = await this.creditTransactionModel.findOne({
      where: {
        id: transactionId,
        transactionType: 'referral_bonus',
      },
      include: [
        {
          model: Influencer,
          as: 'influencer',
          attributes: ['id', 'name', 'username', 'fcmToken'],
        },
      ],
    });

    if (!transaction) {
      throw new NotFoundException('Redemption request not found');
    }

    // Check if already processed
    if (transaction.paymentStatus === PaymentStatus.PAID) {
      throw new BadRequestException('Redemption request already processed');
    }

    if (transaction.paymentStatus === PaymentStatus.CANCELLED) {
      throw new BadRequestException('Cannot process a cancelled redemption request');
    }

    // Update redemption transaction status to PAID
    const now = new Date();
    await transaction.update({
      paymentStatus: PaymentStatus.PAID,
      processedBy: adminId,
      paidAt: now,
      paymentReferenceId: dto.paymentReferenceId || transaction.paymentReferenceId,
      adminNotes: dto.adminNotes || transaction.adminNotes,
    });

    // Also mark all the underlying credit transactions as PAID
    // Extract transaction IDs from the description (format: "Redemption request for X referral bonuses (IDs: 1, 2, 3)")
    if (transaction.description && transaction.description.includes('IDs:')) {
      try {
        const idsMatch = transaction.description.match(/IDs:\s*([\d,\s]+)\)/);
        if (idsMatch && idsMatch[1]) {
          const creditTransactionIds = idsMatch[1]
            .split(',')
            .map((id) => parseInt(id.trim()))
            .filter((id) => !isNaN(id));

          if (creditTransactionIds.length > 0) {
            await this.creditTransactionModel.update(
              {
                paymentStatus: PaymentStatus.PAID,
                paidAt: now,
              },
              {
                where: {
                  id: { [Op.in]: creditTransactionIds },
                  influencerId: transaction.influencerId,
                },
              },
            );
            console.log(
              `✅ Marked ${creditTransactionIds.length} underlying credit transactions as PAID`,
            );
          }
        }
      } catch (error) {
        console.error('Error updating underlying credit transactions:', error);
        // Don't fail the redemption if this fails
      }
    }

    // Send push notification to the influencer
    try {
      const influencer = transaction.influencer;
      if (influencer) {
        // Get all device tokens for the influencer
        const fcmTokens = await this.deviceTokenService.getAllUserTokens(
          influencer.id,
          UserType.INFLUENCER,
        );

        if (fcmTokens.length > 0) {
          await this.firebaseService.sendNotification(
            fcmTokens,
            'Congratulations! 🎉',
            `Your redemption request of ₹${transaction.amount} has been successfully processed and the amount has been credited to your UPI account.`,
            {
              type: 'redemption_processed',
              transactionId: transaction.id.toString(),
              amount: transaction.amount.toString(),
            },
          );
        }
      }
    } catch (error) {
      console.error('Failed to send redemption notification:', error);
      // Don't fail the entire operation if notification fails
    }

    return {
      success: true,
      message: 'Redemption processed successfully',
      transactionId: transaction.id,
      status: PaymentStatus.PAID,
      processedAt: now,
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
    return Math.round(growth * 10) / 10; // Round to 1 decimal place
  }
}
