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

  async sendPasswordResetEmail(
    email: string,
    brandName: string,
    resetUrl: string,
    resetToken: string,
  ): Promise<void> {
    const subject = 'Password Reset Request - Incollab';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset Request</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center; padding: 30px; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .reset-box { background: white; border: 2px solid #667eea; padding: 25px; text-align: center; margin: 25px 0; border-radius: 8px; }
          .reset-button { display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 15px 0; }
          .reset-button:hover { background: #5a67d8; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
          .warning { color: #dc3545; font-weight: bold; margin-top: 20px; padding: 15px; background: #f8d7da; border-radius: 5px; }
          .token-info { background: #e9ecef; padding: 15px; border-radius: 5px; margin: 15px 0; font-size: 12px; color: #6c757d; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Password Reset Request</h1>
            <p>Reset your brand account password securely</p>
          </div>
          <div class="content">
            <h2>Hello ${brandName || 'Brand Partner'},</h2>
            <p>We received a request to reset the password for your Incollab brand account associated with <strong>${email}</strong>.</p>

            <div class="reset-box">
              <h3>Reset Your Password</h3>
              <p>Click the button below to set a new password for your account:</p>
              <a href="${resetUrl}" class="reset-button">Reset Password</a>
              <p style="margin: 15px 0 5px; color: #666; font-size: 14px;">This link expires in 1 hour</p>
            </div>

            <p><strong>Security Information:</strong></p>
            <ul>
              <li>This reset link is valid for <strong>1 hour only</strong></li>
              <li>The link can only be used once</li>
              <li>If you didn't request this reset, please ignore this email</li>
              <li>For security, you'll be logged out of all devices after resetting</li>
            </ul>

            <div class="token-info">
              <strong>For API Integration:</strong><br>
              If you're using the API directly, use this reset token:<br>
              <code style="word-break: break-all;">${resetToken}</code>
            </div>

            <div class="warning">
              ⚠️ If you didn't request a password reset, please contact our support team immediately at support@incollab.com
            </div>

            <p>If the button above doesn't work, you can copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #667eea;">${resetUrl}</p>
          </div>
          <div class="footer">
            <p>© 2025 Incollab. All rights reserved.</p>
            <p>This is an automated security email, please do not reply.</p>
            <p>Need help? Contact us at <a href="mailto:support@incollab.com">support@incollab.com</a></p>
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

      console.log(`Password reset email sent to: ${email}`);
    } catch (error) {
      console.error('Failed to send password reset email:', error);
      throw new Error(`Failed to send password reset email: ${error.message}`);
    }
  }
}
