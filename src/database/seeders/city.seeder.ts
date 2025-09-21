import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { City } from '../../shared/models/city.model';
import { Country } from '../../shared/models/country.model';

@Injectable()
export class CitySeeder {
  constructor(
    @InjectModel(City)
    private readonly cityModel: typeof City,
    @InjectModel(Country)
    private readonly countryModel: typeof Country,
  ) {}

  async seed() {
    // Get country IDs first
    const india = await this.countryModel.findOne({ where: { code: 'IN' } });
    const usa = await this.countryModel.findOne({ where: { code: 'US' } });
    const uk = await this.countryModel.findOne({ where: { code: 'GB' } });
    const canada = await this.countryModel.findOne({ where: { code: 'CA' } });
    const australia = await this.countryModel.findOne({
      where: { code: 'AU' },
    });

    if (!india || !usa || !uk || !canada || !australia) {
      throw new Error('Countries must be seeded before cities');
    }

    const cities = [
      // Indian Cities
      { name: 'Mumbai', state: 'Maharashtra', countryId: india.id },
      { name: 'Delhi', state: 'Delhi', countryId: india.id },
      { name: 'Bangalore', state: 'Karnataka', countryId: india.id },
      { name: 'Hyderabad', state: 'Telangana', countryId: india.id },
      { name: 'Chennai', state: 'Tamil Nadu', countryId: india.id },
      { name: 'Kolkata', state: 'West Bengal', countryId: india.id },
      { name: 'Pune', state: 'Maharashtra', countryId: india.id },
      { name: 'Ahmedabad', state: 'Gujarat', countryId: india.id },
      { name: 'Jaipur', state: 'Rajasthan', countryId: india.id },
      { name: 'Surat', state: 'Gujarat', countryId: india.id },
      { name: 'Lucknow', state: 'Uttar Pradesh', countryId: india.id },
      { name: 'Kanpur', state: 'Uttar Pradesh', countryId: india.id },
      { name: 'Nagpur', state: 'Maharashtra', countryId: india.id },
      { name: 'Indore', state: 'Madhya Pradesh', countryId: india.id },
      { name: 'Thane', state: 'Maharashtra', countryId: india.id },
      { name: 'Bhopal', state: 'Madhya Pradesh', countryId: india.id },
      { name: 'Visakhapatnam', state: 'Andhra Pradesh', countryId: india.id },
      { name: 'Pimpri-Chinchwad', state: 'Maharashtra', countryId: india.id },
      { name: 'Patna', state: 'Bihar', countryId: india.id },
      { name: 'Vadodara', state: 'Gujarat', countryId: india.id },
      { name: 'Ghaziabad', state: 'Uttar Pradesh', countryId: india.id },
      { name: 'Ludhiana', state: 'Punjab', countryId: india.id },
      { name: 'Agra', state: 'Uttar Pradesh', countryId: india.id },
      { name: 'Nashik', state: 'Maharashtra', countryId: india.id },
      { name: 'Faridabad', state: 'Haryana', countryId: india.id },
      { name: 'Meerut', state: 'Uttar Pradesh', countryId: india.id },
      { name: 'Rajkot', state: 'Gujarat', countryId: india.id },
      { name: 'Kalyan-Dombivli', state: 'Maharashtra', countryId: india.id },
      { name: 'Vasai-Virar', state: 'Maharashtra', countryId: india.id },
      { name: 'Varanasi', state: 'Uttar Pradesh', countryId: india.id },
      { name: 'Srinagar', state: 'Jammu and Kashmir', countryId: india.id },
      { name: 'Dhanbad', state: 'Jharkhand', countryId: india.id },
      { name: 'Jodhpur', state: 'Rajasthan', countryId: india.id },
      { name: 'Amritsar', state: 'Punjab', countryId: india.id },
      { name: 'Raipur', state: 'Chhattisgarh', countryId: india.id },
      { name: 'Allahabad', state: 'Uttar Pradesh', countryId: india.id },
      { name: 'Coimbatore', state: 'Tamil Nadu', countryId: india.id },
      { name: 'Jabalpur', state: 'Madhya Pradesh', countryId: india.id },
      { name: 'Gwalior', state: 'Madhya Pradesh', countryId: india.id },
      { name: 'Vijayawada', state: 'Andhra Pradesh', countryId: india.id },
      { name: 'Madurai', state: 'Tamil Nadu', countryId: india.id },
      { name: 'Gurgaon', state: 'Haryana', countryId: india.id },
      { name: 'Navi Mumbai', state: 'Maharashtra', countryId: india.id },
      { name: 'Aurangabad', state: 'Maharashtra', countryId: india.id },
      { name: 'Solapur', state: 'Maharashtra', countryId: india.id },
      { name: 'Ranchi', state: 'Jharkhand', countryId: india.id },
      { name: 'Howrah', state: 'West Bengal', countryId: india.id },
      { name: 'Jalandhar', state: 'Punjab', countryId: india.id },
      { name: 'Tiruchirappalli', state: 'Tamil Nadu', countryId: india.id },
      { name: 'Bhubaneswar', state: 'Odisha', countryId: india.id },
      { name: 'Salem', state: 'Tamil Nadu', countryId: india.id },

      // US Cities
      { name: 'New York', state: 'New York', countryId: usa.id },
      { name: 'Los Angeles', state: 'California', countryId: usa.id },
      { name: 'Chicago', state: 'Illinois', countryId: usa.id },
      { name: 'Houston', state: 'Texas', countryId: usa.id },
      { name: 'Phoenix', state: 'Arizona', countryId: usa.id },
      { name: 'Philadelphia', state: 'Pennsylvania', countryId: usa.id },
      { name: 'San Antonio', state: 'Texas', countryId: usa.id },
      { name: 'San Diego', state: 'California', countryId: usa.id },
      { name: 'Dallas', state: 'Texas', countryId: usa.id },
      { name: 'San Jose', state: 'California', countryId: usa.id },
      { name: 'Austin', state: 'Texas', countryId: usa.id },
      { name: 'Jacksonville', state: 'Florida', countryId: usa.id },
      { name: 'Fort Worth', state: 'Texas', countryId: usa.id },
      { name: 'Columbus', state: 'Ohio', countryId: usa.id },
      { name: 'Charlotte', state: 'North Carolina', countryId: usa.id },
      { name: 'San Francisco', state: 'California', countryId: usa.id },
      { name: 'Indianapolis', state: 'Indiana', countryId: usa.id },
      { name: 'Seattle', state: 'Washington', countryId: usa.id },
      { name: 'Denver', state: 'Colorado', countryId: usa.id },
      {
        name: 'Washington DC',
        state: 'District of Columbia',
        countryId: usa.id,
      },

      // UK Cities
      { name: 'London', state: 'England', countryId: uk.id },
      { name: 'Birmingham', state: 'England', countryId: uk.id },
      { name: 'Liverpool', state: 'England', countryId: uk.id },
      { name: 'Nottingham', state: 'England', countryId: uk.id },
      { name: 'Sheffield', state: 'England', countryId: uk.id },
      { name: 'Bristol', state: 'England', countryId: uk.id },
      { name: 'Glasgow', state: 'Scotland', countryId: uk.id },
      { name: 'Leicester', state: 'England', countryId: uk.id },
      { name: 'Edinburgh', state: 'Scotland', countryId: uk.id },
      { name: 'Leeds', state: 'England', countryId: uk.id },
      { name: 'Cardiff', state: 'Wales', countryId: uk.id },
      { name: 'Manchester', state: 'England', countryId: uk.id },
      { name: 'Stoke-on-Trent', state: 'England', countryId: uk.id },
      { name: 'Coventry', state: 'England', countryId: uk.id },
      { name: 'Sunderland', state: 'England', countryId: uk.id },
      { name: 'Belfast', state: 'Northern Ireland', countryId: uk.id },
      { name: 'Newcastle upon Tyne', state: 'England', countryId: uk.id },
      { name: 'Plymouth', state: 'England', countryId: uk.id },
      { name: 'Southampton', state: 'England', countryId: uk.id },
      { name: 'Reading', state: 'England', countryId: uk.id },

      // Canada Cities
      { name: 'Toronto', state: 'Ontario', countryId: canada.id },
      { name: 'Montreal', state: 'Quebec', countryId: canada.id },
      { name: 'Calgary', state: 'Alberta', countryId: canada.id },
      { name: 'Ottawa', state: 'Ontario', countryId: canada.id },
      { name: 'Edmonton', state: 'Alberta', countryId: canada.id },
      { name: 'Mississauga', state: 'Ontario', countryId: canada.id },
      { name: 'Winnipeg', state: 'Manitoba', countryId: canada.id },
      { name: 'Vancouver', state: 'British Columbia', countryId: canada.id },
      { name: 'Brampton', state: 'Ontario', countryId: canada.id },
      { name: 'Hamilton', state: 'Ontario', countryId: canada.id },

      // Australia Cities
      { name: 'Sydney', state: 'New South Wales', countryId: australia.id },
      { name: 'Melbourne', state: 'Victoria', countryId: australia.id },
      { name: 'Brisbane', state: 'Queensland', countryId: australia.id },
      { name: 'Perth', state: 'Western Australia', countryId: australia.id },
      { name: 'Adelaide', state: 'South Australia', countryId: australia.id },
      { name: 'Gold Coast', state: 'Queensland', countryId: australia.id },
      { name: 'Newcastle', state: 'New South Wales', countryId: australia.id },
      {
        name: 'Canberra',
        state: 'Australian Capital Territory',
        countryId: australia.id,
      },
      { name: 'Sunshine Coast', state: 'Queensland', countryId: australia.id },
      { name: 'Wollongong', state: 'New South Wales', countryId: australia.id },
    ];

    for (const cityData of cities) {
      await this.cityModel.findOrCreate({
        where: {
          name: cityData.name,
          countryId: cityData.countryId,
        },
        defaults: cityData,
      });
    }

    console.log('✅ Cities seeded successfully');
  }
}
