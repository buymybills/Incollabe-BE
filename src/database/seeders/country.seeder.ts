import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Country } from '../../shared/models/country.model';

@Injectable()
export class CountrySeeder {
  constructor(
    @InjectModel(Country)
    private readonly countryModel: typeof Country,
  ) {}

  async seed() {
    const countries = [
      { name: 'India', code: 'IN' },
      { name: 'United States', code: 'US' },
      { name: 'United Kingdom', code: 'GB' },
      { name: 'Canada', code: 'CA' },
      { name: 'Australia', code: 'AU' },
      { name: 'Germany', code: 'DE' },
      { name: 'France', code: 'FR' },
      { name: 'Singapore', code: 'SG' },
      { name: 'United Arab Emirates', code: 'AE' },
      { name: 'Japan', code: 'JP' },
      { name: 'China', code: 'CN' },
      { name: 'Brazil', code: 'BR' },
      { name: 'Mexico', code: 'MX' },
      { name: 'Italy', code: 'IT' },
      { name: 'Spain', code: 'ES' },
      { name: 'Netherlands', code: 'NL' },
      { name: 'Sweden', code: 'SE' },
      { name: 'Norway', code: 'NO' },
      { name: 'Denmark', code: 'DK' },
      { name: 'Finland', code: 'FI' },
      { name: 'Switzerland', code: 'CH' },
      { name: 'Austria', code: 'AT' },
      { name: 'Belgium', code: 'BE' },
      { name: 'Ireland', code: 'IE' },
      { name: 'New Zealand', code: 'NZ' },
      { name: 'South Korea', code: 'KR' },
      { name: 'Thailand', code: 'TH' },
      { name: 'Malaysia', code: 'MY' },
      { name: 'Indonesia', code: 'ID' },
      { name: 'Philippines', code: 'PH' },
      { name: 'Vietnam', code: 'VN' },
      { name: 'Saudi Arabia', code: 'SA' },
      { name: 'Qatar', code: 'QA' },
      { name: 'Kuwait', code: 'KW' },
      { name: 'Bahrain', code: 'BH' },
      { name: 'Oman', code: 'OM' },
      { name: 'Jordan', code: 'JO' },
      { name: 'Lebanon', code: 'LB' },
      { name: 'South Africa', code: 'ZA' },
      { name: 'Nigeria', code: 'NG' },
      { name: 'Kenya', code: 'KE' },
      { name: 'Egypt', code: 'EG' },
      { name: 'Morocco', code: 'MA' },
      { name: 'Ghana', code: 'GH' },
      { name: 'Argentina', code: 'AR' },
      { name: 'Chile', code: 'CL' },
      { name: 'Colombia', code: 'CO' },
      { name: 'Peru', code: 'PE' },
      { name: 'Venezuela', code: 'VE' },
      { name: 'Ecuador', code: 'EC' },
      { name: 'Uruguay', code: 'UY' },
    ];

    for (const countryData of countries) {
      await this.countryModel.findOrCreate({
        where: { code: countryData.code },
        defaults: countryData,
      });
    }

    console.log('✅ Countries seeded successfully');
  }
}
