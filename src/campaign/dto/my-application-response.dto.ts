import { ApiProperty } from '@nestjs/swagger';

export class MyApplicationResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({
    example: 'applied',
    enum: ['applied', 'under_review', 'selected', 'rejected'],
  })
  status: string;

  @ApiProperty({ example: 'I am passionate about beauty...', nullable: true })
  coverLetter?: string;

  @ApiProperty({
    example: 'I propose creating 3 Instagram posts...',
    nullable: true,
  })
  proposalMessage?: string;

  @ApiProperty({ example: '2024-01-01T00:00:00Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-02T00:00:00Z', nullable: true })
  reviewedAt?: Date;

  @ApiProperty({ example: 'Good portfolio', nullable: true })
  reviewNotes?: string;

  @ApiProperty({
    type: 'object',
    properties: {
      id: { type: 'number', example: 1 },
      name: { type: 'string', example: 'Summer Fashion Campaign' },
      description: { type: 'string', example: 'Campaign description' },
      status: { type: 'string', example: 'active' },
      type: { type: 'string', example: 'paid' },
      brand: {
        type: 'object',
        properties: {
          id: { type: 'number', example: 1 },
          brandName: { type: 'string', example: 'Fashion Brand' },
          profileImage: {
            type: 'string',
            example: 'brand.jpg',
            nullable: true,
          },
        },
      },
      deliverables: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            platform: { type: 'string', example: 'instagram' },
            type: { type: 'string', example: 'instagram_post' },
            budget: { type: 'number', example: 2000 },
            quantity: { type: 'number', example: 3 },
          },
        },
      },
    },
  })
  campaign: {
    id: number;
    name: string;
    description?: string;
    status: string;
    type: string;
    brand?: {
      id: number;
      brandName: string;
      profileImage?: string;
    };
    deliverables?: Array<{
      platform: string;
      type: string;
      budget: number;
      quantity: number;
    }>;
  };
}
