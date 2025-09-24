import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { APP_CONSTANTS } from './constants/app.constants';

// Private types for WhatsAppService
type WhatsAppTemplateMessage = {
  messaging_product: string;
  to: string;
  type: 'template';
  template: {
    name: string;
    language: { code: string };
    components: WhatsAppComponent[];
  };
};

type WhatsAppComponent = {
  type: 'body' | 'button';
  parameters?: WhatsAppParameter[];
  sub_type?: string;
  index?: string;
};

type WhatsAppParameter = {
  type: 'text';
  text: string;
};

type WhatsAppConfig = {
  apiUrl: string;
  token: string;
  phoneNumberId: string;
};

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly WHATSAPP_API_URL: string;
  private readonly WHATSAPP_TOKEN: string;
  private readonly WHATSAPP_PHONE_NUMBER_ID: string;

  constructor(private readonly configService: ConfigService) {
    this.WHATSAPP_API_URL =
      this.configService.get<string>('WHATSAPP_API_URL') ||
      'https://graph.facebook.com/v22.0';
    this.WHATSAPP_TOKEN = this.configService.get<string>('WHATSAPP_TOKEN')!;
    this.WHATSAPP_PHONE_NUMBER_ID = this.configService.get<string>(
      'WHATSAPP_PHONE_NUMBER_ID',
    )!;
  }

  async sendTemplateMessage(
    to: string,
    templateName: string,
    parameters: string[],
  ): Promise<void> {
    try {
      const formattedNumber = this.formatPhoneNumber(to);
      const payload = this.buildTemplatePayload(
        formattedNumber,
        templateName,
        parameters,
      );
      const response = await this.makeWhatsAppRequest(payload);

      this.logger.log(
        `WhatsApp message sent to ${to}, response: ${JSON.stringify(response.data)}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send WhatsApp message to ${to}`,
        error.response?.data || error.message,
      );
      // Don't throw error to prevent breaking the main flow
    }
  }

  private buildTemplatePayload(
    to: string,
    templateName: string,
    parameters: string[],
  ): WhatsAppTemplateMessage {
    return {
      messaging_product: APP_CONSTANTS.WHATSAPP.MESSAGING_PRODUCT,
      to,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: APP_CONSTANTS.WHATSAPP.LANGUAGE_CODE,
        },
        components: [
          {
            type: 'body',
            parameters: parameters.map((param) => ({
              type: 'text',
              text: param,
            })),
          },
        ],
      },
    };
  }

  private async makeWhatsAppRequest(payload: WhatsAppTemplateMessage) {
    const url = `${this.WHATSAPP_API_URL}/${this.WHATSAPP_PHONE_NUMBER_ID}/messages`;

    return axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${this.WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async sendOTP(to: string, otp: string): Promise<void> {
    try {
      const formattedNumber = this.formatPhoneNumber(to);
      const payload = this.buildOtpPayload(formattedNumber, otp);
      const response = await this.makeWhatsAppRequest(payload);

      this.logger.log(
        `WhatsApp OTP sent to ${to}, response: ${JSON.stringify(response.data)}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send WhatsApp OTP to ${to}`,
        error.response?.data || error.message,
      );
      // Don't throw error to prevent breaking the main flow
    }
  }

  private buildOtpPayload(to: string, otp: string): WhatsAppTemplateMessage {
    return {
      messaging_product: APP_CONSTANTS.WHATSAPP.MESSAGING_PRODUCT,
      to,
      type: 'template',
      template: {
        name: APP_CONSTANTS.WHATSAPP.TEMPLATE_NAMES.OTP,
        language: {
          code: APP_CONSTANTS.WHATSAPP.LANGUAGE_CODE,
        },
        components: [
          {
            type: 'body',
            parameters: [{ type: 'text', text: otp }],
          },
          {
            type: 'button',
            sub_type: 'url',
            index: '0',
            parameters: [
              { type: 'text', text: APP_CONSTANTS.WHATSAPP.BUTTON_TEXT.VERIFY },
            ],
          },
        ],
      },
    };
  }

  async sendProfileVerificationPending(
    to: string,
    name: string,
  ): Promise<void> {
    await this.sendTemplateMessage(
      to,
      APP_CONSTANTS.WHATSAPP.TEMPLATE_NAMES.PROFILE_VERIFICATION_PENDING,
      [name],
    );
  }

  async sendProfileIncomplete(
    to: string,
    name: string,
    missingFieldsCount: string,
  ): Promise<void> {
    await this.sendTemplateMessage(
      to,
      APP_CONSTANTS.WHATSAPP.TEMPLATE_NAMES.PROFILE_INCOMPLETE,
      [name, missingFieldsCount],
    );
  }

  async sendProfileVerified(to: string, name: string): Promise<void> {
    await this.sendTemplateMessage(
      to,
      APP_CONSTANTS.WHATSAPP.TEMPLATE_NAMES.PROFILE_VERIFIED,
      [name],
    );
  }

  async sendProfileRejected(
    to: string,
    name: string,
    reason: string,
  ): Promise<void> {
    await this.sendTemplateMessage(
      to,
      APP_CONSTANTS.WHATSAPP.TEMPLATE_NAMES.PROFILE_REJECTED,
      [name, reason],
    );
  }

  async sendCampaignInvitation(
    to: string,
    influencerName: string,
    campaignName: string,
    brandName: string,
    personalMessage?: string,
  ): Promise<void> {
    const parameters = [
      influencerName,
      brandName,
      campaignName,
      personalMessage ||
        'We would love to collaborate with you on this exciting campaign!',
    ];

    await this.sendTemplateMessage(
      to,
      APP_CONSTANTS.WHATSAPP.TEMPLATE_NAMES.CAMPAIGN_INVITATION ||
        'campaign_invitation',
      parameters,
    );
  }

  async sendCampaignApplicationConfirmation(
    to: string,
    influencerName: string,
    campaignName: string,
    brandName: string,
  ): Promise<void> {
    const parameters = [influencerName, campaignName, brandName];

    await this.sendTemplateMessage(
      to,
      APP_CONSTANTS.WHATSAPP.TEMPLATE_NAMES.CAMPAIGN_APPLICATION_CONFIRMATION ||
        'campaign_application_confirmation',
      parameters,
    );
  }

  private formatPhoneNumber(phoneNumber: string): string {
    // Remove any non-digit characters except +
    const cleaned = phoneNumber.replace(/[^\d+]/g, '');

    // If it already starts with +91, return as is
    if (cleaned.startsWith('+91')) {
      return cleaned.substring(1); // Remove + for WhatsApp API
    }

    // If it starts with 91, return as is
    if (cleaned.startsWith('91') && cleaned.length === 12) {
      return cleaned;
    }

    // If it's a 10-digit Indian number, add 91 prefix
    if (cleaned.length === 10 && cleaned.match(/^[6-9]/)) {
      return `91${cleaned}`;
    }

    // Return as is if we can't determine format
    return cleaned;
  }
}
