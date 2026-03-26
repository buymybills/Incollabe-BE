import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { NudgeMessageTemplate } from '../../shared/models/nudge-message-template.model';

@Injectable()
export class NudgeTemplateService {
  constructor(
    @InjectModel(NudgeMessageTemplate)
    private nudgeTemplateModel: typeof NudgeMessageTemplate,
  ) {}

  /**
   * Update template status (activate/deactivate)
   */
  async updateTemplateStatus(id: number, isActive: boolean) {
    const template = await this.nudgeTemplateModel.findByPk(id);

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    const previousStatus = template.isActive;

    // No change needed
    if (template.isActive === isActive) {
      return {
        template,
        previousStatus,
        changed: false,
      };
    }

    template.isActive = isActive;
    await template.save();

    return {
      template,
      previousStatus,
      changed: true,
    };
  }
}
