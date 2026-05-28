import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Req,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Headers,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { ContractService } from './contract.service';
import { ContractTemplateService } from './services/contract-template.service';
import { SignContractDto } from './dto/sign-contract.dto';
import { SaveSignatureDto } from './dto/save-signature.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { SignatoryPartyType } from './models/contract-signatory.model';
import { SignatureUserType } from './models/user-signature.model';
import { ContractType } from './models/contract.model';

function resolveParty(req: any): { partyType: SignatoryPartyType; partyId: number; userType: SignatureUserType } {
  const userType: 'brand' | 'influencer' = req.user?.userType;
  const partyId: number = req.user?.id;
  const partyType = userType === 'brand' ? SignatoryPartyType.BRAND : SignatoryPartyType.INFLUENCER;
  const sigUserType = userType === 'brand' ? SignatureUserType.BRAND : SignatureUserType.INFLUENCER;
  return { partyType, partyId, userType: sigUserType };
}

function getIp(req: any): string {
  return (
    req.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ??
    req.connection?.remoteAddress ??
    'unknown'
  );
}

@ApiTags('Contracts')
@ApiBearerAuth()
@Controller('contracts')
export class ContractController {
  constructor(
    private readonly contractService: ContractService,
    private readonly templateService: ContractTemplateService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // SIGNATURE
  // ─────────────────────────────────────────────────────────────────────────

  @ApiOperation({
    summary: 'Save or update handwritten signature',
    description: 'Called once during onboarding when the user draws their signature on the canvas. Can be called again to redraw.',
  })
  @ApiResponse({ status: 201, description: 'Signature saved successfully', schema: { example: { message: 'Signature saved', signatureUrl: 'https://cdn.collabkaroo.com/signatures/influencer/42-1234567890.png' } } })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Post('signature')
  async saveSignature(@Req() req: any, @Body() dto: SaveSignatureDto) {
    const { userType, partyId } = resolveParty(req);
    const record = await this.contractService.saveSignature(userType, partyId, dto.signatureData);
    return { message: 'Signature saved', signatureUrl: record.signatureUrl };
  }

  @ApiOperation({
    summary: 'Get my saved signature URL',
    description: 'Returns the S3 URL of the user\'s saved handwritten signature. Returns null if not yet saved.',
  })
  @ApiResponse({ status: 200, description: 'Signature URL', schema: { example: { signatureUrl: 'https://cdn.collabkaroo.com/signatures/influencer/42.png' } } })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get('signature/me')
  async getMySignature(@Req() req: any) {
    const { userType, partyId } = resolveParty(req);
    const record = await this.contractService.getSignature(userType, partyId);
    return { signatureUrl: record?.signatureUrl ?? null };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CONTRACT LISTING
  // ─────────────────────────────────────────────────────────────────────────

  @ApiOperation({
    summary: 'List all my contracts',
    description: 'Returns all contracts where the authenticated user is a signatory, ordered newest first.',
  })
  @ApiResponse({ status: 200, description: 'List of contracts', schema: { example: { contracts: [{ id: 1, contractNumber: 'CTR-2026-4821-AB12', contractType: 'platform_influencer', status: 'partially_signed' }] } } })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get()
  async listMyContracts(@Req() req: any) {
    const { partyType, partyId } = resolveParty(req);
    const contracts = await this.contractService.getContractsForUser(partyType, partyId);
    return { contracts };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CONTRACT DETAIL
  // ─────────────────────────────────────────────────────────────────────────

  @ApiOperation({
    summary: 'View a contract',
    description: 'Returns the full rendered contract text and metadata. Also logs a "contract_viewed" audit entry.',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Contract ID' })
  @ApiResponse({ status: 200, description: 'Contract detail with rendered body text', schema: { example: { contract: { id: 1, contractNumber: 'CTR-2026-4821-AB12', status: 'partially_signed' }, bodyText: 'COLLABKAROO PLATFORM AGREEMENT...' } } })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Contract not found or you are not a signatory' })
  @Get(':id')
  async viewContract(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    const { partyType, partyId } = resolveParty(req);
    const ip = getIp(req);
    const { contract, bodyText } = await this.contractService.getContractForUser(id, partyType, partyId, ip);
    return { contract, bodyText };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SCROLL TRACKING
  // ─────────────────────────────────────────────────────────────────────────

  @ApiOperation({
    summary: 'Mark contract as fully read',
    description: 'Frontend calls this when user scrolls to the bottom. Unlocks the Sign button. Returns 204 with no body.',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Contract ID' })
  @ApiResponse({ status: 204, description: 'Recorded successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Contract not found or you are not a signatory' })
  @Post(':id/scroll')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markScrolled(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    const { partyType, partyId } = resolveParty(req);
    const ip = getIp(req);
    await this.contractService.markScrolledToBottom(id, partyType, partyId, ip);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SIGNING
  // ─────────────────────────────────────────────────────────────────────────

  @ApiOperation({
    summary: 'Sign a contract',
    description: 'User must have scrolled to bottom and have a saved signature on file. Pass `agreed: true` to confirm. If all parties have now signed, the PDF is generated automatically.',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Contract ID' })
  @ApiResponse({ status: 201, description: 'Signed successfully', schema: { example: { message: 'Contract fully signed. A signed PDF has been generated.', contractStatus: 'fully_signed', pdfUrl: 'https://cdn.collabkaroo.com/contracts/signed/CTR-2026-4821-AB12.pdf' } } })
  @ApiResponse({ status: 400, description: 'Must scroll to bottom first / no saved signature / already signed / contract void' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  @Post(':id/sign')
  async signContract(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SignContractDto,
    @Headers('user-agent') userAgent: string,
  ) {
    const { partyType, partyId } = resolveParty(req);
    const ip = getIp(req);
    const contract = await this.contractService.signContract(id, partyType, partyId, ip, userAgent ?? 'unknown');
    return {
      message:
        contract.status === 'fully_signed'
          ? 'Contract fully signed. A signed PDF has been generated.'
          : 'Your signature has been recorded. Waiting for the other party to sign.',
      contractStatus: contract.status,
      pdfUrl: contract.pdfUrl ?? null,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PDF DOWNLOAD
  // ─────────────────────────────────────────────────────────────────────────

  @ApiOperation({
    summary: 'Get signed PDF download URL',
    description: 'Returns a pre-signed S3 URL valid for 1 hour. Only available after all parties have signed.',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Contract ID' })
  @ApiResponse({ status: 200, description: 'Pre-signed PDF URL (1 hour expiry)', schema: { example: { pdfUrl: 'https://cdn.collabkaroo.com/contracts/signed/CTR-2026-4821-AB12.pdf?X-Amz-Signature=...' } } })
  @ApiResponse({ status: 400, description: 'PDF not yet generated — contract not fully signed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  @Get(':id/pdf')
  async getPdfUrl(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    const { partyType, partyId } = resolveParty(req);
    const url = await this.contractService.getContractPdfUrl(id, partyType, partyId);
    return { pdfUrl: url };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INTEGRITY VERIFICATION
  // ─────────────────────────────────────────────────────────────────────────

  @ApiOperation({
    summary: 'Verify contract integrity',
    description: 'Re-computes the SHA-256 hash of the contract text and compares it with the stored hash. If valid: true, the document has not been tampered with. No auth required.',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Contract ID' })
  @ApiResponse({ status: 200, description: 'Hash verification result', schema: { example: { valid: true, storedHash: 'e3b0c44298fc1c149afb...', computedHash: 'e3b0c44298fc1c149afb...' } } })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  @Get(':id/verify')
  async verifyIntegrity(@Param('id', ParseIntPipe) id: number) {
    return this.contractService.verifyContractIntegrity(id);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ADMIN — CONTRACT TEMPLATE MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────

  @ApiOperation({
    summary: '[Admin] List all contract templates',
    description: 'Returns all templates across all contract types and versions, ordered by type then newest first.',
  })
  @ApiResponse({ status: 200, description: 'All templates', schema: { example: { templates: [{ id: 1, contractType: 'platform_brand', version: '1.1', isActive: true, updatedBy: 5, notes: 'Updated penalty clause' }] } } })
  @Get('admin/templates')
  async listTemplates() {
    const templates = await this.templateService.getAllTemplates();
    return { templates };
  }

  @ApiOperation({
    summary: '[Admin] Get active template for a contract type',
    description: 'Returns the currently active template body with its placeholder tokens.',
  })
  @ApiParam({ name: 'type', enum: ContractType, description: 'Contract type' })
  @ApiResponse({ status: 200, description: 'Active template', schema: { example: { template: { id: 3, contractType: 'brand_influencer', version: '1.0', body: 'BRAND–CREATOR COLLABORATION AGREEMENT\n...', isActive: true } } } })
  @ApiResponse({ status: 404, description: 'No active template found for this type' })
  @Get('admin/templates/:type')
  async getTemplate(@Param('type') type: ContractType) {
    const template = await this.templateService.getActiveTemplate(type);
    return { template };
  }

  @ApiOperation({
    summary: '[Admin] Get version history for a contract type',
    description: 'Returns all past and present versions. Useful for auditing what changed between versions.',
  })
  @ApiParam({ name: 'type', enum: ContractType, description: 'Contract type' })
  @ApiResponse({ status: 200, description: 'Version history', schema: { example: { history: [{ id: 3, version: '1.1', isActive: true }, { id: 1, version: '1.0', isActive: false }] } } })
  @Get('admin/templates/:type/history')
  async getTemplateHistory(@Param('type') type: ContractType) {
    const history = await this.templateService.getTemplateHistory(type);
    return { history };
  }

  @ApiOperation({
    summary: '[Admin] Preview template with sample data',
    description: 'Renders the active template with placeholder sample values so admin can review how it looks before editing. Always call this after making changes.',
  })
  @ApiParam({ name: 'type', enum: ContractType, description: 'Contract type' })
  @ApiResponse({ status: 200, description: 'Rendered preview with sample values', schema: { example: { contractType: 'platform_brand', preview: 'COLLABKAROO PLATFORM AGREEMENT — BRAND\n\nThis Brand Platform Agreement is entered into on 28 May 2026 between:\n\nPARTY A — PLATFORM OPERATOR\nDepshanta Marketing Solutions Pvt. Ltd...' } } })
  @ApiResponse({ status: 404, description: 'No active template found for this type' })
  @Get('admin/templates/:type/preview')
  async previewTemplate(@Param('type') type: ContractType) {
    const rendered = await this.templateService.previewTemplate(type);
    return { contractType: type, preview: rendered };
  }

  @ApiOperation({
    summary: '[Admin] Update contract template body',
    description: 'Creates a new version and deactivates the current one. Past signed contracts are unaffected — they use their own stored snapshot. Use {{placeholderName}} tokens for dynamic values.',
  })
  @ApiParam({ name: 'type', enum: ContractType, description: 'Contract type to update' })
  @ApiBody({ type: UpdateTemplateDto })
  @ApiResponse({ status: 200, description: 'Template updated', schema: { example: { message: 'Template updated to v1.2', template: { id: 5, version: '1.2', isActive: true } } } })
  @ApiResponse({ status: 400, description: 'Validation error — body is required' })
  @Put('admin/templates/:type')
  async updateTemplate(
    @Req() req: any,
    @Param('type') type: ContractType,
    @Body() dto: UpdateTemplateDto,
  ) {
    const adminId: number = req.user?.id;
    const template = await this.templateService.updateTemplate(type, dto.body, adminId, dto.notes);
    return {
      message: `Template updated to v${template.version}`,
      template,
    };
  }
}
