import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CompanyType } from '../../shared/models/company-type.model';

@Injectable()
export class CompanyTypeSeeder {
  constructor(
    @InjectModel(CompanyType)
    private readonly companyTypeModel: typeof CompanyType,
  ) {}

  async seed() {
    const companyTypes = [
      {
        name: 'Private Limited Company (Pvt. Ltd.)',
        description:
          'A company limited by shares that offers limited liability to its shareholders',
        sortOrder: 1,
        isActive: true,
      },
      {
        name: 'Public Limited Company (PLC)',
        description:
          'A company whose shares are traded freely on a stock exchange',
        sortOrder: 2,
        isActive: true,
      },
      {
        name: 'One-Person Company (OPC)',
        description: 'A company incorporated with only one person as member',
        sortOrder: 3,
        isActive: true,
      },
      {
        name: 'Limited Liability Partnership (LLP)',
        description:
          'A partnership where some or all partners have limited liabilities',
        sortOrder: 4,
        isActive: true,
      },
      {
        name: 'Partnership Firm',
        description:
          'A business structure with two or more individuals who share ownership',
        sortOrder: 5,
        isActive: true,
      },
      {
        name: 'Sole Proprietorship',
        description: 'A business owned and operated by a single individual',
        sortOrder: 6,
        isActive: true,
      },
      {
        name: 'Section 8 Company',
        description:
          'A company incorporated for promoting commerce, art, science, sports, education, research, social welfare, religion, charity, protection of environment',
        sortOrder: 7,
        isActive: true,
      },
      {
        name: 'Joint Venture (JV)',
        description: 'A business entity created by two or more parties',
        sortOrder: 8,
        isActive: true,
      },
      {
        name: 'Foreign Company',
        description:
          'A company incorporated outside India but conducting business in India',
        sortOrder: 9,
        isActive: true,
      },
    ];

    for (const companyType of companyTypes) {
      const existingCompanyType = await this.companyTypeModel.findOne({
        where: { name: companyType.name },
      });

      if (!existingCompanyType) {
        await this.companyTypeModel.create(companyType);
        console.log(`✅ Created company type: ${companyType.name}`);
      } else {
        console.log(`⚠️  Company type already exists: ${companyType.name}`);
      }
    }

    console.log('🎉 Company type seeding completed!');
  }
}
