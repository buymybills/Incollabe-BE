import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SearchService } from '../services/search.service';
import { SearchUsersDto } from '../dto/search-users.dto';

@ApiTags('Search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('users')
  @ApiOperation({ summary: 'Search for influencers and brands' })
  @ApiResponse({
    status: 200,
    description:
      'Returns list of influencers and brands based on search criteria',
  })
  async searchUsers(@Query() searchDto: SearchUsersDto) {
    return this.searchService.searchUsers(searchDto);
  }
}
