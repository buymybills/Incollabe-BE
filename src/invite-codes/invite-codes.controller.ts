import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InviteCodesService } from './invite-codes.service';
import { CreateInviteCodeDto } from './dto/create-invite-code.dto';

@ApiTags('Admin - Invite Codes')
@ApiBearerAuth()
@Controller('admin/invite-codes')
export class InviteCodesController {
  constructor(private readonly inviteCodesService: InviteCodesService) {}

  @Post()
  @ApiOperation({ summary: 'Create one or more invite codes' })
  create(@Body() dto: CreateInviteCodeDto, @Req() req: any) {
    const adminId = req.user?.id ?? 0;
    return this.inviteCodesService.create(dto, adminId);
  }

  @Get()
  @ApiOperation({ summary: 'List all invite codes with usage stats' })
  findAll() {
    return this.inviteCodesService.findAll();
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Activate or deactivate an invite code' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { isActive: boolean },
  ) {
    return this.inviteCodesService.update(id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an invite code' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.inviteCodesService.remove(id);
  }
}
