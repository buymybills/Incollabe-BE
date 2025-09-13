import { Controller, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { NicheSeeder } from './seeders/niche.seeder';

@ApiTags('Seeder')
@Controller('seed')
export class SeedController {
  constructor(private readonly nicheSeeder: NicheSeeder) {}

  @Post('niches')
  @ApiOperation({
    summary: 'Seed niches data',
    description: 'Populate the niches table with initial data',
  })
  @ApiResponse({
    status: 200,
    description: 'Niches seeded successfully',
  })
  async seedNiches() {
    await this.nicheSeeder.seed();
    return {
      message: 'Niches seeded successfully',
    };
  }
}