import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ApproveProofDto {
  // No additional fields needed - orderId comes from URL param
}

export class RejectProofDto {
  @ApiProperty({
    description: 'Reason for rejecting the proof',
    example: 'Poor quality image, product not clearly visible',
    required: true,
  })
  @IsString()
  @IsNotEmpty({ message: 'Rejection reason is required' })
  rejectionReason!: string;
}

export class ListPendingProofsDto {
  @ApiProperty({
    description: 'Page number for pagination',
    example: 1,
    required: false,
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiProperty({
    description: 'Number of items per page',
    example: 20,
    required: false,
    default: 20,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 20;

  @ApiProperty({
    description: 'Filter by approval status',
    example: 'pending_review',
    enum: ['pending_review', 'approved', 'rejected'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['pending_review', 'approved', 'rejected'])
  status?: 'pending_review' | 'approved' | 'rejected';

  @ApiProperty({
    description: 'Filter by store ID',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  storeId?: number;
}

export class ProofApprovalResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({
    description: 'Response message',
    example: 'Proof approved successfully',
  })
  message!: string;

  @ApiProperty({
    description: 'Order details after approval/rejection',
    example: {
      orderId: 360,
      externalOrderId: 'ORD-123456',
      cashbackAmount: 899.5,
      proofApprovalStatus: 'approved',
    },
  })
  data!: any;
}
