import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Admin, AdminStatus } from './models/admin.model';

@Injectable()
export class AdminAuthService {
  constructor(
    @InjectModel(Admin)
    private readonly adminModel: typeof Admin,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string) {
    if (!email || !password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const admin = await this.adminModel.findOne({
      where: { email },
    });

    if (!admin) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (admin.status !== AdminStatus.ACTIVE) {
      throw new UnauthorizedException('Account is inactive or suspended');
    }

    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    await admin.update({ lastLoginAt: new Date() });

    const payload = {
      sub: admin.id,
      email: admin.email,
      role: admin.role,
      type: 'admin',
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        profileImage: admin.profileImage,
      },
    };
  }

  async createAdmin(createAdminData: any) {
    const existingAdmin = await this.adminModel.findOne({
      where: { email: createAdminData.email },
    });

    if (existingAdmin) {
      throw new BadRequestException('Admin with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(createAdminData.password, 12);

    const admin = await this.adminModel.create({
      ...createAdminData,
      password: hashedPassword,
      status: AdminStatus.ACTIVE, // Set status as ACTIVE by default
    });

    return {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      status: admin.status,
      createdAt: admin.createdAt,
    };
  }

  async getAdminProfile(adminId: number) {
    const admin = await this.adminModel.findByPk(adminId, {
      attributes: [
        'id',
        'name',
        'email',
        'role',
        'status',
        'profileImage',
        'lastLoginAt',
        'createdAt',
      ],
    });

    if (!admin) {
      throw new UnauthorizedException('Admin not found');
    }

    return admin;
  }
}
