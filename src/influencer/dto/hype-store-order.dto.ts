import { IsString, IsUrl, IsNotEmpty, IsOptional, ValidateIf } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SubmitProofDto {
  @ApiProperty({
    description: 'Instagram media ID from the available media list. Use this OR instagramUrl (not both). Not required for stories — upload a screenshot instead.',
    example: '18012345678901234',
    required: false,
  })
  @IsString()
  @IsOptional()
  @ValidateIf(o => !o.instagramUrl)
  @IsNotEmpty({ message: 'Either mediaId or instagramUrl is required' })
  mediaId?: string;

  @ApiProperty({
    description: 'URL of the Instagram Reel or Post. Use this OR mediaId (not both). Not required for stories — upload a screenshot instead.',
    example: 'https://www.instagram.com/reel/ABC123xyz/',
    required: false,
  })
  @IsUrl({}, { message: 'Invalid Instagram URL format' })
  @IsOptional()
  @ValidateIf(o => !o.mediaId)
  @IsNotEmpty({ message: 'Either mediaId or instagramUrl is required' })
  instagramUrl?: string;

  @ApiProperty({
    description: 'Type of content posted',
    example: 'reel',
    enum: ['reel', 'post', 'story'],
    required: true,
  })
  @IsString()
  @IsNotEmpty({ message: 'Content type is required' })
  contentType: 'reel' | 'post' | 'story';

  @ApiProperty({
    description: 'Optional notes or description about the post',
    example: 'Posted reel featuring the product with brand tag',
    required: false,
  })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class ClaimMinimumCashbackDto {
  @ApiProperty({
    description: 'Confirmation that influencer wants to claim minimum cashback without posting content',
    example: true,
    required: true,
  })
  @IsNotEmpty({ message: 'Confirmation is required' })
  confirmClaim: boolean;
}

export class SubmitProofResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({
    description: 'Order details with updated proof submission status',
    example: {
      id: 1,
      externalOrderId: 'ORD123456',
      cashbackStatus: 'processing',
      instagramProofUrl: 'https://www.instagram.com/reel/ABC123xyz/',
      proofSubmittedAt: '2026-03-10T10:00:00.000Z',
    },
  })
  data: any;

  @ApiProperty({ example: 'Proof submitted successfully. Cashback will be credited after verification.' })
  message: string;
}

export class ClaimMinimumCashbackResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({
    description: 'Order and wallet details after claiming minimum cashback',
    example: {
      order: {
        id: 1,
        externalOrderId: 'ORD123456',
        cashbackAmount: 100.00,
        cashbackStatus: 'credited',
        cashbackCreditedAt: '2026-03-10T10:00:00.000Z',
      },
      wallet: {
        balance: 1200.00,
        totalCashbackReceived: 2400.00,
      },
    },
  })
  data: any;

  @ApiProperty({ example: 'Minimum cashback of ₹100 has been credited to your wallet' })
  message: string;
}
