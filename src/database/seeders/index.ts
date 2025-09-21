import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CompanyType } from '../../shared/models/company-type.model';
import { CompanyTypeSeeder } from './company-type.seeder';

@Injectable()
export class SeederService {
  constructor(
    @InjectModel(CompanyType)
    private readonly companyTypeModel: typeof CompanyType,
  ) {}

  async runAllSeeders() {
    console.log('🌱 Starting database seeding...');

    const companyTypeSeeder = new CompanyTypeSeeder(this.companyTypeModel);
    await companyTypeSeeder.seed();

    console.log('🎉 Database seeding completed successfully!');
  }
}
