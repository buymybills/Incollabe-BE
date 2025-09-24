import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Admin, AdminRole, AdminStatus } from '../../admin/models/admin.model';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AdminSeeder {
  constructor(
    @InjectModel(Admin)
    private readonly adminModel: typeof Admin,
  ) {}

  async seed(): Promise<void> {
    console.log('🔐 Seeding admin...');

    try {
      const adminData = {
        name: 'Super Administrator',
        email: 'bharti.mishra@gobuymybills.com',
        password: await bcrypt.hash('SuperAdmin@2025', 12),
        role: AdminRole.SUPER_ADMIN,
        status: AdminStatus.ACTIVE,
        permissions: [
          'user_management',
          'profile_review',
          'content_moderation',
          'system_settings',
          'analytics_access',
          'campaign_management',
          'admin_management',
        ],
      };

      const [admin, created] = await this.adminModel.findOrCreate({
        where: { email: adminData.email },
        defaults: adminData,
      });

      if (created) {
        console.log('✅ Admin seeded successfully');
      } else {
        console.log('⚠️  Admin already exists: bharti.mishra@gobuymybills.com');
      }
    } catch (error) {
      console.error('❌ Error seeding admin:', error);
      throw error;
    }
  }
}
