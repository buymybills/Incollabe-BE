// This file is kept for potential future use but SeederService is not currently used
// The actual seeding happens via SeedController in AuthModule

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CompanyType } from '../../shared/models/company-type.model';
import { Admin } from '../../admin/models/admin.model';
import { CompanyTypeSeeder } from './company-type.seeder';
import { AdminSeeder } from './admin.seeder';

@Injectable()
export class SeederService {
  constructor(
    @InjectModel(CompanyType)
    private readonly companyTypeModel: typeof CompanyType,
    @InjectModel(Admin)
    private readonly adminModel: typeof Admin,
  ) {}

  async runAllSeeders() {
    console.log('🌱 Starting database seeding...');

    const companyTypeSeeder = new CompanyTypeSeeder(this.companyTypeModel);
    await companyTypeSeeder.seed();

    console.log('📋 Starting admin seeding...');
    const adminSeeder = new AdminSeeder(this.adminModel);
    await adminSeeder.seed();
    console.log('📋 Admin seeding completed');

    console.log('🎉 Database seeding completed successfully!');
  }
}
