import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { MaxxSubscriptionAdminService } from './maxx-subscription-admin.service';
import { MaxSubscriptionBrandService } from './max-subscription-brand.service';
import { ProSubscription } from '../../influencer/models/pro-subscription.model';
import { ProInvoice } from '../../influencer/models/pro-invoice.model';
import { MaxCampaignInvoice } from '../../campaign/models/max-campaign-invoice.model';
import {
  MaxSubscriptionInvoiceStatisticsDto,
  GetMaxSubscriptionInvoicesDto,
  MaxSubscriptionInvoicesResponseDto,
  MaxSubscriptionInvoiceItemDto,
  InvoiceTypeFilter,
} from '../dto/max-subscription-invoice.dto';
import { MaxPurchaseTypeFilter } from '../dto/max-subscription-brand.dto';

@Injectable()
export class MaxSubscriptionInvoiceService {
  constructor(
    @InjectModel(ProSubscription)
    private readonly proSubscriptionModel: typeof ProSubscription,
    @InjectModel(ProInvoice)
    private readonly proInvoiceModel: typeof ProInvoice,
    @InjectModel(MaxCampaignInvoice)
    private readonly maxCampaignInvoiceModel: typeof MaxCampaignInvoice,
    private readonly maxxSubscriptionAdminService: MaxxSubscriptionAdminService,
    private readonly maxSubscriptionBrandService: MaxSubscriptionBrandService,
  ) {}

  /**
   * Get unified statistics combining influencer subscriptions and brand campaigns
   */
  async getUnifiedStatistics(): Promise<MaxSubscriptionInvoiceStatisticsDto> {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get influencer Pro subscription stats
    const influencerStats = await this.maxxSubscriptionAdminService.getMaxxSubscriptionStatistics();

    // Get brand max campaign stats
    const brandStats = await this.maxSubscriptionBrandService.getStatistics();

    // Calculate totals
    const totalMaxxPurchased =
      influencerStats.activeMaxxProfiles +
      brandStats.totalMaxxProfile;

    // Calculate last month totals for growth
    const lastMonthInfluencerCount = await this.proSubscriptionModel.count({
      where: {
        status: 'active',
        createdAt: {
          [Op.lt]: currentMonthStart,
        },
      },
    });

    const lastMonthBrandCount = await this.maxCampaignInvoiceModel.count({
      where: {
        paymentStatus: 'paid',
        createdAt: {
          [Op.lt]: currentMonthStart,
        },
      },
    });

    const lastMonthTotal = lastMonthInfluencerCount + lastMonthBrandCount;
    const totalMaxxPurchasedGrowth = this.calculateGrowth(totalMaxxPurchased, lastMonthTotal);

    // Get brand campaign type counts
    const inviteCampaignCount = await this.getBrandCampaignCountByType('invite_campaign');
    const maxxCampaignCount = await this.getBrandCampaignCountByType('maxx_campaign');

    // Calculate growth for each type
    const lastMonthInviteCampaign = await this.getBrandCampaignCountByType('invite_campaign', currentMonthStart);
    const lastMonthMaxxCampaign = await this.getBrandCampaignCountByType('maxx_campaign', currentMonthStart);

    return {
      totalMaxxPurchased,
      totalMaxxPurchasedGrowth,
      maxxSubscription: influencerStats.activeMaxxProfiles,
      maxxSubscriptionGrowth: influencerStats.activeMaxxProfilesGrowth || 0,
      inviteCampaign: inviteCampaignCount,
      inviteCampaignGrowth: this.calculateGrowth(inviteCampaignCount, lastMonthInviteCampaign),
      maxxCampaign: maxxCampaignCount,
      maxxCampaignGrowth: this.calculateGrowth(maxxCampaignCount, lastMonthMaxxCampaign),
    };
  }

  /**
   * Get unified list of invoices from both influencer subscriptions and brand campaigns
   */
  async getUnifiedInvoices(
    filters: GetMaxSubscriptionInvoicesDto,
  ): Promise<MaxSubscriptionInvoicesResponseDto> {
    const {
      page = 1,
      limit = 20,
      invoiceType,
      search,
      startDate,
      endDate,
      profileType,
      paymentMethod,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = filters;

    let influencerInvoices: MaxSubscriptionInvoiceItemDto[] = [];
    let brandInvoices: MaxSubscriptionInvoiceItemDto[] = [];

    // Fetch influencer subscription invoices if needed
    // Skip if profileType filter is set to 'brand' only
    const shouldFetchInfluencerInvoices =
      (!invoiceType || invoiceType === InvoiceTypeFilter.ALL || invoiceType === InvoiceTypeFilter.MAXX_SUBSCRIPTION) &&
      (!profileType || profileType === 'all' || profileType === 'influencer');

    if (shouldFetchInfluencerInvoices) {
      influencerInvoices = await this.getInfluencerSubscriptionInvoices(search, startDate, endDate, paymentMethod);
    }

    // Fetch brand campaign invoices if needed
    // Skip if profileType filter is set to 'influencer' only
    const shouldFetchBrandInvoices =
      (!invoiceType || invoiceType === InvoiceTypeFilter.ALL ||
        invoiceType === InvoiceTypeFilter.INVITE_CAMPAIGN ||
        invoiceType === InvoiceTypeFilter.MAXX_CAMPAIGN) &&
      (!profileType || profileType === 'all' || profileType === 'brand');

    if (shouldFetchBrandInvoices) {
      brandInvoices = await this.getBrandCampaignInvoices(search, startDate, endDate, invoiceType, paymentMethod);
    }

    // Combine and sort all invoices
    let allInvoices = [...influencerInvoices, ...brandInvoices];

    // Sort by specified field
    allInvoices.sort((a, b) => {
      if (sortBy === 'amount') {
        return sortOrder === 'ASC' ? a.amount - b.amount : b.amount - a.amount;
      }
      // Sort by date (parse purchaseDateTime)
      const dateA = new Date(a.purchaseDateTime);
      const dateB = new Date(b.purchaseDateTime);
      return sortOrder === 'ASC' ? dateA.getTime() - dateB.getTime() : dateB.getTime() - dateA.getTime();
    });

    // Paginate
    const total = allInvoices.length;
    const offset = (page - 1) * limit;
    const paginatedInvoices = allInvoices.slice(offset, offset + limit);

    return {
      data: paginatedInvoices,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get influencer Pro subscription invoices
   */
  private async getInfluencerSubscriptionInvoices(
    search?: string,
    startDate?: string,
    endDate?: string,
    paymentMethod?: string,
  ): Promise<MaxSubscriptionInvoiceItemDto[]> {
    const whereClause: any = {
      paymentStatus: 'paid',
    };

    // Payment method filter
    if (paymentMethod && paymentMethod !== 'all') {
      if (paymentMethod === 'upi') {
        whereClause.paymentMethod = { [Op.iLike]: '%upi%' };
      } else if (paymentMethod === 'credit_card') {
        whereClause.paymentMethod = { [Op.or]: [
          { [Op.iLike]: '%card%' },
          { [Op.iLike]: '%credit%' },
        ]};
      } else if (paymentMethod === 'razorpay') {
        whereClause.paymentMethod = { [Op.iLike]: '%razorpay%' };
      }
    }

    // Date filtering
    if (startDate || endDate) {
      whereClause.paidAt = {};
      if (startDate) {
        whereClause.paidAt[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        whereClause.paidAt[Op.lte] = endDateTime;
      }
    }

    const invoices = await this.proInvoiceModel.findAll({
      where: whereClause,
      include: [
        {
          association: 'subscription',
          required: true,
          include: [
            {
              association: 'influencer',
              required: true,
              where: search
                ? {
                    [Op.or]: [
                      { name: { [Op.iLike]: `%${search}%` } },
                      { username: { [Op.iLike]: `%${search}%` } },
                    ],
                  }
                : undefined,
            },
          ],
        },
      ],
      order: [['paidAt', 'DESC']],
    });

    return invoices
      .filter((invoice) => invoice.subscription?.influencer)
      .map((invoice) => {
        const influencer = invoice.subscription.influencer;
        const paidAt = new Date(invoice.paidAt);

        const time = new Intl.DateTimeFormat('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        }).format(paidAt);

        const date = new Intl.DateTimeFormat('en-US', {
          month: 'short',
          day: '2-digit',
          year: 'numeric',
        }).format(paidAt);

        return {
          id: invoice.id,
          profileName: influencer.name,
          username: `@${influencer.username}`,
          profileType: 'Influencer',
          maxxType: 'Subscription',
          amount: invoice.amount / 100, // Convert from paise to Rs
          transactionId: invoice.razorpayPaymentId || invoice.invoiceNumber,
          paymentMethod: this.formatPaymentMethod(invoice.paymentMethod),
          purchaseDateTime: `${time} | ${date}`,
        };
      });
  }

  /**
   * Get brand Max campaign invoices
   */
  private async getBrandCampaignInvoices(
    search?: string,
    startDate?: string,
    endDate?: string,
    invoiceType?: InvoiceTypeFilter,
    paymentMethod?: string,
  ): Promise<MaxSubscriptionInvoiceItemDto[]> {
    const result = await this.maxSubscriptionBrandService.getMaxPurchases({
      page: 1,
      limit: 10000, // Get all for now, we'll paginate later
      search,
      startDate,
      endDate,
      purchaseType: invoiceType === InvoiceTypeFilter.INVITE_CAMPAIGN ? MaxPurchaseTypeFilter.INVITE_CAMPAIGN :
                     invoiceType === InvoiceTypeFilter.MAXX_CAMPAIGN ? MaxPurchaseTypeFilter.MAXX_CAMPAIGN : MaxPurchaseTypeFilter.ALL,
      paymentMethod,
    });

    return result.data.map((item) => ({
      id: item.id,
      profileName: item.brandName,
      username: item.username,
      profileType: 'Brand',
      maxxType: item.maxxType,
      amount: item.amount,
      transactionId: item.invoiceNumber,
      paymentMethod: this.formatPaymentMethod(item.paymentMethod),
      purchaseDateTime: item.purchaseDateTime,
      campaignId: item.campaignId,
      campaignName: item.campaignName,
    }));
  }

  /**
   * Get count of brand campaigns by type
   */
  private async getBrandCampaignCountByType(
    type: 'invite_campaign' | 'maxx_campaign',
    beforeDate?: Date,
  ): Promise<number> {
    // This is a placeholder - you'll need to add a field to distinguish campaign types
    // For now, returning mock data
    const whereClause: any = {
      paymentStatus: 'paid',
    };

    if (beforeDate) {
      whereClause.createdAt = {
        [Op.lt]: beforeDate,
      };
    }

    // TODO: Add proper filtering by campaign type once the field is added to the model
    const count = await this.maxCampaignInvoiceModel.count({
      where: whereClause,
    });

    // Mock distribution - you'll need to update this with actual logic
    return type === 'invite_campaign' ? Math.floor(count * 0.5) : Math.floor(count * 0.5);
  }

  /**
   * Format payment method for display
   */
  private formatPaymentMethod(method: string): string {
    if (!method) return 'Credit Card';
    if (method.toLowerCase().includes('upi')) return 'UPI Transfer';
    if (method.toLowerCase().includes('razorpay')) return 'Credit Card';
    return method;
  }

  /**
   * Calculate growth percentage
   */
  private calculateGrowth(current: number, previous: number): number {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }
    const growth = ((current - previous) / previous) * 100;
    return Math.round(growth * 10) / 10;
  }
}
