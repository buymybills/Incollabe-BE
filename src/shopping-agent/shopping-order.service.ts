import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { ShoppingOrder, ShoppingOrderStatus } from './models/shopping-order.model';
import { Brand } from '../brand/model/brand.model';

export interface CreateOrderDto {
  igSenderId: string;
  productName: string;
  brandName: string;
  productUrl?: string;
  size?: string;
  amountInr: number;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  shippingLine1?: string;
  shippingLine2?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingPincode?: string;
  billingDifferent?: boolean;
  billingLine1?: string;
  billingLine2?: string;
  billingCity?: string;
  billingState?: string;
  billingPincode?: string;
  paymentLinkId?: string;
  paymentShortUrl?: string;
}

@Injectable()
export class ShoppingOrderService {
  private readonly logger = new Logger(ShoppingOrderService.name);

  constructor(
    @InjectModel(ShoppingOrder)
    private readonly orderModel: typeof ShoppingOrder,
    @InjectModel(Brand)
    private readonly brandModel: typeof Brand,
  ) {}

  /**
   * Persist a new shopping order.
   * Tries to resolve brandId by matching brandName against the brands table.
   */
  async createOrder(dto: CreateOrderDto): Promise<ShoppingOrder> {
    let brandId: number | null = null;

    try {
      const brand = await this.brandModel.findOne({
        where: { brandName: { [Op.iLike]: `%${dto.brandName}%` } },
        attributes: ['id'],
      });
      if (brand) brandId = brand.id;
    } catch (err: any) {
      this.logger.warn(`Could not resolve brandId for "${dto.brandName}": ${err.message}`);
    }

    const order = await this.orderModel.create({
      igSenderId: dto.igSenderId,
      productName: dto.productName,
      brandName: dto.brandName,
      brandId,
      productUrl: dto.productUrl ?? null,
      size: dto.size ?? null,
      amountInr: dto.amountInr,
      customerName: dto.customerName ?? null,
      customerPhone: dto.customerPhone ?? null,
      customerEmail: dto.customerEmail ?? null,
      shippingLine1: dto.shippingLine1 ?? null,
      shippingLine2: dto.shippingLine2 ?? null,
      shippingCity: dto.shippingCity ?? null,
      shippingState: dto.shippingState ?? null,
      shippingPincode: dto.shippingPincode ?? null,
      billingDifferent: dto.billingDifferent ?? false,
      billingLine1: dto.billingLine1 ?? null,
      billingLine2: dto.billingLine2 ?? null,
      billingCity: dto.billingCity ?? null,
      billingState: dto.billingState ?? null,
      billingPincode: dto.billingPincode ?? null,
      paymentLinkId: dto.paymentLinkId ?? null,
      paymentShortUrl: dto.paymentShortUrl ?? null,
      status: ShoppingOrderStatus.PENDING,
    } as any);

    this.logger.log(`Order #${order.id} created — brand="${dto.brandName}" brandId=${brandId} igSender=${dto.igSenderId}`);
    return order;
  }

  /** All orders for a specific brand (for the brand dashboard). */
  async getOrdersByBrandId(brandId: number): Promise<ShoppingOrder[]> {
    return this.orderModel.findAll({
      where: { brandId },
      order: [['createdAt', 'DESC']],
    });
  }

  /** All orders initiated by a specific Instagram user. */
  async getOrdersByIgSender(igSenderId: string): Promise<ShoppingOrder[]> {
    return this.orderModel.findAll({
      where: { igSenderId },
      order: [['createdAt', 'DESC']],
    });
  }

  /** Mark an order paid (call from Razorpay webhook). */
  async markPaid(paymentLinkId: string): Promise<void> {
    await this.orderModel.update(
      { status: ShoppingOrderStatus.PAID },
      { where: { paymentLinkId } },
    );
  }
}
