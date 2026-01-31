import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import * as XLSX from 'xlsx';
import { ProInvoice } from '../../influencer/models/pro-invoice.model';
import { MaxCampaignInvoice } from '../../campaign/models/max-campaign-invoice.model';
import { InviteOnlyCampaignInvoice } from '../../campaign/models/invite-only-campaign-invoice.model';
import { Influencer } from '../../auth/model/influencer.model';
import { Brand } from '../../brand/model/brand.model';
import { Campaign } from '../../campaign/models/campaign.model';
import { City } from '../../shared/models/city.model';
import { Country } from '../../shared/models/country.model';
import { Op } from 'sequelize';

export interface InvoiceExportFilters {
  startDate?: Date;
  endDate?: Date;
  paymentStatus?: string;
  brandId?: number;
  influencerId?: number;
  campaignId?: number;
}

@Injectable()
export class InvoiceExcelExportService {
  constructor(
    @InjectModel(ProInvoice)
    private readonly proInvoiceModel: typeof ProInvoice,
    @InjectModel(MaxCampaignInvoice)
    private readonly maxCampaignInvoiceModel: typeof MaxCampaignInvoice,
    @InjectModel(InviteOnlyCampaignInvoice)
    private readonly inviteOnlyInvoiceModel: typeof InviteOnlyCampaignInvoice,
  ) {}

  /**
   * Export MaxX Influencer Invoices to Excel (GST Format)
   */
  async exportMaxInfluencerInvoices(filters: InvoiceExportFilters = {}): Promise<Buffer> {
    const whereClause: any = {};

    if (filters.startDate || filters.endDate) {
      whereClause.createdAt = {};
      if (filters.startDate) whereClause.createdAt[Op.gte] = filters.startDate;
      if (filters.endDate) whereClause.createdAt[Op.lte] = filters.endDate;
    }

    if (filters.paymentStatus) {
      whereClause.paymentStatus = filters.paymentStatus;
    }

    if (filters.influencerId) {
      whereClause.influencerId = filters.influencerId;
    }

    const invoices = await this.proInvoiceModel.findAll({
      where: whereClause,
      include: [
        {
          model: Influencer,
          attributes: ['id', 'name', 'username', 'phone', 'cityId'],
          include: [
            {
              model: City,
              attributes: ['id', 'name', 'state'],
            },
          ],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    // Transform data to GST format
    const excelData = invoices.map(invoice => {
      const igstRate = invoice.igst > 0 ? 18 : 0;
      const cgstRate = invoice.cgst > 0 ? 9 : 0;
      const sgstRate = invoice.sgst > 0 ? 9 : 0;

      const state = invoice.influencer?.city?.state || '';
      const pos = state; // POS (Place of Supply) is the state where service is provided

      return {
        'NAME OF PARTY': invoice.influencer?.name || 'N/A',
        'STATE': state,
        'POS': pos,
        'INVOICE NO.': invoice.invoiceNumber,
        'DATE': this.formatDateShort(invoice.createdAt),
        'ITEM VALUE': invoice.amount / 100,
        'HSN/SAC': '998314', // SAC code for subscription services
        'Item/ Services Description': 'MaxX Pro Subscription',
        'GOODS/SERVICES': 'Services',
        'QTY': 1,
        'TAXABLE VALUE': invoice.amount / 100,
        'IGST RATE': igstRate,
        'IGST AMOUNT': invoice.igst / 100,
        'CGST RATE': cgstRate,
        'CGST AMOUNT': invoice.cgst / 100,
        'SGST/ UTGST RATE': sgstRate,
        'SGST/ UTGST AMOUNT': invoice.sgst / 100,
        'Total Amount': invoice.totalAmount / 100,
      };
    });

    return this.generateExcelBuffer(excelData, 'MaxX Influencer Invoices');
  }

  /**
   * Export MaxX Campaign Invoices to Excel (GST Format)
   */
  async exportMaxCampaignInvoices(filters: InvoiceExportFilters = {}): Promise<Buffer> {
    const whereClause: any = {};

    if (filters.startDate || filters.endDate) {
      whereClause.createdAt = {};
      if (filters.startDate) whereClause.createdAt[Op.gte] = filters.startDate;
      if (filters.endDate) whereClause.createdAt[Op.lte] = filters.endDate;
    }

    if (filters.paymentStatus) {
      whereClause.paymentStatus = filters.paymentStatus;
    }

    if (filters.brandId) {
      whereClause.brandId = filters.brandId;
    }

    if (filters.campaignId) {
      whereClause.campaignId = filters.campaignId;
    }

    const invoices = await this.maxCampaignInvoiceModel.findAll({
      where: whereClause,
      include: [
        {
          model: Brand,
          attributes: ['id', 'brandName', 'username', 'email', 'headquarterCityId'],
          include: [
            {
              model: City,
              as: 'headquarterCity',
              attributes: ['id', 'name', 'state'],
            },
          ],
        },
        {
          model: Campaign,
          attributes: ['id', 'name', 'type'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    // Transform data to GST format
    const excelData = invoices.map(invoice => {
      const igstRate = invoice.igst > 0 ? 18 : 0;
      const cgstRate = invoice.cgst > 0 ? 9 : 0;
      const sgstRate = invoice.sgst > 0 ? 9 : 0;

      const state = invoice.brand?.headquarterCity?.state || '';
      const pos = state; // POS (Place of Supply) is the state where service is provided

      return {
        'NAME OF PARTY': invoice.brand?.brandName || 'N/A',
        'STATE': state,
        'POS': pos,
        'INVOICE NO.': invoice.invoiceNumber,
        'DATE': this.formatDateShort(invoice.createdAt),
        'ITEM VALUE': invoice.amount / 100,
        'HSN/SAC': '998314', // SAC code for advertising services
        'Item/ Services Description': `MaxX Campaign - ${invoice.campaign?.name || 'N/A'}`,
        'GOODS/SERVICES': 'Services',
        'QTY': 1,
        'TAXABLE VALUE': invoice.amount / 100,
        'IGST RATE': igstRate,
        'IGST AMOUNT': invoice.igst / 100,
        'CGST RATE': cgstRate,
        'CGST AMOUNT': invoice.cgst / 100,
        'SGST/ UTGST RATE': sgstRate,
        'SGST/ UTGST AMOUNT': invoice.sgst / 100,
        'Total Amount': invoice.totalAmount / 100,
      };
    });

    return this.generateExcelBuffer(excelData, 'MaxX Campaign Invoices');
  }

  /**
   * Export Invite-Only Campaign Invoices to Excel (GST Format)
   */
  async exportInviteOnlyInvoices(filters: InvoiceExportFilters = {}): Promise<Buffer> {
    const whereClause: any = {};

    if (filters.startDate || filters.endDate) {
      whereClause.createdAt = {};
      if (filters.startDate) whereClause.createdAt[Op.gte] = filters.startDate;
      if (filters.endDate) whereClause.createdAt[Op.lte] = filters.endDate;
    }

    if (filters.paymentStatus) {
      whereClause.paymentStatus = filters.paymentStatus;
    }

    if (filters.brandId) {
      whereClause.brandId = filters.brandId;
    }

    if (filters.campaignId) {
      whereClause.campaignId = filters.campaignId;
    }

    const invoices = await this.inviteOnlyInvoiceModel.findAll({
      where: whereClause,
      include: [
        {
          model: Brand,
          attributes: ['id', 'brandName', 'username', 'email', 'headquarterCityId'],
          include: [
            {
              model: City,
              as: 'headquarterCity',
              attributes: ['id', 'name', 'state'],
            },
          ],
        },
        {
          model: Campaign,
          attributes: ['id', 'name', 'type'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    // Transform data to GST format
    const excelData = invoices.map(invoice => {
      const igstRate = invoice.igst > 0 ? 18 : 0;
      const cgstRate = invoice.cgst > 0 ? 9 : 0;
      const sgstRate = invoice.sgst > 0 ? 9 : 0;

      const state = invoice.brand?.headquarterCity?.state || '';
      const pos = state; // POS (Place of Supply) is the state where service is provided

      return {
        'NAME OF PARTY': invoice.brand?.brandName || 'N/A',
        'STATE': state,
        'POS': pos,
        'INVOICE NO.': invoice.invoiceNumber,
        'DATE': this.formatDateShort(invoice.createdAt),
        'ITEM VALUE': invoice.amount / 100,
        'HSN/SAC': '998314', // SAC code for advertising services
        'Item/ Services Description': `Invite-Only Campaign - ${invoice.campaign?.name || 'N/A'}`,
        'GOODS/SERVICES': 'Services',
        'QTY': 1,
        'TAXABLE VALUE': invoice.amount / 100,
        'IGST RATE': igstRate,
        'IGST AMOUNT': invoice.igst / 100,
        'CGST RATE': cgstRate,
        'CGST AMOUNT': invoice.cgst / 100,
        'SGST/ UTGST RATE': sgstRate,
        'SGST/ UTGST AMOUNT': invoice.sgst / 100,
        'Total Amount': invoice.totalAmount / 100,
      };
    });

    return this.generateExcelBuffer(excelData, 'Invite-Only Campaign Invoices');
  }

  /**
   * Generate Excel buffer from data with proper formatting
   */
  private generateExcelBuffer(data: any[], sheetName: string): Buffer {
    const worksheet = XLSX.utils.json_to_sheet(data);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 25 }, // NAME OF PARTY
      { wch: 15 }, // STATE
      { wch: 10 }, // POS
      { wch: 20 }, // INVOICE NO.
      { wch: 12 }, // DATE
      { wch: 12 }, // ITEM VALUE
      { wch: 10 }, // HSN/SAC
      { wch: 40 }, // Item/Services Description
      { wch: 15 }, // GOODS/SERVICES
      { wch: 10 }, // QTY
      { wch: 15 }, // TAXABLE VALUE
      { wch: 10 }, // IGST RATE
      { wch: 12 }, // IGST AMOUNT
      { wch: 10 }, // CGST RATE
      { wch: 12 }, // CGST AMOUNT
      { wch: 10 }, // SGST RATE
      { wch: 12 }, // SGST AMOUNT
      { wch: 15 }, // Total Amount
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    // Generate buffer
    const excelBuffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    });

    return excelBuffer;
  }

  /**
   * Format date to DD-MM-YYYY
   */
  private formatDateShort(date: Date): string {
    if (!date) return 'N/A';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  }
}
