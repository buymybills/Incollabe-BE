import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsEnum, IsNumber } from 'class-validator';
import { Transform } from 'class-transformer';

export enum FollowUserType {
  INFLUENCER = 'influencer',
  BRAND = 'brand',
}

export class FollowDto {
  @ApiProperty({
    description: 'Type of user to follow',
    enum: FollowUserType,
    example: FollowUserType.INFLUENCER,
  })
  @IsNotEmpty()
  @IsEnum(FollowUserType)
  userType: FollowUserType;

  @ApiProperty({
    description: 'ID of the user to follow',
    example: 1,
  })
  @IsNotEmpty()
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  userId: number;
}
