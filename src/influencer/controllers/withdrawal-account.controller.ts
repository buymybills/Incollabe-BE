import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  ParseIntPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WithdrawalAccountService } from '../services/withdrawal-account.service';
import {
  CreateWithdrawalAccountDto,
  RedeemWithdrawalDto,
} from '../dto/withdrawal-account.dto';
import { AuthGuard } from '../../auth/guards/auth.guard';

@ApiTags('Influencer - Withdrawal Accounts')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('influencer/withdrawal-accounts')
export class WithdrawalAccountController {
  constructor(private readonly service: WithdrawalAccountService) {}

  @Get()
  @ApiOperation({ summary: 'List all withdrawal accounts' })
  findAll(@Req() req: any) {
    return this.service.findAll(req.user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Add UPI or bank account' })
  create(@Req() req: any, @Body() dto: CreateWithdrawalAccountDto) {
    return this.service.create(req.user.id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove withdrawal account' })
  remove(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.service.remove(req.user.id, id);
  }

  @Patch(':id/default')
  @ApiOperation({ summary: 'Set as default withdrawal account' })
  setDefault(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.service.setDefault(req.user.id, id);
  }

  @Post(':id/redeem')
  @ApiOperation({ summary: 'Withdraw to this account' })
  redeem(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RedeemWithdrawalDto,
  ) {
    return this.service.redeem(req.user.id, id, dto);
  }
}
