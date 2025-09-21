import { Controller, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { NicheSeeder } from './seeders/niche.seeder';
import { CountrySeeder } from './seeders/country.seeder';
import { CitySeeder } from './seeders/city.seeder';
import { CompanyTypeSeeder } from './seeders/company-type.seeder';

@ApiTags('Seeder')
@Controller('seed')
export class SeedController {
  constructor(
    private readonly nicheSeeder: NicheSeeder,
    private readonly countrySeeder: CountrySeeder,
    private readonly citySeeder: CitySeeder,
    private readonly companyTypeSeeder: CompanyTypeSeeder,
  ) {}

  @Post('countries')
  @ApiOperation({
    summary: 'Seed countries data',
    description: 'Populate the countries table with initial data',
  })
  @ApiResponse({
    status: 200,
    description: 'Countries seeded successfully',
  })
  async seedCountries() {
    await this.countrySeeder.seed();
    return {
      message: 'Countries seeded successfully',
    };
  }

  @Post('cities')
  @ApiOperation({
    summary: 'Seed cities data',
    description:
      'Populate the cities table with initial data. Countries must be seeded first.',
  })
  @ApiResponse({
    status: 200,
    description: 'Cities seeded successfully',
  })
  async seedCities() {
    await this.citySeeder.seed();
    return {
      message: 'Cities seeded successfully',
    };
  }

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

  @Post('company-types')
  @ApiOperation({
    summary: 'Seed company types data',
    description: 'Populate the company_types table with initial data',
  })
  @ApiResponse({
    status: 200,
    description: 'Company types seeded successfully',
  })
  async seedCompanyTypes() {
    await this.companyTypeSeeder.seed();
    return {
      message: 'Company types seeded successfully',
    };
  }

  @Post('all')
  @ApiOperation({
    summary: 'Seed all master data',
    description:
      'Populate all master data tables in the correct order (countries -> cities -> niches -> company-types)',
  })
  @ApiResponse({
    status: 200,
    description: 'All master data seeded successfully',
  })
  async seedAll() {
    await this.countrySeeder.seed();
    await this.citySeeder.seed();
    await this.nicheSeeder.seed();
    await this.companyTypeSeeder.seed();
    return {
      message: 'All master data seeded successfully',
    };
  }
}
