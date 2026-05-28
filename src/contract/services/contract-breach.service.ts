import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Contract, ContractStatus, ContractType } from '../models/contract.model';
import { ContractSignatory, SignatoryStatus } from '../models/contract-signatory.model';
import { ContractAuditLog, AuditAction } from '../models/contract-audit-log.model';

@Injectable()
export class ContractBreachService {
  private readonly logger = new Logger(ContractBreachService.name);

  constructor(
    @InjectModel(Contract) private contractModel: typeof Contract,
    @InjectModel(ContractAuditLog) private auditLogModel: typeof ContractAuditLog,
  ) {}

  /**
   * Runs every day at 02:00 AM IST (20:30 UTC previous day).
   * Checks:
   *   1. Contracts that hit their signing deadline without all parties signing → void them.
   *   2. Fully-signed brand_influencer contracts where posting deadline has passed
   *      but no content was marked as submitted → flag as breached.
   *   3. Fully-signed brand_influencer contracts where the brand hasn't shipped
   *      (shipment deadline has passed) → flag as breached.
   */
  @Cron('30 20 * * *', { name: 'contract-breach-check', timeZone: 'UTC' })
  async runDailyBreachCheck(): Promise<void> {
    this.logger.log('Daily contract breach check started');
    await Promise.all([
      this.voidExpiredContracts(),
      this.checkPostingDeadlineBreaches(),
      this.checkShipmentDeadlineBreaches(),
    ]);
    this.logger.log('Daily contract breach check completed');
  }

  private async voidExpiredContracts(): Promise<void> {
    const expired = await this.contractModel.findAll({
      where: {
        status: [ContractStatus.PENDING, ContractStatus.PARTIALLY_SIGNED],
        signingDeadline: { [Op.lt]: new Date() },
      },
    });

    for (const contract of expired) {
      await contract.update({ status: ContractStatus.VOID });
      await this.log(contract.id, AuditAction.CONTRACT_VOIDED, 'system', null, {
        reason: 'Signing deadline passed without all parties signing',
        voidedAt: new Date().toISOString(),
      });
      this.logger.warn(`Contract #${contract.contractNumber} voided — signing deadline expired`);
    }
  }

  private async checkPostingDeadlineBreaches(): Promise<void> {
    const contracts = await this.contractModel.findAll({
      where: {
        contractType: ContractType.BRAND_INFLUENCER,
        status: ContractStatus.FULLY_SIGNED,
      },
    });

    const now = new Date();

    for (const contract of contracts) {
      const data = contract.contractData as any;
      if (!data?.postingDeadline) continue;

      const deadline = new Date(data.postingDeadline);
      if (deadline >= now) continue;

      // Check if content was submitted (tracked in contractData by the campaign flow)
      const contentSubmitted = data.contentSubmittedAt;
      if (!contentSubmitted) {
        await this.flagBreach(contract, {
          type: 'posting_deadline_missed',
          breachingParty: 'influencer',
          deadline: data.postingDeadline,
          detectedAt: now.toISOString(),
        });
      }
    }
  }

  private async checkShipmentDeadlineBreaches(): Promise<void> {
    const contracts = await this.contractModel.findAll({
      where: {
        contractType: ContractType.BRAND_INFLUENCER,
        status: ContractStatus.FULLY_SIGNED,
      },
    });

    const now = new Date();

    for (const contract of contracts) {
      const data = contract.contractData as any;
      if (!data?.barterShipmentDeadline || data.paymentAmount > 0) continue;

      const deadline = new Date(data.barterShipmentDeadline);
      if (deadline >= now) continue;

      const productShipped = data.productShippedAt;
      if (!productShipped) {
        await this.flagBreach(contract, {
          type: 'shipment_deadline_missed',
          breachingParty: 'brand',
          deadline: data.barterShipmentDeadline,
          detectedAt: now.toISOString(),
        });
      }
    }
  }

  private async flagBreach(contract: Contract, details: Record<string, any>): Promise<void> {
    // Don't double-flag
    if (contract.status === ContractStatus.BREACHED) return;

    await contract.update({
      status: ContractStatus.BREACHED,
      breachDetails: details,
    });

    await this.log(contract.id, AuditAction.BREACH_FLAGGED, 'system', null, details);

    this.logger.warn(
      `Contract #${contract.contractNumber} flagged as BREACHED — ${details.type} by ${details.breachingParty}`,
    );
  }

  /**
   * Called externally (e.g. from campaign service) to mark a specific event
   * on a contract, such as "product shipped" or "content submitted".
   */
  async recordContractEvent(
    contractId: number,
    eventKey: string,
    value: string,
  ): Promise<void> {
    const contract = await this.contractModel.findByPk(contractId);
    if (!contract) return;

    await contract.update({
      contractData: { ...contract.contractData, [eventKey]: value },
    });
  }

  private async log(
    contractId: number,
    action: string,
    actorType: string,
    actorId: number | null,
    metadata: Record<string, any>,
  ): Promise<void> {
    await this.auditLogModel.create({
      contractId,
      action,
      actorType,
      actorId: actorId ?? undefined,
      metadata,
    } as any);
  }
}
