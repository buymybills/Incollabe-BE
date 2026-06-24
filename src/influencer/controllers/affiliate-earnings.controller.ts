import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseIntPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AffiliateEarningsService } from '../services/affiliate-earnings.service';
import {
  AffiliateEarningsQueryDto,
  WithdrawAffiliateEarningsDto,
} from '../dto/affiliate-earnings.dto';
import { AuthGuard } from '../../auth/guards/auth.guard';

@ApiTags('Influencer - Affiliate Earnings')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('influencer/affiliate-earnings')
export class AffiliateEarningsController {
  constructor(private readonly service: AffiliateEarningsService) {}

  @Get()
  @ApiOperation({ summary: 'Summary and paginated affiliate earnings list' })
  getEarnings(@Req() req: any, @Query() query: AffiliateEarningsQueryDto) {
    return this.service.getEarnings(req.user.id, query);
  }

  @Get('transactions/:id')
  @ApiOperation({ summary: 'Single transaction detail' })
  getTransaction(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.service.getTransaction(req.user.id, id);
  }

  @Post('withdraw')
  @ApiOperation({ summary: 'Initiate withdrawal of affiliate earnings' })
  withdraw(@Req() req: any, @Body() dto: WithdrawAffiliateEarningsDto) {
    return this.service.withdraw(req.user.id, dto);
  }
}
