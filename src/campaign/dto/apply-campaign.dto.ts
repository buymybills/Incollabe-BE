import { IsOptional, IsString, IsNumber, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ApplyCampaignDto {
  @ApiProperty({
    description: 'Campaign ID to apply for',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  campaignId: number;

  @ApiProperty({
    description:
      'Cover letter explaining why you want to work on this campaign',
    required: false,
    example:
      'I am passionate about beauty and skincare and would love to collaborate with your brand to create authentic content that resonates with my audience.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Cover letter cannot exceed 1000 characters' })
  coverLetter?: string;

  @ApiProperty({
    description: 'Detailed proposal message with your ideas for the campaign',
    required: false,
    example:
      'I propose creating 3 Instagram posts showcasing your products in natural lighting with authentic lifestyle shots. I can also create behind-the-scenes content for stories to increase engagement.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000, {
    message: 'Proposal message cannot exceed 2000 characters',
  })
  proposalMessage?: string;
}
