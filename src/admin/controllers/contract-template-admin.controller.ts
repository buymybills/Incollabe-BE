import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { ContractTemplateService } from '../../contract/services/contract-template.service';
import { UpdateTemplateDto } from '../../contract/dto/update-template.dto';
import { ContractType } from '../../contract/models/contract.model';

@ApiTags('Admin — Contract Templates')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller('admin/contracts/templates')
export class ContractTemplateAdminController {
  constructor(private readonly templateService: ContractTemplateService) {}

  @ApiOperation({
    summary: 'List all contract templates',
    description: 'Returns all templates across all contract types and versions, ordered by type then newest first.',
  })
  @ApiResponse({ status: 200, description: 'All templates', schema: { example: { templates: [{ id: 1, contractType: 'platform_brand', version: '1.1', isActive: true, updatedBy: 5, notes: 'Updated penalty clause' }] } } })
  @Get()
  async listTemplates() {
    const templates = await this.templateService.getAllTemplates();
    return { templates };
  }

  @ApiOperation({
    summary: 'Get active template for a contract type',
    description: 'Returns the currently active template body with its placeholder tokens.',
  })
  @ApiParam({ name: 'type', enum: ContractType, description: 'Contract type' })
  @ApiResponse({ status: 200, description: 'Active template', schema: { example: { template: { id: 3, contractType: 'brand_influencer', version: '1.0', body: 'BRAND–CREATOR COLLABORATION AGREEMENT\n...', isActive: true } } } })
  @ApiResponse({ status: 404, description: 'No active template found for this type' })
  @Get(':type')
  async getTemplate(@Param('type') type: ContractType) {
    const template = await this.templateService.getActiveTemplate(type);
    return { template };
  }

  @ApiOperation({
    summary: 'Get version history for a contract type',
    description: 'Returns all past and present versions. Useful for auditing what changed between versions.',
  })
  @ApiParam({ name: 'type', enum: ContractType, description: 'Contract type' })
  @ApiResponse({ status: 200, description: 'Version history', schema: { example: { history: [{ id: 3, version: '1.1', isActive: true }, { id: 1, version: '1.0', isActive: false }] } } })
  @Get(':type/history')
  async getTemplateHistory(@Param('type') type: ContractType) {
    const history = await this.templateService.getTemplateHistory(type);
    return { history };
  }

  @ApiOperation({
    summary: 'Preview template with sample data',
    description: 'Renders the active template with placeholder sample values so admin can review how it looks before editing.',
  })
  @ApiParam({ name: 'type', enum: ContractType, description: 'Contract type' })
  @ApiResponse({ status: 200, description: 'Rendered preview with sample values', schema: { example: { contractType: 'platform_brand', preview: 'COLLABKAROO PLATFORM AGREEMENT...' } } })
  @ApiResponse({ status: 404, description: 'No active template found for this type' })
  @Get(':type/preview')
  async previewTemplate(@Param('type') type: ContractType) {
    const rendered = await this.templateService.previewTemplate(type);
    return { contractType: type, preview: rendered };
  }

  @ApiOperation({
    summary: 'Update contract template body',
    description: 'Creates a new version and deactivates the current one. Past signed contracts are unaffected — they use their own stored snapshot.',
  })
  @ApiParam({ name: 'type', enum: ContractType, description: 'Contract type to update' })
  @ApiBody({ type: UpdateTemplateDto })
  @ApiResponse({ status: 200, description: 'Template updated', schema: { example: { message: 'Template updated to v1.2', template: { id: 5, version: '1.2', isActive: true } } } })
  @ApiResponse({ status: 400, description: 'Validation error — body is required' })
  @Put(':type')
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
