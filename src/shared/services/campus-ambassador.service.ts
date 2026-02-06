import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CampusAmbassador } from '../models/campus-ambassador.model';
import { RegisterCampusAmbassadorDto } from '../dto/campus-ambassador.dto';

@Injectable()
export class CampusAmbassadorService {
  constructor(
    @InjectModel(CampusAmbassador)
    private campusAmbassadorModel: typeof CampusAmbassador,
  ) {}

  /**
   * Generate unique ambassador ID
   * Format: CA-XXXX (e.g., CA-0001, CA-0002)
   */
  private async generateAmbassadorId(): Promise<string> {
    // Get the count of existing ambassadors
    const count = await this.campusAmbassadorModel.count();

    // Generate ID with zero-padded number
    const idNumber = (count + 1).toString().padStart(4, '0');
    const ambassadorId = `CA-${idNumber}`;

    // Check if ID already exists (edge case for concurrent requests)
    const existing = await this.campusAmbassadorModel.findOne({
      where: { ambassadorId },
    });

    if (existing) {
      // If exists, recursively generate a new one
      return this.generateAmbassadorId();
    }

    return ambassadorId;
  }

  /**
   * Register a new campus ambassador
   */
  async registerAmbassador(dto: RegisterCampusAmbassadorDto): Promise<CampusAmbassador> {
    // Add +91 prefix to phone number (user provides 10 digits, we store with +91)
    const phoneNumberWithPrefix = `+91${dto.phoneNumber}`;

    // Check if email already exists
    const existingEmail = await this.campusAmbassadorModel.findOne({
      where: { email: dto.email },
    });

    if (existingEmail) {
      throw new ConflictException('This email is already registered as a campus ambassador');
    }

    // Check if phone number already exists
    const existingPhone = await this.campusAmbassadorModel.findOne({
      where: { phoneNumber: phoneNumberWithPrefix },
    });

    if (existingPhone) {
      throw new ConflictException('This phone number is already registered as a campus ambassador');
    }

    // Generate unique ambassador ID
    const ambassadorId = await this.generateAmbassadorId();

    try {
      // Create new campus ambassador
      const ambassador = await this.campusAmbassadorModel.create({
        ambassadorId,
        name: dto.name,
        phoneNumber: phoneNumberWithPrefix,
        email: dto.email,
        collegeName: dto.collegeName,
        collegeCity: dto.collegeCity,
        collegeState: dto.collegeState,
        totalReferrals: 0,
        successfulSignups: 0,
        verifiedSignups: 0,
      });

      return ambassador;
    } catch (error) {
      // Handle unique constraint violations from database
      if (error.name === 'SequelizeUniqueConstraintError') {
        const field = error.errors?.[0]?.path || 'field';

        if (field.includes('email')) {
          throw new ConflictException('This email is already registered as a campus ambassador');
        } else if (field.includes('phone')) {
          throw new ConflictException('This phone number is already registered as a campus ambassador');
        } else if (field.includes('ambassador_id')) {
          throw new ConflictException('Ambassador ID conflict. Please try again.');
        }

        throw new ConflictException('This information is already registered');
      }

      // Re-throw other errors
      throw error;
    }
  }

  /**
   * Get all campus ambassadors
   */
  async getAllAmbassadors(
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ ambassadors: CampusAmbassador[]; total: number }> {
    const { rows, count } = await this.campusAmbassadorModel.findAndCountAll({
      limit,
      offset,
      order: [['createdAt', 'DESC']],
    });

    return {
      ambassadors: rows,
      total: count,
    };
  }

  /**
   * Get ambassador by ID
   */
  async getAmbassadorById(ambassadorId: string): Promise<CampusAmbassador> {
    const ambassador = await this.campusAmbassadorModel.findOne({
      where: { ambassadorId },
    });

    if (!ambassador) {
      throw new NotFoundException(`Campus ambassador with ID ${ambassadorId} not found`);
    }

    return ambassador;
  }

  /**
   * Get ambassador by email
   */
  async getAmbassadorByEmail(email: string): Promise<CampusAmbassador | null> {
    return this.campusAmbassadorModel.findOne({
      where: { email },
    });
  }

  /**
   * Update referral metrics
   */
  async incrementReferrals(ambassadorId: string): Promise<void> {
    const ambassador = await this.getAmbassadorById(ambassadorId);
    await ambassador.increment('totalReferrals', { by: 1 });
  }

  /**
   * Update successful signup metrics
   */
  async incrementSuccessfulSignups(ambassadorId: string): Promise<void> {
    const ambassador = await this.getAmbassadorById(ambassadorId);
    await ambassador.increment('successfulSignups', { by: 1 });
  }

  /**
   * Update verified signup metrics
   */
  async incrementVerifiedSignups(ambassadorId: string): Promise<void> {
    const ambassador = await this.getAmbassadorById(ambassadorId);
    await ambassador.increment('verifiedSignups', { by: 1 });
  }

  /**
   * Search ambassadors by college
   */
  async searchByCollege(
    collegeName?: string,
    collegeCity?: string,
    collegeState?: string,
  ): Promise<CampusAmbassador[]> {
    const where: any = {};

    if (collegeName) {
      where.collegeName = { [require('sequelize').Op.iLike]: `%${collegeName}%` };
    }
    if (collegeCity) {
      where.collegeCity = { [require('sequelize').Op.iLike]: `%${collegeCity}%` };
    }
    if (collegeState) {
      where.collegeState = { [require('sequelize').Op.iLike]: `%${collegeState}%` };
    }

    return this.campusAmbassadorModel.findAll({
      where,
      order: [['createdAt', 'DESC']],
    });
  }

  /**
   * Delete ambassador
   */
  async deleteAmbassador(ambassadorId: string): Promise<void> {
    const ambassador = await this.getAmbassadorById(ambassadorId);
    await ambassador.destroy();
  }
}
