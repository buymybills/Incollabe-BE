import { Controller, Post, Get, Delete, Body, Param, UseGuards, HttpCode, HttpStatus, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiResponse } from '@nestjs/swagger';
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
  @ApiResponse({
    status: 200,
    description: 'Agent reply with matched products',
    schema: {
      example: {
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        reply: "I found 3 similar outfits from Indian D2C brands! Here are the top picks:\n\n1. **Snitch Oversized Graphic Tee** — ₹799\n   Buy: https://www.snitch.co.in/products/oversized-white-tee\n\n2. **Wrogn Classic White Tee** — ₹999\n   Buy: https://www.wrogn.com/products/white-tee",
        toolsUsed: ['scan_reel', 'search_catalog'],
        products: [
          {
            brand: 'Snitch',
            title: 'Oversized Graphic Tee',
            category: 'T-Shirts',
            image: 'https://cdn.snitch.co.in/products/tee.jpg',
            url: 'https://www.snitch.co.in/products/oversized-white-tee',
            priceInr: 799,
            score: 3,
          },
        ],
      },
    },
  })
  async message(@Body() dto: AgentMessageDto) {
    return this.shoppingAgentService.chat(dto.sessionId, dto.message);
  }

  @Get('history/:sessionId')
  @ApiOperation({ summary: 'Get conversation history for a session' })
  @ApiParam({ name: 'sessionId' })
  @ApiResponse({
    status: 200,
    description: 'Conversation turns for the session',
    schema: {
      example: {
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        turns: [
          { role: 'user', text: 'Find me a white oversized tee' },
          { role: 'model', text: 'Here are some options from Snitch and Wrogn...' },
        ],
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Session not found' })
  getHistory(@Param('sessionId') sessionId: string) {
    const history = this.shoppingAgentService.getHistory(sessionId);
    if (!history) throw new NotFoundException(`Session ${sessionId} not found`);
    return { sessionId, turns: history };
  }

  @Delete('session/:sessionId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear a conversation session' })
  @ApiParam({ name: 'sessionId' })
  @ApiResponse({
    status: 200,
    description: 'Session cleared',
    schema: {
      example: {
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        cleared: true,
      },
    },
  })
  clearSession(@Param('sessionId') sessionId: string) {
    return { sessionId, cleared: this.shoppingAgentService.clearSession(sessionId) };
  }
}
