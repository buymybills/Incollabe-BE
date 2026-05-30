import { Controller, Get, Post, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { ContractService } from '../../contract/contract.service';

@ApiTags('Admin — Contracts')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller('admin/contracts')
export class ContractAdminController {
  constructor(private readonly contractService: ContractService) {}

  @ApiOperation({
    summary: 'Verify contract integrity',
    description:
      'Re-computes the SHA-256 hash of the stored contract text and compares it to the hash recorded at signing time. ' +
      'valid: true means the document has not been tampered with since it was signed.',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Contract ID' })
  @ApiResponse({
    status: 200,
    description: 'Hash verification result',
    schema: { example: { valid: true, storedHash: 'e3b0c44298fc1c149afb...', computedHash: 'e3b0c44298fc1c149afb...' } },
  })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  @Get(':id/verify')
  async verifyIntegrity(@Param('id', ParseIntPipe) id: number) {
    return this.contractService.verifyContractIntegrity(id);
  }

  @ApiOperation({
    summary: 'Generate evidence bundle',
    description:
      'Verifies contract integrity first, then generates a tamper-evident PDF evidence bundle containing ' +
      'the full contract text, all signature blocks, and the complete audit trail. Uploads to S3 and returns the URL. ' +
      'Use for legal escalation or dispute resolution.',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Contract ID' })
  @ApiResponse({
    status: 201,
    description: 'Evidence bundle URL',
    schema: { example: { bundleUrl: 'https://cdn.collabkaroo.com/contracts/evidence-bundles/CTR-2026-4821-AB12-1748400000000.pdf' } },
  })
  @ApiResponse({ status: 400, description: 'Contract integrity check failed — text may have been tampered with' })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  @Post(':id/evidence-bundle')
  async generateEvidenceBundle(@Param('id', ParseIntPipe) id: number) {
    const bundleUrl = await this.contractService.generateEvidenceBundle(id);
    return { bundleUrl };
  }
}
