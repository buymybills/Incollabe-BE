import {
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  Max,
  IsString,
  IsIn,
  ValidationArguments,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApplicationStatus } from '../models/campaign-application.model';
import { Gender } from '../../auth/types/gender.enum';

// Custom validator to ensure ageMin is not greater than ageMax
function IsValidAgeRange(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isValidAgeRange',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [],
      options: validationOptions,
      validator: {
        validate(_value: any, args: ValidationArguments) {
          const obj = args.object as any;
          const ageMin = obj.ageMin;
          const ageMax = obj.ageMax;

          // If both are provided, validate the range
          if (ageMin !== undefined && ageMax !== undefined) {
            return ageMin <= ageMax;
          }

          // If only one or neither is provided, validation passes
          return true;
        },
        defaultMessage(_args: ValidationArguments) {
          return 'ageMin must be less than or equal to ageMax';
        },
      },
    });
  };
}

export class GetCampaignApplicationsDto {
  @IsOptional()
  @IsEnum(ApplicationStatus)
  status?: ApplicationStatus;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsString()
  niche?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'ageMin must be a positive number' })
  @Max(150, { message: 'ageMin must be less than or equal to 150' })
  @IsValidAgeRange()
  ageMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'ageMax must be a positive number' })
  @Max(150, { message: 'ageMax must be less than or equal to 150' })
  ageMax?: number;

  @IsOptional()
  @IsString()
  platform?: string;

  @IsOptional()
  @IsString()
  experience?: string;

  @IsOptional()
  @IsString()
  @IsIn([
    'application_new_old',
    'application_old_new',
    'followers_high_low',
    'followers_low_high',
    'campaign_charges_lowest',
  ])
  sortBy?: string = 'application_new_old';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 10;
}
