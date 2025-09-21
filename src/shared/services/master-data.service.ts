import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Country } from '../models/country.model';
import { City } from '../models/city.model';
import { Region } from '../models/region.model';

@Injectable()
export class MasterDataService {
  constructor(
    @InjectModel(Country)
    private readonly countryModel: typeof Country,
    @InjectModel(City)
    private readonly cityModel: typeof City,
    @InjectModel(Region)
    private readonly regionModel: typeof Region,
  ) {}

  async getCountries() {
    return await this.countryModel.findAll({
      where: { isActive: true },
      order: [['name', 'ASC']],
      attributes: ['id', 'name', 'code'],
    });
  }

  async getCitiesByCountry(countryId: number) {
    return await this.cityModel.findAll({
      where: {
        countryId: countryId,
        isActive: true,
      },
      order: [['name', 'ASC']],
      attributes: ['id', 'name', 'state'],
      include: [
        {
          model: Country,
          attributes: ['name', 'code'],
        },
      ],
    });
  }

  async getRegions() {
    return await this.regionModel.findAll({
      where: { isActive: true },
      order: [['name', 'ASC']],
      attributes: ['id', 'name', 'code', 'description', 'countries'],
    });
  }

  async getFoundedYears() {
    const currentYear = new Date().getFullYear();
    const years: { id: number; value: number }[] = [];

    // Generate years from 1900 to current year
    for (let year = currentYear; year >= 1900; year--) {
      years.push({
        id: year,
        value: year,
      });
    }

    return years;
  }

  // Admin methods for managing master data
  async createCountry(data: { name: string; code: string }) {
    return await this.countryModel.create(data);
  }

  async createCity(data: { name: string; state?: string; countryId: number }) {
    return await this.cityModel.create(data);
  }

  async createRegion(data: {
    name: string;
    code: string;
    description?: string;
    countries: string[];
  }) {
    return await this.regionModel.create(data);
  }

  // Validation methods
  async validateCountryId(countryId: number): Promise<boolean> {
    const country = await this.countryModel.findByPk(countryId);
    return !!country && country.isActive;
  }

  async validateCityId(cityId: number, countryId?: number): Promise<boolean> {
    const where: any = { id: cityId, isActive: true };
    if (countryId) {
      where.countryId = countryId;
    }

    const city = await this.cityModel.findOne({ where });
    return !!city;
  }

  async validateRegionIds(regionIds: number[]): Promise<boolean> {
    const regions = await this.regionModel.findAll({
      where: {
        id: regionIds,
        isActive: true,
      },
    });
    return regions.length === regionIds.length;
  }
}
