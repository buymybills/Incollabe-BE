import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { City } from '../../shared/models/city.model';
import { Country } from '../../shared/models/country.model';
import indianCitiesData from '../data/indian-cities-geonames.json';

@Injectable()
export class CitySeeder {
  constructor(
    @InjectModel(City)
    private readonly cityModel: typeof City,
    @InjectModel(Country)
    private readonly countryModel: typeof Country,
  ) {}

  async seed() {
    // Get all countries
    const countries = await this.countryModel.findAll();
    const countryMap = new Map();

    countries.forEach((country) => {
      countryMap.set(country.code, country.id);
    });

    if (countries.length === 0) {
      throw new Error('Countries must be seeded before cities');
    }

    // Load Indian cities from GeoNames JSON file (4911 cities)
    const indianCitiesArray = Array.isArray(indianCitiesData)
      ? indianCitiesData
      : (indianCitiesData as any).default || [];

    const indianCities = indianCitiesArray
      .filter((city: any) => city.state !== 'Unknown') // Filter out cities with unknown state
      .map((city: any) => ({
        name: city.name,
        state: city.state,
        countryId: countryMap.get('IN'),
        tier: city.tier,
      }));

    console.log(`📍 Loaded ${indianCities.length} Indian cities from GeoNames database`);

    const cities = [
      // India (IN) - 4,200+ cities loaded from GeoNames database
      // This includes all Indian states and union territories with proper tier classification
      // Source: GeoNames (population >= 10,000 OR capital cities)
      ...indianCities,

      // United States (US)
      { name: 'New York', state: 'New York', countryId: countryMap.get('US') },
      {
        name: 'Los Angeles',
        state: 'California',
        countryId: countryMap.get('US'),
      },
      { name: 'Chicago', state: 'Illinois', countryId: countryMap.get('US') },
      { name: 'Houston', state: 'Texas', countryId: countryMap.get('US') },
      { name: 'Phoenix', state: 'Arizona', countryId: countryMap.get('US') },
      {
        name: 'Philadelphia',
        state: 'Pennsylvania',
        countryId: countryMap.get('US'),
      },
      { name: 'San Antonio', state: 'Texas', countryId: countryMap.get('US') },
      {
        name: 'San Diego',
        state: 'California',
        countryId: countryMap.get('US'),
      },
      { name: 'Dallas', state: 'Texas', countryId: countryMap.get('US') },
      {
        name: 'San Jose',
        state: 'California',
        countryId: countryMap.get('US'),
      },
      { name: 'Austin', state: 'Texas', countryId: countryMap.get('US') },
      {
        name: 'Jacksonville',
        state: 'Florida',
        countryId: countryMap.get('US'),
      },
      { name: 'Fort Worth', state: 'Texas', countryId: countryMap.get('US') },
      { name: 'Columbus', state: 'Ohio', countryId: countryMap.get('US') },
      {
        name: 'Charlotte',
        state: 'North Carolina',
        countryId: countryMap.get('US'),
      },
      {
        name: 'San Francisco',
        state: 'California',
        countryId: countryMap.get('US'),
      },
      {
        name: 'Indianapolis',
        state: 'Indiana',
        countryId: countryMap.get('US'),
      },
      { name: 'Seattle', state: 'Washington', countryId: countryMap.get('US') },
      { name: 'Denver', state: 'Colorado', countryId: countryMap.get('US') },
      {
        name: 'Washington DC',
        state: 'District of Columbia',
        countryId: countryMap.get('US'),
      },

      // United Kingdom (GB)
      { name: 'London', state: 'England', countryId: countryMap.get('GB') },
      { name: 'Birmingham', state: 'England', countryId: countryMap.get('GB') },
      { name: 'Liverpool', state: 'England', countryId: countryMap.get('GB') },
      { name: 'Nottingham', state: 'England', countryId: countryMap.get('GB') },
      { name: 'Sheffield', state: 'England', countryId: countryMap.get('GB') },
      { name: 'Bristol', state: 'England', countryId: countryMap.get('GB') },
      { name: 'Glasgow', state: 'Scotland', countryId: countryMap.get('GB') },
      { name: 'Leicester', state: 'England', countryId: countryMap.get('GB') },
      { name: 'Edinburgh', state: 'Scotland', countryId: countryMap.get('GB') },
      { name: 'Leeds', state: 'England', countryId: countryMap.get('GB') },
      { name: 'Cardiff', state: 'Wales', countryId: countryMap.get('GB') },
      { name: 'Manchester', state: 'England', countryId: countryMap.get('GB') },
      {
        name: 'Stoke-on-Trent',
        state: 'England',
        countryId: countryMap.get('GB'),
      },
      { name: 'Coventry', state: 'England', countryId: countryMap.get('GB') },
      { name: 'Sunderland', state: 'England', countryId: countryMap.get('GB') },
      {
        name: 'Belfast',
        state: 'Northern Ireland',
        countryId: countryMap.get('GB'),
      },
      {
        name: 'Newcastle upon Tyne',
        state: 'England',
        countryId: countryMap.get('GB'),
      },
      { name: 'Plymouth', state: 'England', countryId: countryMap.get('GB') },
      {
        name: 'Southampton',
        state: 'England',
        countryId: countryMap.get('GB'),
      },
      { name: 'Reading', state: 'England', countryId: countryMap.get('GB') },

      // Canada (CA)
      { name: 'Toronto', state: 'Ontario', countryId: countryMap.get('CA') },
      { name: 'Montreal', state: 'Quebec', countryId: countryMap.get('CA') },
      { name: 'Calgary', state: 'Alberta', countryId: countryMap.get('CA') },
      { name: 'Ottawa', state: 'Ontario', countryId: countryMap.get('CA') },
      { name: 'Edmonton', state: 'Alberta', countryId: countryMap.get('CA') },
      {
        name: 'Mississauga',
        state: 'Ontario',
        countryId: countryMap.get('CA'),
      },
      { name: 'Winnipeg', state: 'Manitoba', countryId: countryMap.get('CA') },
      {
        name: 'Vancouver',
        state: 'British Columbia',
        countryId: countryMap.get('CA'),
      },
      { name: 'Brampton', state: 'Ontario', countryId: countryMap.get('CA') },
      { name: 'Hamilton', state: 'Ontario', countryId: countryMap.get('CA') },

      // Australia (AU)
      {
        name: 'Sydney',
        state: 'New South Wales',
        countryId: countryMap.get('AU'),
      },
      { name: 'Melbourne', state: 'Victoria', countryId: countryMap.get('AU') },
      {
        name: 'Brisbane',
        state: 'Queensland',
        countryId: countryMap.get('AU'),
      },
      {
        name: 'Perth',
        state: 'Western Australia',
        countryId: countryMap.get('AU'),
      },
      {
        name: 'Adelaide',
        state: 'South Australia',
        countryId: countryMap.get('AU'),
      },
      {
        name: 'Gold Coast',
        state: 'Queensland',
        countryId: countryMap.get('AU'),
      },
      {
        name: 'Newcastle',
        state: 'New South Wales',
        countryId: countryMap.get('AU'),
      },
      {
        name: 'Canberra',
        state: 'Australian Capital Territory',
        countryId: countryMap.get('AU'),
      },
      {
        name: 'Sunshine Coast',
        state: 'Queensland',
        countryId: countryMap.get('AU'),
      },
      {
        name: 'Wollongong',
        state: 'New South Wales',
        countryId: countryMap.get('AU'),
      },

      // Add cities for remaining countries...
      // Germany (DE)
      { name: 'Berlin', state: 'Berlin', countryId: countryMap.get('DE') },
      { name: 'Hamburg', state: 'Hamburg', countryId: countryMap.get('DE') },
      { name: 'Munich', state: 'Bavaria', countryId: countryMap.get('DE') },
      {
        name: 'Cologne',
        state: 'North Rhine-Westphalia',
        countryId: countryMap.get('DE'),
      },
      { name: 'Frankfurt', state: 'Hesse', countryId: countryMap.get('DE') },
      {
        name: 'Stuttgart',
        state: 'Baden-Württemberg',
        countryId: countryMap.get('DE'),
      },
      {
        name: 'Düsseldorf',
        state: 'North Rhine-Westphalia',
        countryId: countryMap.get('DE'),
      },
      {
        name: 'Dortmund',
        state: 'North Rhine-Westphalia',
        countryId: countryMap.get('DE'),
      },
      {
        name: 'Essen',
        state: 'North Rhine-Westphalia',
        countryId: countryMap.get('DE'),
      },
      { name: 'Leipzig', state: 'Saxony', countryId: countryMap.get('DE') },

      // France (FR)
      {
        name: 'Paris',
        state: 'Île-de-France',
        countryId: countryMap.get('FR'),
      },
      {
        name: 'Marseille',
        state: "Provence-Alpes-Côte d'Azur",
        countryId: countryMap.get('FR'),
      },
      {
        name: 'Lyon',
        state: 'Auvergne-Rhône-Alpes',
        countryId: countryMap.get('FR'),
      },
      { name: 'Toulouse', state: 'Occitanie', countryId: countryMap.get('FR') },
      {
        name: 'Nice',
        state: "Provence-Alpes-Côte d'Azur",
        countryId: countryMap.get('FR'),
      },
      {
        name: 'Nantes',
        state: 'Pays de la Loire',
        countryId: countryMap.get('FR'),
      },
      {
        name: 'Strasbourg',
        state: 'Grand Est',
        countryId: countryMap.get('FR'),
      },
      {
        name: 'Montpellier',
        state: 'Occitanie',
        countryId: countryMap.get('FR'),
      },
      {
        name: 'Bordeaux',
        state: 'Nouvelle-Aquitaine',
        countryId: countryMap.get('FR'),
      },
      {
        name: 'Lille',
        state: 'Hauts-de-France',
        countryId: countryMap.get('FR'),
      },

      // Singapore (SG)
      {
        name: 'Singapore',
        state: 'Singapore',
        countryId: countryMap.get('SG'),
      },

      // United Arab Emirates (AE)
      { name: 'Dubai', state: 'Dubai', countryId: countryMap.get('AE') },
      {
        name: 'Abu Dhabi',
        state: 'Abu Dhabi',
        countryId: countryMap.get('AE'),
      },
      { name: 'Sharjah', state: 'Sharjah', countryId: countryMap.get('AE') },

      // Japan (JP)
      { name: 'Tokyo', state: 'Tokyo', countryId: countryMap.get('JP') },
      { name: 'Osaka', state: 'Osaka', countryId: countryMap.get('JP') },
      { name: 'Yokohama', state: 'Kanagawa', countryId: countryMap.get('JP') },
      { name: 'Nagoya', state: 'Aichi', countryId: countryMap.get('JP') },
      { name: 'Sapporo', state: 'Hokkaido', countryId: countryMap.get('JP') },
      { name: 'Fukuoka', state: 'Fukuoka', countryId: countryMap.get('JP') },
      { name: 'Kobe', state: 'Hyogo', countryId: countryMap.get('JP') },
      { name: 'Kyoto', state: 'Kyoto', countryId: countryMap.get('JP') },
      { name: 'Kawasaki', state: 'Kanagawa', countryId: countryMap.get('JP') },
      { name: 'Saitama', state: 'Saitama', countryId: countryMap.get('JP') },

      // China (CN)
      { name: 'Beijing', state: 'Beijing', countryId: countryMap.get('CN') },
      { name: 'Shanghai', state: 'Shanghai', countryId: countryMap.get('CN') },
      {
        name: 'Guangzhou',
        state: 'Guangdong',
        countryId: countryMap.get('CN'),
      },
      { name: 'Shenzhen', state: 'Guangdong', countryId: countryMap.get('CN') },
      { name: 'Chengdu', state: 'Sichuan', countryId: countryMap.get('CN') },
      { name: 'Hangzhou', state: 'Zhejiang', countryId: countryMap.get('CN') },
      { name: 'Wuhan', state: 'Hubei', countryId: countryMap.get('CN') },
      { name: "Xi'an", state: 'Shaanxi', countryId: countryMap.get('CN') },
      { name: 'Nanjing', state: 'Jiangsu', countryId: countryMap.get('CN') },
      { name: 'Tianjin', state: 'Tianjin', countryId: countryMap.get('CN') },

      // Brazil (BR)
      {
        name: 'São Paulo',
        state: 'São Paulo',
        countryId: countryMap.get('BR'),
      },
      {
        name: 'Rio de Janeiro',
        state: 'Rio de Janeiro',
        countryId: countryMap.get('BR'),
      },
      {
        name: 'Brasília',
        state: 'Federal District',
        countryId: countryMap.get('BR'),
      },
      { name: 'Salvador', state: 'Bahia', countryId: countryMap.get('BR') },
      { name: 'Fortaleza', state: 'Ceará', countryId: countryMap.get('BR') },
      {
        name: 'Belo Horizonte',
        state: 'Minas Gerais',
        countryId: countryMap.get('BR'),
      },
      { name: 'Manaus', state: 'Amazonas', countryId: countryMap.get('BR') },
      { name: 'Curitiba', state: 'Paraná', countryId: countryMap.get('BR') },
      { name: 'Recife', state: 'Pernambuco', countryId: countryMap.get('BR') },
      {
        name: 'Porto Alegre',
        state: 'Rio Grande do Sul',
        countryId: countryMap.get('BR'),
      },
      // Mexico (MX)
      {
        name: 'Mexico City',
        state: 'Mexico City',
        countryId: countryMap.get('MX'),
      },
      {
        name: 'Guadalajara',
        state: 'Jalisco',
        countryId: countryMap.get('MX'),
      },
      {
        name: 'Monterrey',
        state: 'Nuevo León',
        countryId: countryMap.get('MX'),
      },
      { name: 'Puebla', state: 'Puebla', countryId: countryMap.get('MX') },
      {
        name: 'Tijuana',
        state: 'Baja California',
        countryId: countryMap.get('MX'),
      },
      { name: 'León', state: 'Guanajuato', countryId: countryMap.get('MX') },
      { name: 'Juárez', state: 'Chihuahua', countryId: countryMap.get('MX') },
      { name: 'Zapopan', state: 'Jalisco', countryId: countryMap.get('MX') },

      // Italy (IT)
      { name: 'Rome', state: 'Lazio', countryId: countryMap.get('IT') },
      { name: 'Milan', state: 'Lombardy', countryId: countryMap.get('IT') },
      { name: 'Naples', state: 'Campania', countryId: countryMap.get('IT') },
      { name: 'Turin', state: 'Piedmont', countryId: countryMap.get('IT') },
      { name: 'Palermo', state: 'Sicily', countryId: countryMap.get('IT') },
      { name: 'Genoa', state: 'Liguria', countryId: countryMap.get('IT') },
      {
        name: 'Bologna',
        state: 'Emilia-Romagna',
        countryId: countryMap.get('IT'),
      },
      { name: 'Florence', state: 'Tuscany', countryId: countryMap.get('IT') },
      { name: 'Bari', state: 'Apulia', countryId: countryMap.get('IT') },
      { name: 'Catania', state: 'Sicily', countryId: countryMap.get('IT') },

      // Spain (ES)
      { name: 'Madrid', state: 'Madrid', countryId: countryMap.get('ES') },
      {
        name: 'Barcelona',
        state: 'Catalonia',
        countryId: countryMap.get('ES'),
      },
      { name: 'Valencia', state: 'Valencia', countryId: countryMap.get('ES') },
      { name: 'Seville', state: 'Andalusia', countryId: countryMap.get('ES') },
      { name: 'Zaragoza', state: 'Aragon', countryId: countryMap.get('ES') },
      { name: 'Málaga', state: 'Andalusia', countryId: countryMap.get('ES') },
      { name: 'Murcia', state: 'Murcia', countryId: countryMap.get('ES') },
      {
        name: 'Palma',
        state: 'Balearic Islands',
        countryId: countryMap.get('ES'),
      },
      {
        name: 'Las Palmas',
        state: 'Canary Islands',
        countryId: countryMap.get('ES'),
      },
      {
        name: 'Bilbao',
        state: 'Basque Country',
        countryId: countryMap.get('ES'),
      },
      // Netherlands (NL)
      {
        name: 'Amsterdam',
        state: 'North Holland',
        countryId: countryMap.get('NL'),
      },
      {
        name: 'Rotterdam',
        state: 'South Holland',
        countryId: countryMap.get('NL'),
      },
      {
        name: 'The Hague',
        state: 'South Holland',
        countryId: countryMap.get('NL'),
      },
      { name: 'Utrecht', state: 'Utrecht', countryId: countryMap.get('NL') },
      {
        name: 'Eindhoven',
        state: 'North Brabant',
        countryId: countryMap.get('NL'),
      },

      // Sweden (SE)
      {
        name: 'Stockholm',
        state: 'Stockholm',
        countryId: countryMap.get('SE'),
      },
      {
        name: 'Gothenburg',
        state: 'Västra Götaland',
        countryId: countryMap.get('SE'),
      },
      { name: 'Malmö', state: 'Skåne', countryId: countryMap.get('SE') },
      { name: 'Uppsala', state: 'Uppsala', countryId: countryMap.get('SE') },

      // Norway (NO)
      { name: 'Oslo', state: 'Oslo', countryId: countryMap.get('NO') },
      { name: 'Bergen', state: 'Vestland', countryId: countryMap.get('NO') },
      {
        name: 'Trondheim',
        state: 'Trøndelag',
        countryId: countryMap.get('NO'),
      },
      { name: 'Stavanger', state: 'Rogaland', countryId: countryMap.get('NO') },

      // Denmark (DK)
      {
        name: 'Copenhagen',
        state: 'Capital Region',
        countryId: countryMap.get('DK'),
      },
      {
        name: 'Aarhus',
        state: 'Central Denmark',
        countryId: countryMap.get('DK'),
      },
      {
        name: 'Odense',
        state: 'Southern Denmark',
        countryId: countryMap.get('DK'),
      },
      {
        name: 'Aalborg',
        state: 'North Denmark',
        countryId: countryMap.get('DK'),
      },

      // Finland (FI)
      { name: 'Helsinki', state: 'Uusimaa', countryId: countryMap.get('FI') },
      { name: 'Espoo', state: 'Uusimaa', countryId: countryMap.get('FI') },
      { name: 'Tampere', state: 'Pirkanmaa', countryId: countryMap.get('FI') },
      { name: 'Vantaa', state: 'Uusimaa', countryId: countryMap.get('FI') },

      // Switzerland (CH)
      { name: 'Zurich', state: 'Zurich', countryId: countryMap.get('CH') },
      { name: 'Geneva', state: 'Geneva', countryId: countryMap.get('CH') },
      { name: 'Basel', state: 'Basel-Stadt', countryId: countryMap.get('CH') },
      { name: 'Bern', state: 'Bern', countryId: countryMap.get('CH') },

      // Austria (AT)
      { name: 'Vienna', state: 'Vienna', countryId: countryMap.get('AT') },
      { name: 'Graz', state: 'Styria', countryId: countryMap.get('AT') },
      { name: 'Linz', state: 'Upper Austria', countryId: countryMap.get('AT') },
      { name: 'Salzburg', state: 'Salzburg', countryId: countryMap.get('AT') },

      // Belgium (BE)
      { name: 'Brussels', state: 'Brussels', countryId: countryMap.get('BE') },
      { name: 'Antwerp', state: 'Flanders', countryId: countryMap.get('BE') },
      { name: 'Ghent', state: 'Flanders', countryId: countryMap.get('BE') },
      { name: 'Charleroi', state: 'Wallonia', countryId: countryMap.get('BE') },

      // Ireland (IE)
      { name: 'Dublin', state: 'Leinster', countryId: countryMap.get('IE') },
      { name: 'Cork', state: 'Munster', countryId: countryMap.get('IE') },
      { name: 'Galway', state: 'Connacht', countryId: countryMap.get('IE') },
      { name: 'Limerick', state: 'Munster', countryId: countryMap.get('IE') },

      // New Zealand (NZ)
      {
        name: 'Auckland',
        state: 'North Island',
        countryId: countryMap.get('NZ'),
      },
      {
        name: 'Christchurch',
        state: 'South Island',
        countryId: countryMap.get('NZ'),
      },
      {
        name: 'Wellington',
        state: 'North Island',
        countryId: countryMap.get('NZ'),
      },
      {
        name: 'Hamilton',
        state: 'North Island',
        countryId: countryMap.get('NZ'),
      },

      // South Korea (KR)
      { name: 'Seoul', state: 'Seoul', countryId: countryMap.get('KR') },
      { name: 'Busan', state: 'Busan', countryId: countryMap.get('KR') },
      { name: 'Incheon', state: 'Incheon', countryId: countryMap.get('KR') },
      { name: 'Daegu', state: 'Daegu', countryId: countryMap.get('KR') },
      { name: 'Daejeon', state: 'Daejeon', countryId: countryMap.get('KR') },
      { name: 'Gwangju', state: 'Gwangju', countryId: countryMap.get('KR') },

      // Thailand (TH)
      { name: 'Bangkok', state: 'Bangkok', countryId: countryMap.get('TH') },
      {
        name: 'Nonthaburi',
        state: 'Nonthaburi',
        countryId: countryMap.get('TH'),
      },
      {
        name: 'Nakhon Ratchasima',
        state: 'Nakhon Ratchasima',
        countryId: countryMap.get('TH'),
      },
      {
        name: 'Chiang Mai',
        state: 'Chiang Mai',
        countryId: countryMap.get('TH'),
      },
      { name: 'Hat Yai', state: 'Songkhla', countryId: countryMap.get('TH') },

      // Malaysia (MY)
      {
        name: 'Kuala Lumpur',
        state: 'Federal Territory',
        countryId: countryMap.get('MY'),
      },
      { name: 'George Town', state: 'Penang', countryId: countryMap.get('MY') },
      { name: 'Ipoh', state: 'Perak', countryId: countryMap.get('MY') },
      { name: 'Shah Alam', state: 'Selangor', countryId: countryMap.get('MY') },
      { name: 'Johor Bahru', state: 'Johor', countryId: countryMap.get('MY') },

      // Indonesia (ID)
      { name: 'Jakarta', state: 'Jakarta', countryId: countryMap.get('ID') },
      { name: 'Surabaya', state: 'East Java', countryId: countryMap.get('ID') },
      { name: 'Bandung', state: 'West Java', countryId: countryMap.get('ID') },
      { name: 'Bekasi', state: 'West Java', countryId: countryMap.get('ID') },
      {
        name: 'Medan',
        state: 'North Sumatra',
        countryId: countryMap.get('ID'),
      },

      // Philippines (PH)
      {
        name: 'Manila',
        state: 'Metro Manila',
        countryId: countryMap.get('PH'),
      },
      {
        name: 'Quezon City',
        state: 'Metro Manila',
        countryId: countryMap.get('PH'),
      },
      {
        name: 'Davao City',
        state: 'Davao Region',
        countryId: countryMap.get('PH'),
      },
      {
        name: 'Caloocan',
        state: 'Metro Manila',
        countryId: countryMap.get('PH'),
      },
      {
        name: 'Cebu City',
        state: 'Central Visayas',
        countryId: countryMap.get('PH'),
      },

      // Vietnam (VN)
      {
        name: 'Ho Chi Minh City',
        state: 'Ho Chi Minh City',
        countryId: countryMap.get('VN'),
      },
      { name: 'Hanoi', state: 'Hanoi', countryId: countryMap.get('VN') },
      { name: 'Da Nang', state: 'Da Nang', countryId: countryMap.get('VN') },
      { name: 'Can Tho', state: 'Can Tho', countryId: countryMap.get('VN') },
      // Saudi Arabia (SA)
      { name: 'Riyadh', state: 'Riyadh', countryId: countryMap.get('SA') },
      { name: 'Jeddah', state: 'Makkah', countryId: countryMap.get('SA') },
      { name: 'Mecca', state: 'Makkah', countryId: countryMap.get('SA') },
      { name: 'Medina', state: 'Al Madinah', countryId: countryMap.get('SA') },
      {
        name: 'Dammam',
        state: 'Eastern Province',
        countryId: countryMap.get('SA'),
      },

      // Qatar (QA)
      { name: 'Doha', state: 'Doha', countryId: countryMap.get('QA') },
      {
        name: 'Al Rayyan',
        state: 'Al Rayyan',
        countryId: countryMap.get('QA'),
      },
      {
        name: 'Umm Salal',
        state: 'Umm Salal',
        countryId: countryMap.get('QA'),
      },

      // Kuwait (KW)
      { name: 'Kuwait City', state: 'Kuwait', countryId: countryMap.get('KW') },
      {
        name: 'Al Ahmadi',
        state: 'Al Ahmadi',
        countryId: countryMap.get('KW'),
      },
      { name: 'Hawalli', state: 'Hawalli', countryId: countryMap.get('KW') },

      // Bahrain (BH)
      { name: 'Manama', state: 'Capital', countryId: countryMap.get('BH') },
      { name: 'Riffa', state: 'Southern', countryId: countryMap.get('BH') },
      { name: 'Muharraq', state: 'Muharraq', countryId: countryMap.get('BH') },

      // Oman (OM)
      { name: 'Muscat', state: 'Muscat', countryId: countryMap.get('OM') },
      { name: 'Salalah', state: 'Dhofar', countryId: countryMap.get('OM') },
      {
        name: 'Nizwa',
        state: 'Ad Dakhiliyah',
        countryId: countryMap.get('OM'),
      },

      // Jordan (JO)
      { name: 'Amman', state: 'Amman', countryId: countryMap.get('JO') },
      { name: 'Zarqa', state: 'Zarqa', countryId: countryMap.get('JO') },
      { name: 'Irbid', state: 'Irbid', countryId: countryMap.get('JO') },

      // Lebanon (LB)
      { name: 'Beirut', state: 'Beirut', countryId: countryMap.get('LB') },
      { name: 'Tripoli', state: 'North', countryId: countryMap.get('LB') },
      { name: 'Sidon', state: 'South', countryId: countryMap.get('LB') },

      // South Africa (ZA)
      {
        name: 'Cape Town',
        state: 'Western Cape',
        countryId: countryMap.get('ZA'),
      },
      {
        name: 'Johannesburg',
        state: 'Gauteng',
        countryId: countryMap.get('ZA'),
      },
      {
        name: 'Durban',
        state: 'KwaZulu-Natal',
        countryId: countryMap.get('ZA'),
      },
      { name: 'Pretoria', state: 'Gauteng', countryId: countryMap.get('ZA') },
      {
        name: 'Port Elizabeth',
        state: 'Eastern Cape',
        countryId: countryMap.get('ZA'),
      },

      // Nigeria (NG)
      { name: 'Lagos', state: 'Lagos', countryId: countryMap.get('NG') },
      { name: 'Kano', state: 'Kano', countryId: countryMap.get('NG') },
      { name: 'Ibadan', state: 'Oyo', countryId: countryMap.get('NG') },
      {
        name: 'Abuja',
        state: 'Federal Capital Territory',
        countryId: countryMap.get('NG'),
      },
      {
        name: 'Port Harcourt',
        state: 'Rivers',
        countryId: countryMap.get('NG'),
      },

      // Kenya (KE)
      { name: 'Nairobi', state: 'Nairobi', countryId: countryMap.get('KE') },
      { name: 'Mombasa', state: 'Mombasa', countryId: countryMap.get('KE') },
      { name: 'Kisumu', state: 'Kisumu', countryId: countryMap.get('KE') },
      { name: 'Nakuru', state: 'Nakuru', countryId: countryMap.get('KE') },

      // Egypt (EG)
      { name: 'Cairo', state: 'Cairo', countryId: countryMap.get('EG') },
      {
        name: 'Alexandria',
        state: 'Alexandria',
        countryId: countryMap.get('EG'),
      },
      { name: 'Giza', state: 'Giza', countryId: countryMap.get('EG') },
      { name: 'Luxor', state: 'Luxor', countryId: countryMap.get('EG') },

      // Morocco (MA)
      {
        name: 'Casablanca',
        state: 'Casablanca-Settat',
        countryId: countryMap.get('MA'),
      },
      {
        name: 'Rabat',
        state: 'Rabat-Salé-Kénitra',
        countryId: countryMap.get('MA'),
      },
      { name: 'Fez', state: 'Fès-Meknès', countryId: countryMap.get('MA') },
      {
        name: 'Marrakech',
        state: 'Marrakech-Safi',
        countryId: countryMap.get('MA'),
      },

      // Ghana (GH)
      {
        name: 'Accra',
        state: 'Greater Accra',
        countryId: countryMap.get('GH'),
      },
      { name: 'Kumasi', state: 'Ashanti', countryId: countryMap.get('GH') },
      { name: 'Tamale', state: 'Northern', countryId: countryMap.get('GH') },

      // Argentina (AR)
      {
        name: 'Buenos Aires',
        state: 'Buenos Aires',
        countryId: countryMap.get('AR'),
      },
      { name: 'Córdoba', state: 'Córdoba', countryId: countryMap.get('AR') },
      { name: 'Rosario', state: 'Santa Fe', countryId: countryMap.get('AR') },
      { name: 'Mendoza', state: 'Mendoza', countryId: countryMap.get('AR') },
      {
        name: 'La Plata',
        state: 'Buenos Aires',
        countryId: countryMap.get('AR'),
      },

      // Chile (CL)
      {
        name: 'Santiago',
        state: 'Santiago Metropolitan',
        countryId: countryMap.get('CL'),
      },
      {
        name: 'Valparaíso',
        state: 'Valparaíso',
        countryId: countryMap.get('CL'),
      },
      { name: 'Concepción', state: 'Biobío', countryId: countryMap.get('CL') },
      {
        name: 'Antofagasta',
        state: 'Antofagasta',
        countryId: countryMap.get('CL'),
      },

      // Colombia (CO)
      { name: 'Bogotá', state: 'Bogotá', countryId: countryMap.get('CO') },
      { name: 'Medellín', state: 'Antioquia', countryId: countryMap.get('CO') },
      {
        name: 'Cali',
        state: 'Valle del Cauca',
        countryId: countryMap.get('CO'),
      },
      {
        name: 'Barranquilla',
        state: 'Atlántico',
        countryId: countryMap.get('CO'),
      },
      { name: 'Cartagena', state: 'Bolívar', countryId: countryMap.get('CO') },

      // Peru (PE)
      { name: 'Lima', state: 'Lima', countryId: countryMap.get('PE') },
      { name: 'Arequipa', state: 'Arequipa', countryId: countryMap.get('PE') },
      {
        name: 'Trujillo',
        state: 'La Libertad',
        countryId: countryMap.get('PE'),
      },
      {
        name: 'Chiclayo',
        state: 'Lambayeque',
        countryId: countryMap.get('PE'),
      },

      // Venezuela (VE)
      {
        name: 'Caracas',
        state: 'Capital District',
        countryId: countryMap.get('VE'),
      },
      { name: 'Maracaibo', state: 'Zulia', countryId: countryMap.get('VE') },
      { name: 'Valencia', state: 'Carabobo', countryId: countryMap.get('VE') },
      { name: 'Barquisimeto', state: 'Lara', countryId: countryMap.get('VE') },

      // Ecuador (EC)
      { name: 'Quito', state: 'Pichincha', countryId: countryMap.get('EC') },
      { name: 'Guayaquil', state: 'Guayas', countryId: countryMap.get('EC') },
      { name: 'Cuenca', state: 'Azuay', countryId: countryMap.get('EC') },

      // Uruguay (UY)
      {
        name: 'Montevideo',
        state: 'Montevideo',
        countryId: countryMap.get('UY'),
      },
      { name: 'Salto', state: 'Salto', countryId: countryMap.get('UY') },
      { name: 'Paysandú', state: 'Paysandú', countryId: countryMap.get('UY') },

      // Add remaining countries with their major cities
      // Russia (RU)
      { name: 'Moscow', state: 'Moscow', countryId: countryMap.get('RU') },
      {
        name: 'Saint Petersburg',
        state: 'Saint Petersburg',
        countryId: countryMap.get('RU'),
      },
      {
        name: 'Novosibirsk',
        state: 'Novosibirsk Oblast',
        countryId: countryMap.get('RU'),
      },
      {
        name: 'Yekaterinburg',
        state: 'Sverdlovsk Oblast',
        countryId: countryMap.get('RU'),
      },

      // Turkey (TR)
      { name: 'Istanbul', state: 'Istanbul', countryId: countryMap.get('TR') },
      { name: 'Ankara', state: 'Ankara', countryId: countryMap.get('TR') },
      { name: 'Izmir', state: 'İzmir', countryId: countryMap.get('TR') },
      { name: 'Bursa', state: 'Bursa', countryId: countryMap.get('TR') },

      // Israel (IL)
      { name: 'Tel Aviv', state: 'Tel Aviv', countryId: countryMap.get('IL') },
      {
        name: 'Jerusalem',
        state: 'Jerusalem',
        countryId: countryMap.get('IL'),
      },
      { name: 'Haifa', state: 'Haifa', countryId: countryMap.get('IL') },

      // Iran (IR)
      { name: 'Tehran', state: 'Tehran', countryId: countryMap.get('IR') },
      {
        name: 'Mashhad',
        state: 'Razavi Khorasan',
        countryId: countryMap.get('IR'),
      },
      { name: 'Isfahan', state: 'Isfahan', countryId: countryMap.get('IR') },

      // Iraq (IQ)
      { name: 'Baghdad', state: 'Baghdad', countryId: countryMap.get('IQ') },
      { name: 'Basra', state: 'Basra', countryId: countryMap.get('IQ') },
      { name: 'Mosul', state: 'Nineveh', countryId: countryMap.get('IQ') },

      // Pakistan (PK)
      { name: 'Karachi', state: 'Sindh', countryId: countryMap.get('PK') },
      { name: 'Lahore', state: 'Punjab', countryId: countryMap.get('PK') },
      { name: 'Faisalabad', state: 'Punjab', countryId: countryMap.get('PK') },
      { name: 'Rawalpindi', state: 'Punjab', countryId: countryMap.get('PK') },
      {
        name: 'Islamabad',
        state: 'Islamabad Capital Territory',
        countryId: countryMap.get('PK'),
      },

      // Bangladesh (BD)
      { name: 'Dhaka', state: 'Dhaka', countryId: countryMap.get('BD') },
      {
        name: 'Chittagong',
        state: 'Chittagong',
        countryId: countryMap.get('BD'),
      },
      { name: 'Khulna', state: 'Khulna', countryId: countryMap.get('BD') },

      // Sri Lanka (LK)
      {
        name: 'Colombo',
        state: 'Western Province',
        countryId: countryMap.get('LK'),
      },
      {
        name: 'Kandy',
        state: 'Central Province',
        countryId: countryMap.get('LK'),
      },
      {
        name: 'Galle',
        state: 'Southern Province',
        countryId: countryMap.get('LK'),
      },

      // Poland (PL)
      {
        name: 'Warsaw',
        state: 'Masovian Voivodeship',
        countryId: countryMap.get('PL'),
      },
      {
        name: 'Kraków',
        state: 'Lesser Poland Voivodeship',
        countryId: countryMap.get('PL'),
      },
      {
        name: 'Gdańsk',
        state: 'Pomeranian Voivodeship',
        countryId: countryMap.get('PL'),
      },

      // Czech Republic (CZ)
      { name: 'Prague', state: 'Prague', countryId: countryMap.get('CZ') },
      {
        name: 'Brno',
        state: 'South Moravian Region',
        countryId: countryMap.get('CZ'),
      },
      {
        name: 'Ostrava',
        state: 'Moravian-Silesian Region',
        countryId: countryMap.get('CZ'),
      },

      // Hungary (HU)
      { name: 'Budapest', state: 'Budapest', countryId: countryMap.get('HU') },
      {
        name: 'Debrecen',
        state: 'Hajdú-Bihar',
        countryId: countryMap.get('HU'),
      },
      {
        name: 'Szeged',
        state: 'Csongrád-Csanád',
        countryId: countryMap.get('HU'),
      },

      // Romania (RO)
      {
        name: 'Bucharest',
        state: 'Bucharest',
        countryId: countryMap.get('RO'),
      },
      { name: 'Cluj-Napoca', state: 'Cluj', countryId: countryMap.get('RO') },
      { name: 'Timișoara', state: 'Timiș', countryId: countryMap.get('RO') },

      // Greece (GR)
      { name: 'Athens', state: 'Attica', countryId: countryMap.get('GR') },
      {
        name: 'Thessaloniki',
        state: 'Central Macedonia',
        countryId: countryMap.get('GR'),
      },
      {
        name: 'Patras',
        state: 'Western Greece',
        countryId: countryMap.get('GR'),
      },

      // Portugal (PT)
      { name: 'Lisbon', state: 'Lisbon', countryId: countryMap.get('PT') },
      { name: 'Porto', state: 'Porto', countryId: countryMap.get('PT') },
      { name: 'Braga', state: 'Braga', countryId: countryMap.get('PT') },
    ];

    // Filter out cities with undefined countryId and log warnings
    const validCities = cities.filter((city) => {
      if (city.countryId === undefined) {
        console.warn(
          `⚠️  Skipping city ${city.name} - country not found in database`,
        );
        return false;
      }
      return true;
    });

    console.log(
      `📍 Seeding ${validCities.length} cities (${cities.length - validCities.length} skipped due to missing countries)`,
    );

    for (const cityData of validCities) {
      const [city, created] = await this.cityModel.findOrCreate({
        where: {
          name: cityData.name,
          countryId: cityData.countryId,
        },
        defaults: cityData,
      });

      // If the city already exists, update it with the new data (including tier)
      if (!created) {
        await city.update(cityData);
      }
    }

    console.log('✅ Cities seeded successfully');
  }
}
