import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { InvitationStatus } from '../../campaign/models/campaign-invitation.model';

export class RespondInvitationDto {
  @ApiProperty({
    enum: [InvitationStatus.ACCEPTED, InvitationStatus.DECLINED],
    example: InvitationStatus.ACCEPTED,
    description: 'Response to the invitation (accepted or declined)',
  })
  @IsEnum([InvitationStatus.ACCEPTED, InvitationStatus.DECLINED])
  status: InvitationStatus.ACCEPTED | InvitationStatus.DECLINED;

  @ApiPropertyOptional({
    example: 'Thank you for the opportunity! Excited to work with you.',
    description: 'Optional message when responding (max 500 characters)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  responseMessage?: string;
}
