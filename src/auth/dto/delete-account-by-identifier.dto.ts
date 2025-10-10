import {
  IsEnum,
  IsString,
  IsNotEmpty,
  ValidateIf,
  IsOptional,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

@ValidatorConstraint({ name: 'phoneNotAllowedForBrand', async: false })
class PhoneNotAllowedForBrandConstraint
  implements ValidatorConstraintInterface
{
  validate(phone: string, args: ValidationArguments) {
    const object = args.object as DeleteAccountByIdentifierDto;
    if (object.userType === 'brand' && phone !== undefined && phone !== null) {
      return false;
    }
    return true;
  }

  defaultMessage(args: ValidationArguments) {
    return 'Phone should not be provided when userType is brand';
  }
}

@ValidatorConstraint({ name: 'emailNotAllowedForInfluencer', async: false })
class EmailNotAllowedForInfluencerConstraint
  implements ValidatorConstraintInterface
{
  validate(email: string, args: ValidationArguments) {
    const object = args.object as DeleteAccountByIdentifierDto;
    if (
      object.userType === 'influencer' &&
      email !== undefined &&
      email !== null
    ) {
      return false;
    }
    return true;
  }

  defaultMessage(args: ValidationArguments) {
    return 'Email should not be provided when userType is influencer';
  }
}

export class DeleteAccountByIdentifierDto {
  @ApiProperty({
    description: 'Select user type to delete',
    enum: ['influencer', 'brand'],
    enumName: 'UserType',
    example: 'influencer',
    required: true,
  })
  @IsEnum(['influencer', 'brand'], {
    message: 'userType must be either influencer or brand',
  })
  @IsNotEmpty({ message: 'User type is required' })
  userType: 'influencer' | 'brand';

  @ApiProperty({
    description:
      'Phone number (without country code) - Required only if userType is "influencer"',
    example: '9870541151',
    required: false,
  })
  @Validate(PhoneNotAllowedForBrandConstraint, { always: true })
  @ValidateIf((o) => o.userType === 'influencer')
  @IsString({ message: 'Phone must be a string' })
  @IsNotEmpty({ message: 'Phone is required when userType is influencer' })
  phone?: string;

  @ApiProperty({
    description: 'Email address - Required only if userType is "brand"',
    example: 'testbrand@example.com',
    required: false,
  })
  @Validate(EmailNotAllowedForInfluencerConstraint, { always: true })
  @ValidateIf((o) => o.userType === 'brand')
  @IsString({ message: 'Email must be a string' })
  @IsNotEmpty({ message: 'Email is required when userType is brand' })
  email?: string;
}
