import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Niche } from '../../auth/model/niche.model';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class NicheSeeder {
  constructor(
    @InjectModel(Niche)
    private readonly nicheModel: typeof Niche,
  ) {}

  private getSvgContent(fileName: string): string {
    try {
      // Try multiple possible paths for the assets folder
      const possiblePaths = [
        path.join(__dirname, '../../assets', fileName), // dist/database/seeders -> dist/assets
        path.join(__dirname, '../../../src/assets', fileName), // dist/database/seeders -> src/assets
        path.join(process.cwd(), 'src/assets', fileName), // from project root
      ];

      for (const assetsPath of possiblePaths) {
        try {
          if (fs.existsSync(assetsPath)) {
            return fs.readFileSync(assetsPath, 'utf8');
          }
        } catch (pathError) {
          continue;
        }
      }

      console.warn(
        `Could not find SVG file: ${fileName} in any of the expected locations`,
      );
      return '';
    } catch (error) {
      console.warn(`Could not read SVG file: ${fileName}`, error);
      return '';
    }
  }

  private getPlaceholderSvg(icon: string, isLight: boolean = true): string {
    const strokeColor = isLight ? 'black' : 'white';
    return `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
  <text x="10" y="10" text-anchor="middle" dominant-baseline="middle" font-size="12" fill="${strokeColor}">${icon}</text>
</svg>`;
  }

  async seed() {
    const niches = [
      {
        name: 'Fashion',
        logoNormal:
          this.getSvgContent('Fashion.svg') ||
          this.getPlaceholderSvg('👗', true),
        logoDark:
          this.getSvgContent('Fashion-Dark.svg') ||
          this.getPlaceholderSvg('👗', false),
        description: 'Fashion, style, and clothing content',
      },
      {
        name: 'Movies',
        logoNormal:
          this.getSvgContent('Movies.svg') ||
          this.getPlaceholderSvg('🎬', true),
        logoDark:
          this.getSvgContent('Movies-Dark.svg') ||
          this.getPlaceholderSvg('🎬', false),
        description: 'Movie reviews, entertainment, and cinema content',
      },
      {
        name: 'Food',
        logoNormal:
          this.getSvgContent('Food.svg') || this.getPlaceholderSvg('🍽️', true),
        logoDark:
          this.getSvgContent('Food-Dark.svg') ||
          this.getPlaceholderSvg('🍽️', false),
        description: 'Food, cooking, and culinary content',
      },
      {
        name: 'Beauty',
        logoNormal:
          this.getSvgContent('Beauty.svg') ||
          this.getPlaceholderSvg('💄', true),
        logoDark:
          this.getSvgContent('Beauty-Dark.svg') ||
          this.getPlaceholderSvg('💄', false),
        description: 'Beauty, makeup, and skincare content',
      },
      {
        name: 'Electronics',
        logoNormal:
          this.getSvgContent('Electronics.svg') ||
          this.getPlaceholderSvg('📱', true),
        logoDark:
          this.getSvgContent('Electronics-Dark.svg') ||
          this.getPlaceholderSvg('📱', false),
        description: 'Technology, gadgets, and electronics reviews',
      },
      {
        name: 'Pets',
        logoNormal:
          this.getSvgContent('Pets.svg') || this.getPlaceholderSvg('🐾', true),
        logoDark:
          this.getSvgContent('Pets-Dark.svg') ||
          this.getPlaceholderSvg('🐾', false),
        description: 'Pet care, animal content, and veterinary advice',
      },
      {
        name: 'Home Décor',
        logoNormal:
          this.getSvgContent('Home-Decor.svg') ||
          this.getPlaceholderSvg('🏠', true),
        logoDark:
          this.getSvgContent('Home-Decor-Dark.svg') ||
          this.getPlaceholderSvg('🏠', false),
        description: 'Interior design, home improvement, and décor',
      },
      {
        name: 'Automotive',
        logoNormal:
          this.getSvgContent('Automotive.svg') ||
          this.getPlaceholderSvg('🚗', true),
        logoDark:
          this.getSvgContent('Automotive-Dark.svg') ||
          this.getPlaceholderSvg('🚗', false),
        description: 'Cars, motorcycles, and automotive content',
      },
      {
        name: 'Sports',
        logoNormal:
          this.getSvgContent('Sports.svg') ||
          this.getPlaceholderSvg('⚽', true),
        logoDark:
          this.getSvgContent('Sports-Dark.svg') ||
          this.getPlaceholderSvg('⚽', false),
        description: 'Sports, fitness, and athletic content',
      },
      {
        name: 'Fitness',
        logoNormal:
          this.getSvgContent('Fitness.svg') ||
          this.getPlaceholderSvg('💪', true),
        logoDark:
          this.getSvgContent('Fitness-Dark.svg') ||
          this.getPlaceholderSvg('💪', false),
        description: 'Fitness, workout routines, and health content',
      },
      {
        name: 'Travel',
        logoNormal:
          this.getSvgContent('Travel.svg') ||
          this.getPlaceholderSvg('✈️', true),
        logoDark:
          this.getSvgContent('Travel-Dark.svg') ||
          this.getPlaceholderSvg('✈️', false),
        description: 'Travel, adventure, and destination content',
      },
      {
        name: 'Lifestyle',
        logoNormal:
          this.getSvgContent('Lifestyle.svg') ||
          this.getPlaceholderSvg('🌟', true),
        logoDark:
          this.getSvgContent('Lifestyle-Dark.svg') ||
          this.getPlaceholderSvg('🌟', false),
        description: 'General lifestyle, wellness, and personal development',
      },
      {
        name: 'Accessories',
        logoNormal:
          this.getSvgContent('Accessories.svg') ||
          this.getPlaceholderSvg('👜', true),
        logoDark:
          this.getSvgContent('Accessories-Dark.svg') ||
          this.getPlaceholderSvg('👜', false),
        description: 'Fashion accessories, jewelry, and personal items',
      },
      {
        name: 'Real Estate',
        logoNormal:
          this.getSvgContent('Real-Estate.svg') ||
          this.getPlaceholderSvg('🏡', true),
        logoDark:
          this.getSvgContent('Real-Estate-Dark.svg') ||
          this.getPlaceholderSvg('🏡', false),
        description: 'Property, housing market, and real estate content',
      },
    ];

    for (const nicheData of niches) {
      await this.nicheModel.findOrCreate({
        where: { name: nicheData.name },
        defaults: nicheData,
      });
    }

    console.log('Niches seeded successfully');
  }
}
