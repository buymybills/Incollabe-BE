import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  async sendBrandOtp(email: string, otp: string): Promise<void> {
    const subject = 'Your Brand Login OTP - Incollab';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Brand Login OTP</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center; padding: 30px; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .otp-box { background: white; border: 2px dashed #667eea; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
          .otp-code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 5px; margin: 10px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
          .warning { color: #dc3545; font-weight: bold; margin-top: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Brand Login Verification</h1>
            <p>Secure your brand account access</p>
          </div>
          <div class="content">
            <h2>Hello Brand Partner,</h2>
            <p>To complete your login process, please use the following One-Time Password (OTP):</p>

            <div class="otp-box">
              <p>Your OTP Code:</p>
              <div class="otp-code">${otp}</div>
              <p style="margin: 0; color: #666;">Valid for 10 minutes</p>
            </div>

            <p><strong>Important:</strong></p>
            <ul>
              <li>This OTP is valid for 10 minutes only</li>
              <li>Do not share this code with anyone</li>
              <li>If you didn't request this login, please contact support immediately</li>
            </ul>

            <div class="warning">
              ⚠️ Never share your OTP with anyone for security reasons
            </div>
          </div>
          <div class="footer">
            <p>© 2025 Incollab. All rights reserved.</p>
            <p>This is an automated message, please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await this.transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: subject,
        html: html,
      });

      console.log(`Brand OTP email sent to: ${email}`);
    } catch (error) {
      console.error('Failed to send brand OTP email:', error);
      throw new Error(`Failed to send OTP email: ${error.message}`);
    }
  }

  async sendWelcomeEmail(email: string, brandName: string): Promise<void> {
    const subject = 'Welcome to Incollab - Brand Partnership';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Cloutsy</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center; padding: 30px; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .highlight { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
          .btn { display: inline-block; background: #667eea; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome to Incollab!</h1>
            <p>Your brand partnership journey begins here</p>
          </div>
          <div class="content">
            <h2>Hello ${brandName || 'Brand Partner'},</h2>
            <p>Congratulations! Your brand account has been successfully created on Cloutsy.</p>

            <div class="highlight">
              <h3>🚀 What's Next?</h3>
              <ul>
                <li>Complete your brand profile</li>
                <li>Browse our influencer network</li>
                <li>Create your first campaign</li>
                <li>Start building meaningful partnerships</li>
              </ul>
            </div>

            <p>Our platform connects brands with authentic influencers to create impactful marketing campaigns. We're excited to help you grow your brand reach!</p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="#" class="btn">Access Brand Dashboard</a>
            </div>

            <p>If you have any questions, our support team is here to help.</p>
          </div>
          <div class="footer">
            <p>© 2025 Incollab. All rights reserved.</p>
            <p>Need help? Contact us at support@incollab.com</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await this.transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: subject,
        html: html,
      });

      console.log(`Welcome email sent to: ${email}`);
    } catch (error) {
      console.error('Failed to send welcome email:', error);
      // Don't throw error for welcome email as it's not critical
    }
  }
}