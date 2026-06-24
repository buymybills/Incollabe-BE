import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { InfluencerInviteCode } from '../auth/model/influencer-invite-code.model';
import { CreateInviteCodeDto } from './dto/create-invite-code.dto';

@Injectable()
export class InviteCodesService {
  constructor(
    @InjectModel(InfluencerInviteCode)
    private readonly inviteCodeModel: typeof InfluencerInviteCode,
  ) {}

  private generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'HYPE-';
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  async create(dto: CreateInviteCodeDto, adminId: number) {
    const count = dto.count ?? 1;
    const created: InfluencerInviteCode[] = [];

    for (let i = 0; i < count; i++) {
      const code = dto.code && count === 1 ? dto.code : this.generateCode();
      const record = await this.inviteCodeModel.create({
        code,
        createdBy: adminId,
        notes: dto.notes ?? null,
        isActive: true,
        totalUsed: 0,
      });
      created.push(record);
    }

    return { created, count: created.length };
  }

  async findAll() {
    return this.inviteCodeModel.findAll({
      order: [['createdAt', 'DESC']],
    });
  }

  async update(id: number, updates: { isActive: boolean }) {
    const record = await this.inviteCodeModel.findByPk(id);
    if (!record) throw new NotFoundException('Invite code not found');
    await record.update(updates);
    return record;
  }

  async remove(id: number) {
    const record = await this.inviteCodeModel.findByPk(id);
    if (!record) throw new NotFoundException('Invite code not found');
    await record.destroy();
    return { message: 'Deleted successfully' };
  }
}
