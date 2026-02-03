import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsNotEmpty, Length, Matches } from 'class-validator';

export class RegisterCampusAmbassadorDto {
  @ApiProperty({
    description: 'Full name of the campus ambassador',
    example: 'John Doe',
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 255)
  name: string;

  @ApiProperty({
    description: 'Phone number of the campus ambassador (10 digits)',
    example: '9876543210',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9]{10}$/, {
    message: 'Phone number must be exactly 10 digits',
  })
  phoneNumber: string;

  @ApiProperty({
    description: 'Email address of the campus ambassador',
    example: 'john.doe@college.edu',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'Name of the college/university',
    example: 'Delhi University',
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 255)
  collegeName: string;

  @ApiProperty({
    description: 'City where the college is located',
    example: 'Delhi',
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  collegeCity: string;

  @ApiProperty({
    description: 'State where the college is located',
    example: 'Delhi',
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  collegeState: string;
}

export class CampusAmbassadorResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'CA-001' })
  ambassadorId: string;

  @ApiProperty({ example: 'John Doe' })
  name: string;

  @ApiProperty({ example: '+919876543210', description: 'Phone number with +91 prefix (stored internally)' })
  phoneNumber: string;

  @ApiProperty({ example: 'john.doe@college.edu' })
  email: string;

  @ApiProperty({ example: 'Delhi University' })
  collegeName: string;

  @ApiProperty({ example: 'Delhi' })
  collegeCity: string;

  @ApiProperty({ example: 'Delhi' })
  collegeState: string;

  @ApiProperty({ example: 0 })
  totalReferrals: number;

  @ApiProperty({ example: 0 })
  successfulSignups: number;

  @ApiProperty({ example: '2026-02-03T12:00:00.000Z' })
  createdAt: Date;
}
