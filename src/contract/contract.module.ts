import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ContractController } from './contract.controller';
import { ContractService } from './contract.service';
import { ContractPdfService } from './services/contract-pdf.service';
import { ContractBreachService } from './services/contract-breach.service';
import { ContractTemplateService } from './services/contract-template.service';
import { Contract } from './models/contract.model';
import { ContractSignatory } from './models/contract-signatory.model';
import { ContractAuditLog } from './models/contract-audit-log.model';
import { UserSignature } from './models/user-signature.model';
import { ContractTemplate } from './models/contract-template.model';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [
    SequelizeModule.forFeature([Contract, ContractSignatory, ContractAuditLog, UserSignature, ContractTemplate]),
    SharedModule,
  ],
  controllers: [ContractController],
  providers: [ContractService, ContractPdfService, ContractBreachService, ContractTemplateService],
  exports: [ContractService, ContractTemplateService],
})
export class ContractModule {}
