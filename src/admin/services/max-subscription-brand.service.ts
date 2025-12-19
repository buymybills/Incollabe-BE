import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { MaxCampaignInvoice, InvoiceStatus } from '../../campaign/models/max-campaign-invoice.model';
import { Campaign } from '../../campaign/models/campaign.model';
import { Brand } from '../../brand/model/brand.model';
import {
  MaxSubscriptionBrandStatisticsDto,
  GetMaxPurchasesDto,
  MaxPurchasesResponseDto,
  MaxPurchaseItemDto,
  MaxPurchaseTypeFilter,
  MaxCampaignStatusFilter,
} from '../dto/max-subscription-brand.dto';

@Injectable()
export class MaxSubscriptionBrandService {
  constructor(
    @InjectModel(MaxCampaignInvoice)
    private readonly maxCampaignInvoiceModel: typeof MaxCampaignInvoice,
  ) {}

  /**
   * Get Max Subscription Brand statistics with month-over-month growth
   */
  async getStatistics(): Promise<MaxSubscriptionBrandStatisticsDto> {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // 1. Total Maxx Profile (all paid max campaign invoices)
    const totalMaxxProfile = await this.maxCampaignInvoiceModel.count({
      where: {
        paymentStatus: InvoiceStatus.PAID,
      },
    });

    const lastMonthTotalMaxxProfile = await this.maxCampaignInvoiceModel.count({
      where: {
        paymentStatus: InvoiceStatus.PAID,
        createdAt: {
          [Op.lt]: currentMonthStart,
        },
      },
    });

    const totalMaxxProfileGrowth = this.calculateGrowth(
      totalMaxxProfile,
      lastMonthTotalMaxxProfile,
    );

    // 2. Active Maxx Profiles (campaigns that are active)
    const activeMaxxProfiles = await this.maxCampaignInvoiceModel.count({
      where: {
        paymentStatus: InvoiceStatus.PAID,
      },
      include: [
        {
          model: Campaign,
          as: 'campaign',
          where: {
            isMaxCampaign: true,
            status: 'active',
          },
          required: true,
        },
      ],
    });

    const lastMonthActiveMaxxProfiles = await this.maxCampaignInvoiceModel.count({
      where: {
        paymentStatus: InvoiceStatus.PAID,
        createdAt: {
          [Op.lt]: currentMonthStart,
        },
      },
      include: [
        {
          model: Campaign,
          as: 'campaign',
          where: {
            isMaxCampaign: true,
            status: 'active',
          },
          required: true,
        },
      ],
    });

    const activeMaxxProfilesGrowth = this.calculateGrowth(
      activeMaxxProfiles,
      lastMonthActiveMaxxProfiles,
    );

    // 3. Inactive Maxx Profiles (campaigns that are completed/paused)
    const inactiveMaxxProfiles = await this.maxCampaignInvoiceModel.count({
      where: {
        paymentStatus: InvoiceStatus.PAID,
      },
      include: [
        {
          model: Campaign,
          as: 'campaign',
          where: {
            isMaxCampaign: true,
            status: {
              [Op.in]: ['completed', 'paused'],
            },
          },
          required: true,
        },
      ],
    });

    const lastMonthInactiveMaxxProfiles = await this.maxCampaignInvoiceModel.count({
      where: {
        paymentStatus: InvoiceStatus.PAID,
        createdAt: {
          [Op.lt]: currentMonthStart,
        },
      },
      include: [
        {
          model: Campaign,
          as: 'campaign',
          where: {
            isMaxCampaign: true,
            status: {
              [Op.in]: ['completed', 'paused'],
            },
          },
          required: true,
        },
      ],
    });

    const inactiveMaxxProfilesGrowth = this.calculateGrowth(
      inactiveMaxxProfiles,
      lastMonthInactiveMaxxProfiles,
    );

    // 4. Subscription Cancelled (campaigns that are cancelled)
    const subscriptionCancelled = await this.maxCampaignInvoiceModel.count({
      where: {
        paymentStatus: InvoiceStatus.PAID,
      },
      include: [
        {
          model: Campaign,
          as: 'campaign',
          where: {
            isMaxCampaign: true,
            status: 'cancelled',
          },
          required: true,
        },
      ],
    });

    const lastMonthSubscriptionCancelled = await this.maxCampaignInvoiceModel.count({
      where: {
        paymentStatus: InvoiceStatus.PAID,
        createdAt: {
          [Op.lt]: currentMonthStart,
        },
      },
      include: [
        {
          model: Campaign,
          as: 'campaign',
          where: {
            isMaxCampaign: true,
            status: 'cancelled',
          },
          required: true,
        },
      ],
    });

    const subscriptionCancelledGrowth = this.calculateGrowth(
      subscriptionCancelled,
      lastMonthSubscriptionCancelled,
    );

    return {
      totalMaxxProfile,
      totalMaxxProfileGrowth,
      activeMaxxProfiles,
      activeMaxxProfilesGrowth,
      inactiveMaxxProfiles,
      inactiveMaxxProfilesGrowth,
      subscriptionCancelled,
      subscriptionCancelledGrowth,
    };
  }

  /**
   * Get paginated list of max campaign purchases with filters
   */
  async getMaxPurchases(
    filters: GetMaxPurchasesDto,
  ): Promise<MaxPurchasesResponseDto> {
    const {
      page = 1,
      limit = 20,
      purchaseType,
      status,
      search,
      startDate,
      endDate,
      paymentMethod,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = filters;

    const offset = (page - 1) * limit;

    // Build where clause for invoices
    const invoiceWhereClause: any = {
      paymentStatus: InvoiceStatus.PAID,
    };

    // Date filtering
    if (startDate || endDate) {
      invoiceWhereClause.paidAt = {};
      if (startDate) {
        invoiceWhereClause.paidAt[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        invoiceWhereClause.paidAt[Op.lte] = endDateTime;
      }
    }

    // Payment method filter
    if (paymentMethod && paymentMethod !== 'all') {
      if (paymentMethod === 'upi') {
        invoiceWhereClause.paymentMethod = { [Op.iLike]: '%upi%' };
      } else if (paymentMethod === 'credit_card') {
        invoiceWhereClause.paymentMethod = { [Op.or]: [
          { [Op.iLike]: '%card%' },
          { [Op.iLike]: '%credit%' },
        ]};
      } else if (paymentMethod === 'razorpay') {
        invoiceWhereClause.paymentMethod = { [Op.iLike]: '%razorpay%' };
      }
    }

    // Build where clause for campaigns
    const campaignWhereClause: any = {
      isMaxCampaign: true,
    };

    // Status filter
    if (status && status !== MaxCampaignStatusFilter.ALL) {
      if (status === MaxCampaignStatusFilter.ACTIVE) {
        campaignWhereClause.status = 'active';
      } else if (status === MaxCampaignStatusFilter.INACTIVE) {
        campaignWhereClause.status = {
          [Op.in]: ['completed', 'paused'],
        };
      } else if (status === MaxCampaignStatusFilter.CANCELLED) {
        campaignWhereClause.status = 'cancelled';
      }
    }

    // Purchase type filter (for tabs)
    // Note: This would need a field in campaign to distinguish between invite and direct purchase
    // For now, we'll assume campaigns created via invite have a specific field
    if (purchaseType && purchaseType !== MaxPurchaseTypeFilter.ALL) {
      if (purchaseType === MaxPurchaseTypeFilter.INVITE_CAMPAIGN) {
        // Assuming there's a field like 'createdViaInvite' or similar
        // campaignWhereClause.createdViaInvite = true;
        // TODO: Add proper field check once confirmed
      } else if (purchaseType === MaxPurchaseTypeFilter.MAXX_CAMPAIGN) {
        // campaignWhereClause.createdViaInvite = false;
        // TODO: Add proper field check once confirmed
      }
    }

    // Build where clause for brands and campaigns (search)
    // Apply search to brand OR campaign name
    const brandWhereClause: any = {};
    if (search) {
      // Add campaign name to the brand search OR condition
      // This searches across brand name, username, OR campaign name
      brandWhereClause[Op.or] = [
        { brandName: { [Op.iLike]: `%${search}%` } },
        { username: { [Op.iLike]: `%${search}%` } },
      ];
      // Also add campaign name search to campaign where clause
      campaignWhereClause[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
      ];
    }

    // Determine sort field
    const orderField = sortBy === 'amount' ? 'amount' : 'paidAt';

    // Get invoices with related campaign and brand details
    const { count, rows: invoices } =
      await this.maxCampaignInvoiceModel.findAndCountAll({
        where: invoiceWhereClause,
        include: [
          {
            model: Campaign,
            as: 'campaign',
            where: Object.keys(campaignWhereClause).length > 0
              ? campaignWhereClause
              : undefined,
            attributes: ['id', 'name', 'status', 'createdAt'],
            required: true,
          },
          {
            model: Brand,
            as: 'brand',
            where: Object.keys(brandWhereClause).length > 0
              ? brandWhereClause
              : undefined,
            attributes: ['id', 'brandName', 'username'],
            required: true,
          },
        ],
        limit,
        offset,
        order: [[orderField, sortOrder]],
      });

    // Build response data
    const data: MaxPurchaseItemDto[] = invoices.map((invoice) => {
      const campaign = invoice.campaign;
      const brand = invoice.brand;

      // Format date as "HH:MM AM/PM | MMM DD, YYYY"
      const purchaseDate = new Date(invoice.paidAt);
      const time = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).format(purchaseDate);

      const date = new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
      }).format(purchaseDate);

      const purchaseDateTime = `${time} | ${date}`;

      // Determine maxx type (you may need to adjust this based on actual field)
      // TODO: Update this logic based on how you distinguish invite vs direct purchase
      const maxxType = 'Maxx Campaign'; // or 'Invite Campaign'

      return {
        id: invoice.id,
        campaignId: campaign.id,
        brandName: brand.brandName,
        username: `@${brand.username}`,
        campaignName: campaign.name,
        maxxType,
        amount: invoice.amount / 100, // Convert from paise to Rs
        purchaseDateTime,
        status: campaign.status,
        invoiceNumber: invoice.invoiceNumber,
        paymentMethod: invoice.paymentMethod || 'razorpay',
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
