import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Brand } from '../../brand/model/brand.model';
import { Influencer } from '../../auth/model/influencer.model';
import { isReservedUsername } from '../constants/reserved-usernames';
import { Op } from 'sequelize';

@ValidatorConstraint({ name: 'IsValidUsername', async: true })
@Injectable()
export class IsValidUsernameConstraint implements ValidatorConstraintInterface {
  constructor(
    @InjectModel(Brand)
    private readonly brandModel: typeof Brand,
    @InjectModel(Influencer)
    private readonly influencerModel: typeof Influencer,
  ) {}

  async validate(
    username: string,
    args: ValidationArguments,
  ): Promise<boolean> {
    if (!username) {
      return false;
    }

    // Convert to lowercase for validation
    const normalizedUsername = username.toLowerCase();

    // 1. Check length (3-30 characters)
    if (normalizedUsername.length < 3 || normalizedUsername.length > 30) {
      return false;
    }

    // 2. Check if it starts or ends with . or _
    if (
      normalizedUsername.startsWith('.') ||
      normalizedUsername.startsWith('_') ||
      normalizedUsername.endsWith('.') ||
      normalizedUsername.endsWith('_')
    ) {
      return false;
    }

    // 3. Check for consecutive dots or underscores
    if (
      normalizedUsername.includes('..') ||
      normalizedUsername.includes('__')
    ) {
      return false;
    }

    // 4. Check if only contains valid characters (lowercase letters, numbers, dots, underscores)
    const validPattern = /^[a-z0-9._]+$/;
    if (!validPattern.test(normalizedUsername)) {
      return false;
    }

    // 5. Check if it's a reserved username
    if (isReservedUsername(normalizedUsername)) {
      return false;
    }

    // 6. Check for case-insensitive uniqueness across brands and influencers
    // Get current user ID and type from validation context if updating
    const { object } = args;
    const currentUserId = (object as any).userId;
    const currentUserType = (object as any).userType; // 'brand' or 'influencer'

    // Check if username exists in brands table (case-insensitive)
    const existingBrand = await this.brandModel.findOne({
      where: {
        username: {
          [Op.iLike]: normalizedUsername, // Case-insensitive search
        },
        ...(currentUserType === 'brand' && currentUserId
          ? { id: { [Op.ne]: currentUserId } } // Exclude current user if updating
          : {}),
      },
      attributes: ['id', 'username'], // Only select needed columns to avoid isTopBrand error
    });

    if (existingBrand) {
      return false;
    }

    // Check if username exists in influencers table (case-insensitive)
    const existingInfluencer = await this.influencerModel.findOne({
      where: {
        username: {
          [Op.iLike]: normalizedUsername, // Case-insensitive search
        },
        ...(currentUserType === 'influencer' && currentUserId
          ? { id: { [Op.ne]: currentUserId } } // Exclude current user if updating
          : {}),
      },
      attributes: ['id', 'username'], // Only select needed columns
    });

    if (existingInfluencer) {
      return false;
    }

    return true;
  }

  defaultMessage(args: ValidationArguments): string {
    const username = args.value;

    if (!username) {
      return 'Username is required';
    }

    const normalizedUsername = username.toLowerCase();

    // Provide specific error messages
    if (normalizedUsername.length < 3) {
      return 'Username too short (min 3 characters)';
    }

    if (normalizedUsername.length > 30) {
      return 'Username too long (max 30 characters)';
    }

    if (
      normalizedUsername.startsWith('.') ||
      normalizedUsername.startsWith('_')
    ) {
      return 'Cannot start with . or _';
    }

    if (normalizedUsername.endsWith('.') || normalizedUsername.endsWith('_')) {
      return 'Cannot end with . or _';
    }

    if (
      normalizedUsername.includes('..') ||
      normalizedUsername.includes('__')
    ) {
      return 'No consecutive dots or underscores';
    }

    const validPattern = /^[a-z0-9._]+$/;
    if (!validPattern.test(normalizedUsername)) {
      return 'Only letters, numbers, dots and underscores allowed';
    }

    if (isReservedUsername(normalizedUsername)) {
      return 'This username is reserved';
    }

    return 'Username already taken';
  }
}

export function IsValidUsername(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidUsernameConstraint,
    });
  };
}
