import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, fn, col, literal } from 'sequelize';
import { Influencer } from '../../auth/model/influencer.model';
import { InfluencerReferralUsage } from '../../auth/model/influencer-referral-usage.model';
import { CreditTransaction } from '../models/credit-transaction.model';
import { City } from '../../shared/models/city.model';
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
  ) {}

  /**
   * Get referral program statistics with month-over-month growth
   */
  async getReferralStatistics(): Promise<ReferralProgramStatisticsDto> {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    // 1. Total Referral Codes Generated (influencers with referral codes)
    const totalReferralCodes = await this.influencerModel.count({
      where: {
        referralCode: {
          [Op.ne]: null,
        },
      },
    });

    const lastMonthReferralCodes = await this.influencerModel.count({
      where: {
        referralCode: {
          [Op.ne]: null,
        },
        createdAt: {
          [Op.lt]: currentMonthStart,
        },
      },
    });

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

    // 3. Amount Spent in Referral (total paid/processing transactions)
    const amountSpentResult = await this.creditTransactionModel.findOne({
      attributes: [[fn('SUM', col('amount')), 'total']],
      where: {
        transactionType: 'referral_bonus',
        paymentStatus: {
          [Op.in]: ['paid', 'processing'],
        },
      },
      raw: true,
    });

    const totalAmountSpent = Number(amountSpentResult?.['total'] || 0);

    const lastMonthAmountSpentResult = await this.creditTransactionModel.findOne({
      attributes: [[fn('SUM', col('amount')), 'total']],
      where: {
        transactionType: 'referral_bonus',
        paymentStatus: {
          [Op.in]: ['paid', 'processing'],
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

    // 4. Redeem Requests Raised (pending + processing transactions)
    const redeemRequests = await this.creditTransactionModel.count({
      where: {
        transactionType: 'referral_bonus',
        paymentStatus: {
          [Op.in]: ['pending', 'processing'],
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
      attributes: ['id', 'username', 'referralCode'],
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

    // Build where clause for influencers with referral codes
    const whereClause: any = {
      referralCode: {
        [Op.ne]: null,
      },
    };

    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { username: { [Op.iLike]: `%${search}%` } },
        { referralCode: { [Op.iLike]: `%${search}%` } },
      ];
    }

    // Get influencers with referral codes
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
          fn(
            'SUM',
            literal(
              `CASE WHEN "paymentStatus" IN ('paid', 'processing') THEN amount ELSE 0 END`,
            ),
          ),
          'totalEarnings',
        ],
        [
          fn(
            'SUM',
            literal(`CASE WHEN "paymentStatus" = 'paid' THEN amount ELSE 0 END`),
          ),
          'redeemed',
        ],
        [
          fn(
            'SUM',
            literal(
              `CASE WHEN "paymentStatus" IN ('pending', 'processing') THEN amount ELSE 0 END`,
            ),
          ),
          'pending',
        ],
      ],
      where: {
        influencerId: { [Op.in]: influencerIds },
        transactionType: 'referral_bonus',
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
    const whereClause: any = {
      transactionType: 'referral_bonus',
    };

    if (paymentStatus) {
      whereClause.paymentStatus = paymentStatus;
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
            attributes: ['id', 'name', 'username', 'referralCode'],
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
        upiId: transaction.upiId,
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
