import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Niche } from '../../auth/model/niche.model';

@Injectable()
export class NicheSeeder {
  constructor(
    @InjectModel(Niche)
    private readonly nicheModel: typeof Niche,
  ) {}

  async seed() {
    const niches = [
      {
        name: 'Fashion',
        icon: '👗',
        description: 'Fashion, style, and clothing content',
      },
      {
        name: 'Movies',
        icon: '🎬',
        description: 'Movie reviews, entertainment, and cinema content',
      },
      {
        name: 'Food',
        icon: '🍽️',
        description: 'Food, cooking, and culinary content',
      },
      {
        name: 'Beauty',
        icon: '💄',
        description: 'Beauty, makeup, and skincare content',
      },
      {
        name: 'Electronics',
        icon: '📱',
        description: 'Technology, gadgets, and electronics reviews',
      },
      {
        name: 'Pets',
        icon: '🐾',
        description: 'Pet care, animal content, and veterinary advice',
      },
      {
        name: 'Home Décor',
        icon: '🏠',
        description: 'Interior design, home improvement, and décor',
      },
      {
        name: 'Automotive',
        icon: '🚗',
        description: 'Cars, motorcycles, and automotive content',
      },
      {
        name: 'Sports',
        icon: '⚽',
        description: 'Sports, fitness, and athletic content',
      },
      {
        name: 'Fitness',
        icon: '💪',
        description: 'Fitness, workout routines, and health content',
      },
      {
        name: 'Travel',
        icon: '✈️',
        description: 'Travel, adventure, and destination content',
      },
      {
        name: 'Lifestyle',
        icon: '🌟',
        description: 'General lifestyle, wellness, and personal development',
      },
      {
        name: 'Accessories',
        icon: '👜',
        description: 'Fashion accessories, jewelry, and personal items',
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