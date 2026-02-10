import {
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  Max,
  IsString,
  IsIn,
  IsBoolean,
  ValidationArguments,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApplicationStatus } from '../models/campaign-application.model';
import { Gender } from '../../auth/types/gender.enum';

// Custom validator to ensure minAge is not greater than maxAge
function IsValidAgeRange(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
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

// Custom validator for comma-separated gender values
function IsValidGenderList(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isValidGenderList',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [],
      options: validationOptions,
      validator: {
        validate(value: any, _args: ValidationArguments) {
          if (!value || typeof value !== 'string') {
            return true; // Let @IsString handle this
          }

          const validGenders = Object.values(Gender).map((g) =>
            g.toLowerCase(),
          );
          const genderList = value
            .split(',')
            .map((g) => g.trim().toLowerCase())
            .filter((g) => g.length > 0);

          // Check if all values are valid gender enum values
          return genderList.every((g) => validGenders.includes(g));
        },
        defaultMessage(_args: ValidationArguments) {
          const validValues = Object.values(Gender).join(', ');
          return `Gender must be one or more of: ${validValues} (comma-separated, case-insensitive)`;
        },
      },
    });
  };
}

export class GetCampaignApplicationsDto {
  @IsOptional()
  @IsEnum(ApplicationStatus)
  status?: ApplicationStatus;

  @ApiProperty({
    description:
      'Filter by gender (single or comma-separated values). Valid values: Male, Female, Others. Example: "Male,Female" or "Male"',
    required: false,
    example: 'Male,Female',
    type: String,
  })
  @IsOptional()
  @IsString()
  @IsValidGenderList()
  gender?: string;

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

  @ApiPropertyOptional({
    description: 'Enable AI-based matchability scoring',
    example: false,
    type: Boolean,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  scoreWithAI?: boolean = false;

  @IsOptional()
  @IsString()
  @IsIn([
    'application_new_old',
    'application_old_new',
    'followers_high_low',
    'followers_low_high',
    'campaign_charges_lowest',
    'ai_score',
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
