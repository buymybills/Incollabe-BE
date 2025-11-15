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

// Custom validator to ensure minAge is not greater than maxAge
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
          const minAge = obj.minAge;
          const maxAge = obj.maxAge;

          // If both are provided, validate the range
          if (minAge !== undefined && maxAge !== undefined) {
            return minAge <= maxAge;
          }

          // If only one or neither is provided, validation passes
          return true;
        },
        defaultMessage(_args: ValidationArguments) {
          return 'minAge must be less than or equal to maxAge';
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
  niches?: string;

  @IsOptional()
  @IsString()
  cities?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'minAge must be a positive number' })
  @Max(150, { message: 'minAge must be less than or equal to 150' })
  @IsValidAgeRange()
  minAge?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'maxAge must be a positive number' })
  @Max(150, { message: 'maxAge must be less than or equal to 150' })
  maxAge?: number;

  @IsOptional()
  @IsString()
  platforms?: string;

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
