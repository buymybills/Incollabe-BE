import { Controller, Post, Get, Delete, Body, Param, UseGuards, HttpCode, HttpStatus, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { ShoppingAgentService } from './shopping-agent.service';
import { AgentMessageDto } from './dto/agent-message.dto';
import { AuthGuard } from '../auth/guards/auth.guard';

@ApiTags('Shopping Agent')
@ApiBearerAuth()
@Controller('shopping-agent')
@UseGuards(AuthGuard)
export class ShoppingAgentController {
  constructor(private readonly shoppingAgentService: ShoppingAgentService) {}

  @Post('message')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send a message to the shopping agent',
    description: 'Multi-turn AI agent. Scans reels, searches catalogs, generates payment links. Omit sessionId to start a new session.',
  })
  async message(@Body() dto: AgentMessageDto) {
    return this.shoppingAgentService.chat(dto.sessionId, dto.message);
  }

  @Get('history/:sessionId')
  @ApiOperation({ summary: 'Get conversation history for a session' })
  @ApiParam({ name: 'sessionId' })
  getHistory(@Param('sessionId') sessionId: string) {
    const history = this.shoppingAgentService.getHistory(sessionId);
    if (!history) throw new NotFoundException(`Session ${sessionId} not found`);
    return { sessionId, turns: history };
  }

  @Delete('session/:sessionId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear a conversation session' })
  @ApiParam({ name: 'sessionId' })
  clearSession(@Param('sessionId') sessionId: string) {
    return { sessionId, cleared: this.shoppingAgentService.clearSession(sessionId) };
  }
}
