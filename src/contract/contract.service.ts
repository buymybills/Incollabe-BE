import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import { Contract, ContractType, ContractStatus } from './models/contract.model';
import { ContractSignatory, SignatoryPartyType, SignatoryStatus } from './models/contract-signatory.model';
import { ContractAuditLog, AuditAction } from './models/contract-audit-log.model';
import { UserSignature, SignatureUserType } from './models/user-signature.model';
import { ContractPdfService, SignatureBlock } from './services/contract-pdf.service';
import { ContractTemplateService } from './services/contract-template.service';
import { S3Service } from '../shared/s3.service';
import { PlatformBrandContractData } from './templates/platform-brand.template';
import { PlatformInfluencerContractData } from './templates/platform-influencer.template';
import { BrandInfluencerContractData } from './templates/brand-influencer.template';

@Injectable()
export class ContractService {
  private readonly logger = new Logger(ContractService.name);

  constructor(
    @InjectModel(Contract) private contractModel: typeof Contract,
    @InjectModel(ContractSignatory) private signatoryModel: typeof ContractSignatory,
    @InjectModel(ContractAuditLog) private auditLogModel: typeof ContractAuditLog,
    @InjectModel(UserSignature) private signatureModel: typeof UserSignature,
    private readonly pdfService: ContractPdfService,
    private readonly templateService: ContractTemplateService,
    private readonly s3Service: S3Service,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // SIGNATURE MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Save or update a user's handwritten signature.
   * `signatureData` can be a base64 PNG data URL (uploaded from app canvas).
   * We upload the image to S3 and store only the URL.
   */
  async saveSignature(
    userType: SignatureUserType,
    userId: number,
    signatureData: string,
  ): Promise<UserSignature> {
    let signatureUrl: string;

    if (signatureData.startsWith('data:image/')) {
      signatureUrl = await this.uploadBase64Image(signatureData, `signatures/${userType}/${userId}`);
    } else {
      // Already an S3/CDN URL
      signatureUrl = signatureData;
    }

    const [record] = await this.signatureModel.upsert({
      userType,
      userId,
      signatureUrl,
    } as any);

    return record;
  }

  async getSignature(userType: SignatureUserType, userId: number): Promise<UserSignature | null> {
    return this.signatureModel.findOne({ where: { userType, userId } });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CONTRACT CREATION (TRIGGERED BY PLATFORM EVENTS)
  // ─────────────────────────────────────────────────────────────────────────

  /** Called when admin approves a brand. Brand must sign before running campaigns. */
  async createPlatformBrandContract(data: PlatformBrandContractData): Promise<Contract> {
    const contractNumber = this.generateContractNumber();
    const bodyText = await this.templateService.renderContract(ContractType.PLATFORM_BRAND, data);
    const contentHash = this.pdfService.hashContractText(bodyText);

    const contract = await this.contractModel.create({
      contractNumber,
      contractType: ContractType.PLATFORM_BRAND,
      status: ContractStatus.PARTIALLY_SIGNED,
      contractData: data as any,
      contractText: bodyText,
      contentHash,
      signingDeadline: this.addDays(new Date(), 7),
    } as any);

    // Platform auto-signs
    await this.signatoryModel.create({
      contractId: contract.id,
      partyType: SignatoryPartyType.PLATFORM,
      status: SignatoryStatus.SIGNED,
      signedAt: new Date(),
      scrolledToBottom: true,
      scrolledAt: new Date(),
    } as any);

    // Brand signatory — pending
    await this.signatoryModel.create({
      contractId: contract.id,
      partyType: SignatoryPartyType.BRAND,
      status: SignatoryStatus.PENDING,
    } as any);

    await this.log(contract.id, AuditAction.CONTRACT_CREATED, 'system', null, {
      contractType: ContractType.PLATFORM_BRAND,
      contractNumber,
    });

    return contract;
  }

  /** Called when influencer profile is verified. Influencer must sign before applying. */
  async createPlatformInfluencerContract(
    influencerId: number,
    data: PlatformInfluencerContractData,
  ): Promise<Contract> {
    const contractNumber = this.generateContractNumber();
    const bodyText = await this.templateService.renderContract(ContractType.PLATFORM_INFLUENCER, data);
    const contentHash = this.pdfService.hashContractText(bodyText);

    const contract = await this.contractModel.create({
      contractNumber,
      contractType: ContractType.PLATFORM_INFLUENCER,
      status: ContractStatus.PARTIALLY_SIGNED,
      contractData: data as any,
      contractText: bodyText,
      contentHash,
      influencerId,
      signingDeadline: this.addDays(new Date(), 7),
    } as any);

    await this.signatoryModel.create({
      contractId: contract.id,
      partyType: SignatoryPartyType.PLATFORM,
      status: SignatoryStatus.SIGNED,
      signedAt: new Date(),
      scrolledToBottom: true,
      scrolledAt: new Date(),
    } as any);

    await this.signatoryModel.create({
      contractId: contract.id,
      partyType: SignatoryPartyType.INFLUENCER,
      partyId: influencerId,
      status: SignatoryStatus.PENDING,
    } as any);

    await this.log(contract.id, AuditAction.CONTRACT_CREATED, 'system', influencerId, {
      contractType: ContractType.PLATFORM_INFLUENCER,
      contractNumber,
    });

    return contract;
  }

  /** Called when brand selects an influencer for a campaign. Both must sign. */
  async createBrandInfluencerContract(
    campaignApplicationId: number,
    brandId: number,
    influencerId: number,
    data: BrandInfluencerContractData,
  ): Promise<Contract> {
    const contractNumber = this.generateContractNumber();
    const bodyText = await this.templateService.renderContract(ContractType.BRAND_INFLUENCER, data);
    const contentHash = this.pdfService.hashContractText(bodyText);

    const contract = await this.contractModel.create({
      contractNumber,
      contractType: ContractType.BRAND_INFLUENCER,
      status: ContractStatus.PENDING,
      contractData: data as any,
      contractText: bodyText,
      contentHash,
      campaignApplicationId,
      brandId,
      influencerId,
      signingDeadline: this.addDays(new Date(), 3),
    } as any);

    await this.signatoryModel.create({
      contractId: contract.id,
      partyType: SignatoryPartyType.BRAND,
      partyId: brandId,
      status: SignatoryStatus.PENDING,
    } as any);

    await this.signatoryModel.create({
      contractId: contract.id,
      partyType: SignatoryPartyType.INFLUENCER,
      partyId: influencerId,
      status: SignatoryStatus.PENDING,
    } as any);

    await this.log(contract.id, AuditAction.CONTRACT_CREATED, 'system', null, {
      contractType: ContractType.BRAND_INFLUENCER,
      contractNumber,
      brandId,
      influencerId,
      campaignApplicationId,
    });

    return contract;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CONTRACT VIEWING & SIGNING
  // ─────────────────────────────────────────────────────────────────────────

  async getContractForUser(
    contractId: number,
    partyType: SignatoryPartyType,
    partyId: number,
    ipAddress: string,
  ): Promise<{ contract: Contract; bodyText: string }> {
    const contract = await this.contractModel.findByPk(contractId, {
      include: [ContractSignatory, ContractAuditLog],
    });

    if (!contract) throw new NotFoundException('Contract not found');

    this.assertUserIsSignatory(contract, partyType, partyId);

    const bodyText = this.renderContract(contract);

    await this.log(contract.id, AuditAction.CONTRACT_VIEWED, partyType, partyId, { ipAddress });

    return { contract, bodyText };
  }

  /** Frontend calls this when user scrolls to the bottom — enables the Sign button. */
  async markScrolledToBottom(
    contractId: number,
    partyType: SignatoryPartyType,
    partyId: number,
    ipAddress: string,
  ): Promise<void> {
    const signatory = await this.signatoryModel.findOne({
      where: { contractId, partyType, partyId },
    });

    if (!signatory) throw new NotFoundException('You are not a signatory on this contract');

    await signatory.update({
      scrolledToBottom: true,
      scrolledAt: new Date(),
      ipAddress,
    });

    await this.log(contractId, AuditAction.SCROLLED_TO_BOTTOM, partyType, partyId, { ipAddress });
  }

  /**
   * Sign the contract. Requires:
   *   - The signatory has scrolled to the bottom
   *   - The user has a saved signature on file
   *   - `agreed` checkbox is true
   */
  async signContract(
    contractId: number,
    partyType: SignatoryPartyType,
    partyId: number,
    ipAddress: string,
    deviceInfo: string,
  ): Promise<Contract> {
    const contract = await this.contractModel.findByPk(contractId, {
      include: [ContractSignatory],
    });

    if (!contract) throw new NotFoundException('Contract not found');
    if (contract.status === ContractStatus.VOID)
      throw new BadRequestException('This contract has expired and can no longer be signed');
    if (contract.status === ContractStatus.FULLY_SIGNED)
      throw new BadRequestException('This contract is already fully signed');

    const signatory = contract.signatories.find(
      (s) => s.partyType === partyType && s.partyId === partyId,
    );

    if (!signatory) throw new NotFoundException('You are not a signatory on this contract');
    if (signatory.status === SignatoryStatus.SIGNED)
      throw new BadRequestException('You have already signed this contract');
    if (!signatory.scrolledToBottom)
      throw new BadRequestException(
        'You must read the full contract (scroll to the bottom) before signing',
      );

    // User must have a saved signature
    const savedSignature = await this.signatureModel.findOne({ where: { userType: partyType, userId: partyId } });
    if (!savedSignature)
      throw new BadRequestException(
        'No saved signature found. Please draw and save your signature in your profile settings first.',
      );

    await signatory.update({
      status: SignatoryStatus.SIGNED,
      signedAt: new Date(),
      ipAddress,
      deviceInfo,
    });

    await this.log(contractId, AuditAction.CONTRACT_SIGNED, partyType, partyId, {
      ipAddress,
      deviceInfo,
      signedAt: new Date().toISOString(),
    });

    // Check if all human signatories have signed
    await contract.reload({ include: [ContractSignatory] });
    const allSigned = contract.signatories.every((s) => s.status === SignatoryStatus.SIGNED);

    if (allSigned) {
      await contract.update({ status: ContractStatus.FULLY_SIGNED });
      await this.generateAndStorePdf(contract);
    } else {
      await contract.update({ status: ContractStatus.PARTIALLY_SIGNED });
    }

    await contract.reload();
    return contract;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PDF & VERIFICATION
  // ─────────────────────────────────────────────────────────────────────────

  async getContractPdfUrl(
    contractId: number,
    partyType: SignatoryPartyType,
    partyId: number,
  ): Promise<string> {
    const contract = await this.contractModel.findByPk(contractId, {
      include: [ContractSignatory],
    });

    if (!contract) throw new NotFoundException('Contract not found');
    this.assertUserIsSignatory(contract, partyType, partyId);

    if (!contract.pdfUrl)
      throw new BadRequestException('PDF not yet generated — contract is not fully signed');

    return this.s3Service.getSignedUrl(
      this.s3Service.extractKeyFromUrl(contract.pdfUrl) ?? contract.pdfUrl,
      3600,
    );
  }

  async verifyContractIntegrity(contractId: number): Promise<{ valid: boolean; storedHash: string; computedHash: string }> {
    const contract = await this.contractModel.findByPk(contractId);
    if (!contract) throw new NotFoundException('Contract not found');

    const bodyText = this.renderContract(contract);
    const computedHash = this.pdfService.hashContractText(bodyText);
    const valid = computedHash === contract.contentHash;

    return { valid, storedHash: contract.contentHash, computedHash };
  }

  async generateEvidenceBundle(contractId: number): Promise<string> {
    const contract = await this.contractModel.findByPk(contractId, {
      include: [ContractSignatory, ContractAuditLog],
    });

    if (!contract) throw new NotFoundException('Contract not found');

    const bodyText = this.renderContract(contract);

    const computedHash = this.pdfService.hashContractText(bodyText);
    if (computedHash !== contract.contentHash) {
      throw new BadRequestException(
        'Contract integrity check failed — the contract text does not match the hash recorded at signing time. The document may have been tampered with.',
      );
    }
    const signatureBlocks = await this.buildSignatureBlocks(contract);
    const auditLog = (contract.auditLogs ?? []).map((l) => ({
      action: l.action,
      actorType: l.actorType,
      actorId: l.actorId,
      ipAddress: l.ipAddress,
      metadata: l.metadata ?? {},
      createdAt: l.createdAt,
    }));

    const pdfBuffer = await this.pdfService.generateEvidenceBundlePdf({
      contractNumber: contract.contractNumber,
      contractType: contract.contractType,
      contractBodyText: bodyText,
      contentHash: contract.contentHash,
      signatureBlocks,
      auditLog,
      breachDetails: contract.breachDetails ?? {},
    });

    const s3Key = `contracts/evidence-bundles/${contract.contractNumber}-${Date.now()}.pdf`;
    await this.s3Service.uploadFromUrl(
      `data:application/pdf;base64,${pdfBuffer.toString('base64')}`,
      s3Key,
      'application/pdf',
    ).catch(() => this.uploadBuffer(pdfBuffer, s3Key));

    const url = this.s3Service.getFileUrl(s3Key);

    await this.log(contractId, AuditAction.EVIDENCE_BUNDLE_GENERATED, 'system', null, { s3Key });

    return url;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LISTING
  // ─────────────────────────────────────────────────────────────────────────

  async getContractsForUser(
    partyType: SignatoryPartyType,
    partyId: number,
  ): Promise<Contract[]> {
    const signatories = await this.signatoryModel.findAll({
      where: { partyType, partyId },
    });

    const contractIds = signatories.map((s) => s.contractId);
    if (!contractIds.length) return [];

    return this.contractModel.findAll({
      where: { id: contractIds },
      include: [ContractSignatory],
      order: [['createdAt', 'DESC']],
    });
  }

  async getContractById(contractId: number): Promise<Contract> {
    const contract = await this.contractModel.findByPk(contractId, {
      include: [ContractSignatory, ContractAuditLog],
    });
    if (!contract) throw new NotFoundException('Contract not found');
    return contract;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  private renderContract(contract: Contract): string {
    // Use the snapshotted text stored at contract creation time.
    // This ensures the hash always matches even if admin later edits the template.
    if (contract.contractText) return contract.contractText;

    // Fallback for older contracts created before contractText column was added
    throw new BadRequestException('Contract text snapshot not found. Contract may have been created before this feature was enabled.');
  }

  private assertUserIsSignatory(
    contract: Contract,
    partyType: SignatoryPartyType,
    partyId: number,
  ): void {
    const isSignatory = contract.signatories?.some(
      (s) => s.partyType === partyType && s.partyId === partyId,
    );
    if (!isSignatory) throw new NotFoundException('Contract not found');
  }

  private async generateAndStorePdf(contract: Contract): Promise<void> {
    try {
      const bodyText = this.renderContract(contract);
      const signatureBlocks = await this.buildSignatureBlocks(contract);

      const pdfBuffer = await this.pdfService.generateSignedContractPdf({
        contractNumber: contract.contractNumber,
        contractType: contract.contractType,
        contractBodyText: bodyText,
        contentHash: contract.contentHash,
        signatureBlocks,
      });

      const s3Key = `contracts/signed/${contract.contractType}/${contract.contractNumber}.pdf`;
      await this.uploadBuffer(pdfBuffer, s3Key);
      const pdfUrl = this.s3Service.getFileUrl(s3Key);

      await contract.update({ pdfUrl });
      await this.log(contract.id, AuditAction.PDF_GENERATED, 'system', null, { s3Key, pdfUrl });
    } catch (err) {
      this.logger.error(`Failed to generate PDF for contract ${contract.contractNumber}`, err);
    }
  }

  private async buildSignatureBlocks(contract: Contract): Promise<SignatureBlock[]> {
    const blocks: SignatureBlock[] = [];
    for (const sig of contract.signatories ?? []) {
      if (sig.status !== SignatoryStatus.SIGNED) continue;

      let signatureImageBase64: string | undefined;
      if (sig.partyType !== SignatoryPartyType.PLATFORM && sig.partyId) {
        const saved = await this.signatureModel.findOne({
          where: { userType: sig.partyType, userId: sig.partyId },
        });
        if (saved?.signatureUrl) {
          signatureImageBase64 = saved.signatureUrl;
        }
      }

      const data = contract.contractData as any;
      const name =
        sig.partyType === SignatoryPartyType.BRAND
          ? data.brandName ?? data.brandPocName ?? 'Brand Representative'
          : sig.partyType === SignatoryPartyType.INFLUENCER
          ? data.influencerName ?? data.pocName ?? 'Creator'
          : 'Collabkaroo (Platform)';

      blocks.push({
        signerName: name,
        username: data.username ?? data.influencerUsername,
        phone: data.pocPhone ?? data.influencerPhone,
        email: data.pocEmail ?? data.influencerEmail,
        signedAt: sig.signedAt ?? new Date(),
        ipAddress: sig.ipAddress ?? 'N/A',
        partyLabel: `SIGNED BY (${sig.partyType.toUpperCase()})`,
        signatureImageBase64,
        contractNumber: contract.contractNumber,
        contentHash: contract.contentHash,
      });
    }
    return blocks;
  }

  private async uploadBuffer(buffer: Buffer, s3Key: string): Promise<void> {
    await (this.s3Service as any).s3
      ?.upload({
        Bucket: (this.s3Service as any).bucketName,
        Key: s3Key,
        Body: buffer,
        ContentType: 'application/pdf',
        ContentDisposition: 'inline',
      })
      .promise();
  }

  private async uploadBase64Image(dataUrl: string, folder: string): Promise<string> {
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64, 'base64');
    const s3Key = `${folder}-${Date.now()}.png`;

    await (this.s3Service as any).s3
      ?.upload({
        Bucket: (this.s3Service as any).bucketName,
        Key: s3Key,
        Body: buffer,
        ContentType: 'image/png',
        ContentDisposition: 'inline',
      })
      .promise();

    return this.s3Service.getFileUrl(s3Key);
  }

  private generateContractNumber(): string {
    const year = new Date().getFullYear();
    const random = Math.floor(1000 + Math.random() * 9000);
    return `CTR-${year}-${random}-${uuidv4().slice(0, 4).toUpperCase()}`;
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  private async log(
    contractId: number,
    action: string,
    actorType: string,
    actorId: number | null,
    metadata: Record<string, any>,
    ipAddress?: string,
  ): Promise<void> {
    await this.auditLogModel.create({
      contractId,
      action,
      actorType,
      actorId: actorId ?? undefined,
      metadata,
      ipAddress: ipAddress ?? undefined,
    } as any);
  }
}
