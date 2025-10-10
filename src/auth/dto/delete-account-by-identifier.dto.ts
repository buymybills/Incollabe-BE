import { IsEnum, IsString, IsNotEmpty, ValidateIf } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DeleteAccountByIdentifierDto {
  @ApiProperty({
    description: 'User type (influencer or brand)',
    enum: ['influencer', 'brand'],
    example: 'influencer',
  })
  @IsEnum(['influencer', 'brand'], {
    message: 'userType must be either influencer or brand',
  })
  @IsNotEmpty({ message: 'User type is required' })
  userType: 'influencer' | 'brand';

  @ApiProperty({
    description: 'Phone number (required for influencer)',
    example: '9870541151',
    required: false,
  })
  @ValidateIf((o) => o.userType === 'influencer')
  @IsString({ message: 'Phone must be a string' })
  @IsNotEmpty({ message: 'Phone is required for influencer' })
  phone?: string;

  @ApiProperty({
    description: 'Email address (required for brand)',
    example: 'testbrand@example.com',
    required: false,
  })
  @ValidateIf((o) => o.userType === 'brand')
  @IsString({ message: 'Email must be a string' })
  @IsNotEmpty({ message: 'Email is required for brand' })
  email?: string;
}
