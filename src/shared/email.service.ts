import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from './services/logger.service';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(
    private readonly configService: ConfigService,
    private readonly loggerService: LoggerService,
  ) {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  async sendBrandOtp(email: string, otp: string): Promise<void> {
    const subject = 'Your Brand Login OTP - Collabkaroo';

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
            <p>© 2025 Collabkaroo. All rights reserved.</p>
            <p>This is an automated message, please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    this.loggerService.logEmail('BRAND_OTP_EMAIL_SENDING', {
      to: email,
      subject,
      action: 'sendBrandOtp',
    });

    // Send email asynchronously without blocking
    this.transporter
      .sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: subject,
        html: html,
      })
      .then(() => {
        this.loggerService.logEmail('BRAND_OTP_EMAIL_SENT', {
          to: email,
          subject,
          success: true,
        });
      })
      .catch((error) => {
        this.loggerService.logEmail('BRAND_OTP_EMAIL_FAILED', {
          to: email,
          subject,
          success: false,
          error: error.message,
        });
        console.error(`Failed to send brand OTP email to ${email}:`, error);
      });
  }

  async sendWelcomeEmail(email: string, brandName: string): Promise<void> {
    const subject = 'Welcome to Collabkaroo - Brand Partnership';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Collabkaroo</title>
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
            <h1>🎉 Welcome to Collabkaroo!</h1>
            <p>Your brand partnership journey begins here</p>
          </div>
          <div class="content">
            <h2>Hello ${brandName || 'Brand Partner'},</h2>
            <p>Congratulations! Your brand account has been successfully created on Collabkaroo.</p>

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
            <p>© 2025 Collabkaroo. All rights reserved.</p>
            <p>Need help? Contact us at support@collabkaroo.com</p>
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
    const subject = 'Password Reset Request - Collabkaroo';

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
            <p>We received a request to reset the password for your Collabkaroo brand account associated with <strong>${email}</strong>.</p>

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
              ⚠️ If you didn't request a password reset, please contact our support team immediately at support@collabkaroo.com
            </div>

            <p>If the button above doesn't work, you can copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #667eea;">${resetUrl}</p>
          </div>
          <div class="footer">
            <p>© 2025 Collabkaroo. All rights reserved.</p>
            <p>This is an automated security email, please do not reply.</p>
            <p>Need help? Contact us at <a href="mailto:support@collabkaroo.com">support@collabkaroo.com</a></p>
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

  async sendProfileVerificationPendingEmail(
    email: string,
    brandName: string,
  ): Promise<void> {
    const subject = 'Profile Submitted for Verification - Collabkaroo';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Profile Verification Pending</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center; padding: 30px; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .status-box { background: #fff3cd; border: 2px solid #ffc107; padding: 25px; text-align: center; margin: 25px 0; border-radius: 8px; }
          .status-icon { font-size: 48px; margin-bottom: 15px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
          .timeline { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
          .timeline-item { margin: 15px 0; display: flex; align-items: center; }
          .timeline-step { width: 30px; height: 30px; border-radius: 50%; background: #667eea; color: white; display: flex; align-items: center; justify-content: center; margin-right: 15px; font-weight: bold; }
          .timeline-step.completed { background: #28a745; }
          .timeline-step.current { background: #ffc107; color: #333; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔍 Profile Verification Pending</h1>
            <p>Your brand profile has been submitted for review</p>
          </div>
          <div class="content">
            <h2>Hello ${brandName || 'Brand Partner'},</h2>
            <p>Congratulations! You have successfully completed your brand profile on Collabkaroo. Your profile has been submitted for verification and is now under review by our team.</p>

            <div class="status-box">
              <div class="status-icon">⏳</div>
              <h3 style="margin: 0; color: #856404;">Profile Verification in Progress</h3>
              <p style="margin: 10px 0 0; color: #856404;">Expected completion: 2-3 business days</p>
            </div>

            <div class="timeline">
              <h3>Verification Process:</h3>
              <div class="timeline-item">
                <div class="timeline-step completed">✓</div>
                <span><strong>Profile Submitted</strong> - All required information and documents provided</span>
              </div>
              <div class="timeline-item">
                <div class="timeline-step current">2</div>
                <span><strong>Document Review</strong> - Our team is verifying your business documents</span>
              </div>
              <div class="timeline-item">
                <div class="timeline-step">3</div>
                <span><strong>Profile Approval</strong> - Account activation and full platform access</span>
              </div>
            </div>

            <p><strong>What happens next?</strong></p>
            <ul>
              <li>Our verification team will review your business documents</li>
              <li>We may contact you if additional information is needed</li>
              <li>You'll receive an email confirmation once verification is complete</li>
              <li>Full access to create campaigns and collaborate with influencers</li>
            </ul>

            <p><strong>During verification:</strong></p>
            <ul>
              <li>You can still browse influencer profiles</li>
              <li>Update your profile information if needed</li>
              <li>Prepare your first campaign strategy</li>
            </ul>

            <p>Thank you for choosing Collabkaroo! We're excited to help you connect with amazing influencers once your verification is complete.</p>
          </div>
          <div class="footer">
            <p>© 2025 Collabkaroo. All rights reserved.</p>
            <p>Questions? Contact us at <a href="mailto:support@collabkaroo.com">support@collabkaroo.com</a></p>
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

      console.log(`Profile verification pending email sent to: ${email}`);
    } catch (error) {
      console.error(
        'Failed to send profile verification pending email:',
        error,
      );
      // Don't throw error as this is not critical for the flow
    }
  }

  async sendBrandProfileIncompleteEmail(
    email: string,
    brandName: string,
    missingFields: string[],
    nextSteps: string[],
  ): Promise<void> {
    const subject =
      'Complete Your Brand Profile - Missing Information Required - Collabkaroo';

    const missingFieldsList = missingFields
      .map((field) => `<li>${field}</li>`)
      .join('');
    const nextStepsList = nextSteps.map((step) => `<li>${step}</li>`).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Complete Your Profile</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #f39c12 0%, #e67e22 100%); color: white; text-align: center; padding: 30px; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .alert-box { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .missing-fields { background: white; border-left: 4px solid #e74c3c; padding: 15px; margin: 15px 0; border-radius: 4px; }
          .next-steps { background: white; border-left: 4px solid #3498db; padding: 15px; margin: 15px 0; border-radius: 4px; }
          .cta-button { display: inline-block; background: #e67e22; color: white; text-decoration: none; padding: 15px 30px; border-radius: 5px; font-weight: bold; margin: 20px 0; }
          .cta-button:hover { background: #d35400; }
          ul { margin: 10px 0; padding-left: 20px; }
          li { margin: 8px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📋 Profile Completion Required</h1>
            <p>Complete your profile to submit for verification</p>
          </div>
          <div class="content">
            <h2>Hello ${brandName || 'Brand Partner'},</h2>
            <p>Thank you for updating your brand profile! We're excited to have you on Collabkaroo.</p>

            <div class="alert-box">
              <h3>⚠️ Profile Incomplete</h3>
              <p>Your profile is almost ready, but we need a few more details before you can submit it for verification.</p>
            </div>

            <div class="missing-fields">
              <h3>Missing Required Information:</h3>
              <ul>
                ${missingFieldsList}
              </ul>
            </div>

            <div class="next-steps">
              <h3>Next Steps:</h3>
              <ul>
                ${nextStepsList}
              </ul>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'https://collabkaroo.com'}/brand/profile" class="cta-button">
                Complete Profile →
              </a>
            </div>

            <p><strong>Why is profile completion important?</strong></p>
            <ul>
              <li>Enables full access to our platform features</li>
              <li>Builds trust with potential influencer partners</li>
              <li>Ensures compliance with our verification standards</li>
              <li>Unlocks campaign creation and collaboration tools</li>
            </ul>

            <p><strong>Need help?</strong> Our support team is here to assist you with completing your profile.</p>
          </div>
          <div class="footer">
            <p>© 2025 Collabkaroo. All rights reserved.</p>
            <p>This email was sent because you recently updated your brand profile.</p>
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

      console.log(`Profile incomplete email sent to: ${email}`);
    } catch (error) {
      console.error('Failed to send profile incomplete email:', error);
      // Don't throw error as this is not critical for the flow
    }
  }

  async sendInfluencerProfileVerificationPendingEmail(
    phone: string,
    influencerName: string,
  ): Promise<void> {
    const subject =
      'Profile Submitted for Verification - Collabkaroo Influencer';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Profile Verification Pending</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center; padding: 30px; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .success-box { background: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px; padding: 20px; margin: 20px 0; color: #155724; }
          .timeline { margin: 20px 0; }
          .timeline-item { display: flex; align-items: center; margin: 15px 0; }
          .timeline-step { width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 15px; font-weight: bold; }
          .timeline-step.completed { background: #28a745; color: white; }
          .timeline-step.current { background: #ffc107; color: #212529; }
          .timeline-step { background: #e9ecef; color: #6c757d; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Profile Verification in Progress</h1>
            <p>Your influencer profile has been submitted for verification</p>
          </div>
          <div class="content">
            <h2>Hello ${influencerName},</h2>
            <p>Congratulations! Your influencer profile has been successfully submitted for verification.</p>

            <div class="success-box">
              <h3>✅ Profile Submitted Successfully</h3>
              <p>All required information has been provided and your profile is now under review by our team.</p>
            </div>

            <h3>Verification Process Timeline:</h3>
            <div class="timeline">
              <div class="timeline-item">
                <div class="timeline-step completed">✓</div>
                <span><strong>Profile Submitted</strong> - All required information and social media links provided</span>
              </div>
              <div class="timeline-item">
                <div class="timeline-step current">2</div>
                <span><strong>Profile Review</strong> - Our team is verifying your social media presence and content</span>
              </div>
              <div class="timeline-item">
                <div class="timeline-step">3</div>
                <span><strong>Account Activation</strong> - Full access to brand collaboration opportunities</span>
              </div>
            </div>

            <p><strong>What happens next?</strong></p>
            <ul>
              <li>Our team will review your social media profiles and content quality</li>
              <li>We'll verify your audience engagement and authenticity</li>
              <li>You'll receive a notification within 48 hours once verification is complete</li>
              <li>Access to browse and apply for brand collaboration campaigns</li>
            </ul>

            <p><strong>Expected Timeline:</strong> 24-48 hours</p>

            <p>Thank you for joining Collabkaroo! We're excited to help you connect with amazing brands.</p>
          </div>
          <div class="footer">
            <p>© 2025 Collabkaroo. All rights reserved.</p>
            <p>This notification was sent to your registered phone number: ${phone}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      // Note: For influencers, we might want to send SMS instead of email
      // For now, using email but we should implement SMS service
      await this.transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: `${phone}@sms.gateway.com`, // This would be SMS gateway
        subject: subject,
        html: html,
      });

      console.log(
        `Influencer profile verification pending notification sent to: ${phone}`,
      );
    } catch (error) {
      console.error(
        'Failed to send influencer profile verification pending notification:',
        error,
      );
      // Don't throw error as this is not critical for the flow
    }
  }

  async sendInfluencerProfileIncompleteEmail(
    phone: string,
    influencerName: string,
    missingFields: string[],
    nextSteps: string[],
  ): Promise<void> {
    const subject =
      'Complete Your Influencer Profile - Missing Information - Collabkaroo';

    const missingFieldsList = missingFields
      .map((field) => `<li>${field}</li>`)
      .join('');
    const nextStepsList = nextSteps.map((step) => `<li>${step}</li>`).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Complete Your Influencer Profile</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #f39c12 0%, #e67e22 100%); color: white; text-align: center; padding: 30px; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .alert-box { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .missing-fields { background: white; border-left: 4px solid #e74c3c; padding: 15px; margin: 15px 0; border-radius: 4px; }
          .next-steps { background: white; border-left: 4px solid #3498db; padding: 15px; margin: 15px 0; border-radius: 4px; }
          .cta-button { display: inline-block; background: #e67e22; color: white; text-decoration: none; padding: 15px 30px; border-radius: 5px; font-weight: bold; margin: 20px 0; }
          ul { margin: 10px 0; padding-left: 20px; }
          li { margin: 8px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📱 Complete Your Influencer Profile</h1>
            <p>Finish your profile to start collaborating with brands</p>
          </div>
          <div class="content">
            <h2>Hello ${influencerName},</h2>
            <p>Thank you for updating your influencer profile! You're almost ready to start collaborating with amazing brands.</p>

            <div class="alert-box">
              <h3>⚠️ Profile Incomplete</h3>
              <p>We need a few more details to complete your verification and unlock brand collaboration opportunities.</p>
            </div>

            <div class="missing-fields">
              <h3>Missing Required Information:</h3>
              <ul>
                ${missingFieldsList}
              </ul>
            </div>

            <div class="next-steps">
              <h3>Next Steps:</h3>
              <ul>
                ${nextStepsList}
              </ul>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'https://collabkaroo.com'}/influencer/profile" class="cta-button">
                Complete Profile →
              </a>
            </div>

            <p><strong>Why complete your profile?</strong></p>
            <ul>
              <li>Get discovered by top brands looking for influencers like you</li>
              <li>Set your own collaboration rates and terms</li>
              <li>Access exclusive campaign opportunities</li>
              <li>Build long-term partnerships with brands</li>
            </ul>

            <p><strong>Need help?</strong> Our team is here to guide you through the process!</p>
          </div>
          <div class="footer">
            <p>© 2025 Collabkaroo. All rights reserved.</p>
            <p>This notification was sent to your registered phone number: ${phone}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      // Note: For influencers, we might want to send SMS instead of email
      await this.transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: `${phone}@sms.gateway.com`, // This would be SMS gateway
        subject: subject,
        html: html,
      });

      console.log(
        `Influencer profile incomplete notification sent to: ${phone}`,
      );
    } catch (error) {
      console.error(
        'Failed to send influencer profile incomplete notification:',
        error,
      );
      // Don't throw error as this is not critical for the flow
    }
  }

  async sendBrandProfileApprovedEmail(
    email: string,
    name: string,
  ): Promise<void> {
    try {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Profile Verification Approved</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #fff; padding: 30px; border: 1px solid #dee2e6; }
            .footer { background: #f8f9fa; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; color: #6c757d; }
            .success { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 15px; border-radius: 4px; margin: 15px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Profile Verification Approved!</h1>
            </div>
            <div class="content">
              <p>Dear ${name},</p>
              <div class="success">
                <strong>Congratulations!</strong><br>
                Your brand profile has been successfully verified and approved.
              </div>
              <p>You can now access all features of our platform and start connecting with influencers for collaborations.</p>
              <p>Welcome to the Collabkaroo community!</p>
              <p>Best regards,<br>The Collabkaroo Team</p>
            </div>
            <div class="footer">
              <p>This is an automated message. Please do not reply to this email.</p>
              <p>&copy; 2024 Collabkaroo. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await this.transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: '🎉 Profile Verification Approved - Welcome to Collabkaroo!',
        html: htmlContent,
      });

      console.log(`Profile approval email sent to brand: ${email}`);
    } catch (error) {
      console.error(`Failed to send profile approval email to ${email}`, error);
    }
  }

  async sendBrandProfileRejectedEmail(
    email: string,
    name: string,
    reason: string,
  ): Promise<void> {
    try {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Profile Verification - Action Required</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #fff; padding: 30px; border: 1px solid #dee2e6; }
            .footer { background: #f8f9fa; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; color: #6c757d; }
            .alert { background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; padding: 15px; border-radius: 4px; margin: 15px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Profile Verification Update</h1>
            </div>
            <div class="content">
              <p>Dear ${name},</p>
              <div class="alert">
                <strong>Profile Verification Rejected</strong><br>
                Your brand profile verification has been rejected and requires attention.
              </div>
              <p><strong>Rejection Reason:</strong></p>
              <p>${reason}</p>
              <p>Please review the feedback and update your profile accordingly. Once you've made the necessary changes, you can resubmit your profile for verification.</p>
              <p>If you have any questions about the rejection reason or need assistance updating your profile, please contact our support team.</p>
              <p>Best regards,<br>The Collabkaroo Team</p>
            </div>
            <div class="footer">
              <p>This is an automated message. Please do not reply to this email.</p>
              <p>&copy; 2024 Collabkaroo. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await this.transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Profile Verification Rejected - Action Required',
        html: htmlContent,
      });

      console.log(`Profile rejection email sent to brand: ${email}`);
    } catch (error) {
      console.error(
        `Failed to send profile rejection email to ${email}`,
        error,
      );
    }
  }

  async sendInfluencerProfileApprovedEmail(
    phone: string,
    name: string,
  ): Promise<void> {
    try {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Profile Verification Approved</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #fff; padding: 30px; border: 1px solid #dee2e6; }
            .footer { background: #f8f9fa; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; color: #6c757d; }
            .success { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 15px; border-radius: 4px; margin: 15px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Profile Verification Approved!</h1>
            </div>
            <div class="content">
              <p>Dear ${name},</p>
              <div class="success">
                <strong>Congratulations!</strong><br>
                Your influencer profile has been successfully verified and approved.
              </div>
              <p>You can now access all features of our platform and start connecting with brands for collaborations.</p>
              <p>Welcome to the Collabkaroo community!</p>
              <p>Best regards,<br>The Collabkaroo Team</p>
            </div>
            <div class="footer">
              <p>This is an automated message. Please do not reply to this email.</p>
              <p>&copy; 2024 Collabkaroo. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await this.transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: phone, // Using phone as identifier for influencers
        subject: '🎉 Profile Verification Approved - Welcome to Collabkaroo!',
        html: htmlContent,
      });

      console.log(`Profile approval email sent to influencer: ${phone}`);
    } catch (error) {
      console.error(`Failed to send profile approval email to ${phone}`, error);
    }
  }

  async sendInfluencerProfileRejectedEmail(
    phone: string,
    name: string,
    reason: string,
  ): Promise<void> {
    try {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Profile Verification - Action Required</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #fff; padding: 30px; border: 1px solid #dee2e6; }
            .footer { background: #f8f9fa; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; color: #6c757d; }
            .alert { background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; padding: 15px; border-radius: 4px; margin: 15px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Profile Verification Update</h1>
            </div>
            <div class="content">
              <p>Dear ${name},</p>
              <div class="alert">
                <strong>Profile Verification Rejected</strong><br>
                Your influencer profile verification has been rejected and requires attention.
              </div>
              <p><strong>Rejection Reason:</strong></p>
              <p>${reason}</p>
              <p>Please review the feedback and update your profile accordingly. Once you've made the necessary changes, you can resubmit your profile for verification.</p>
              <p>If you have any questions about the rejection reason or need assistance updating your profile, please contact our support team.</p>
              <p>Best regards,<br>The Collabkaroo Team</p>
            </div>
            <div class="footer">
              <p>This is an automated message. Please do not reply to this email.</p>
              <p>&copy; 2024 Collabkaroo. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await this.transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: phone, // Using phone as identifier for influencers
        subject: 'Profile Verification Rejected - Action Required',
        html: htmlContent,
      });

      console.log(`Profile rejection email sent to influencer: ${phone}`);
    } catch (error) {
      console.error(
        `Failed to send profile rejection email to ${phone}`,
        error,
      );
    }
  }

  async sendAdminProfilePendingNotification(
    adminEmail: string,
    adminName: string,
    profileType: string,
    profileName: string,
    profileIdentifier: string,
    profileId: number,
  ): Promise<void> {
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>New Profile Pending Verification</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #fff; padding: 30px; border: 1px solid #dee2e6; }
            .footer { background: #f8f9fa; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; color: #6c757d; }
            .info { background: #d1ecf1; border: 1px solid #bee5eb; color: #0c5460; padding: 15px; border-radius: 4px; margin: 15px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📋 New Profile Pending Verification</h1>
            </div>
            <div class="content">
              <p>Dear ${adminName},</p>
              <div class="info">
                <strong>A new ${profileType} profile is pending verification</strong>
              </div>
              <p><strong>Profile Details:</strong></p>
              <ul>
                <li><strong>Name:</strong> ${profileName}</li>
                <li><strong>Type:</strong> ${profileType.charAt(0).toUpperCase() + profileType.slice(1)}</li>
                <li><strong>Identifier:</strong> ${profileIdentifier}</li>
                <li><strong>Profile ID:</strong> ${profileId}</li>
              </ul>
              <p>Please review this profile at your earliest convenience by logging into the admin panel.</p>
              <p>Best regards,<br>Collabkaroo Admin System</p>
            </div>
            <div class="footer">
              <p>This is an automated admin notification.</p>
              <p>&copy; 2024 Collabkaroo. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

    await this.transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: adminEmail,
      subject: `🔔 New ${profileType.charAt(0).toUpperCase() + profileType.slice(1)} Profile Pending Verification`,
      html: htmlContent,
    });

    console.log(
      `Admin notification email sent to: ${adminEmail} for ${profileType} profile ${profileId}`,
    );
  }

  /**
   * Send OTP for admin login (2FA)
   */
  /**
   * Send Max Campaign invoice email to brand
   */
  async sendMaxCampaignInvoiceEmail(
    email: string,
    brandName: string,
    invoiceNumber: string,
    amount: number,
    invoiceUrl: string,
    campaignName: string,
  ): Promise<void> {
    const subject = `Max Campaign Invoice - ${invoiceNumber} - CollabKaroo`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Max Campaign Invoice</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center; padding: 30px; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .invoice-box { background: white; border: 2px solid #667eea; padding: 25px; margin: 25px 0; border-radius: 8px; }
          .invoice-details { margin: 20px 0; }
          .invoice-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e9ecef; }
          .invoice-row.total { font-weight: bold; font-size: 18px; color: #667eea; border-top: 2px solid #667eea; border-bottom: none; margin-top: 10px; }
          .download-button { display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
          .download-button:hover { background: #5a67d8; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
          .success-badge { background: #d4edda; color: #155724; padding: 10px 20px; border-radius: 5px; display: inline-block; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Payment Successful!</h1>
            <p>Your Max Campaign has been activated</p>
          </div>
          <div class="content">
            <h2>Hello ${brandName},</h2>
            <p>Thank you for upgrading your campaign <strong>"${campaignName}"</strong> to a Max Campaign!</p>

            <div class="success-badge">
              ✅ Payment Confirmed - Your campaign is now live for Pro influencers
            </div>

            <div class="invoice-box">
              <h3>📄 Invoice Details</h3>
              <div class="invoice-details">
                <div class="invoice-row">
                  <span>Invoice Number:</span>
                  <strong>${invoiceNumber}</strong>
                </div>
                <div class="invoice-row">
                  <span>Campaign:</span>
                  <span>${campaignName}</span>
                </div>
                <div class="invoice-row">
                  <span>Service:</span>
                  <span>Max Campaign - Brand</span>
                </div>
                <div class="invoice-row total">
                  <span>Amount Paid:</span>
                  <span>₹${amount.toFixed(2)}</span>
                </div>
              </div>

              <div style="text-align: center; margin-top: 25px;">
                <a href="${invoiceUrl}" class="download-button">📥 Download Invoice PDF</a>
              </div>
            </div>

            <p><strong>What's Next?</strong></p>
            <ul>
              <li>Your campaign is now visible to all Pro influencers</li>
              <li>Pro members get early access to your campaign opportunities</li>
              <li>Expect higher quality applications from verified influencers</li>
              <li>Track your campaign performance in the dashboard</li>
            </ul>

            <p><strong>Need Help?</strong> Our support team is here to assist you with any questions about your Max Campaign.</p>

            <p>Best regards,<br>
            <strong>The CollabKaroo Team</strong></p>
          </div>
          <div class="footer">
            <p>© 2025 CollabKaroo. All rights reserved.</p>
            <p>This is an automated payment confirmation email.</p>
            <p>Contact us at <a href="mailto:contact.us@gobuymybills.com">contact.us@gobuymybills.com</a></p>
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

      console.log(`Max Campaign invoice email sent to: ${email} (${invoiceNumber})`);
    } catch (error) {
      console.error(`Failed to send Max Campaign invoice email to ${email}:`, error);
      // Don't throw error - email is not critical for payment flow
    }
  }

  async sendAdminLoginOtp(
    email: string,
    adminName: string,
    otp: string,
  ): Promise<void> {
    const subject = 'Admin Login Verification - Collabkaroo';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Admin Login Verification</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center; padding: 30px; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .otp-box { background: white; border: 3px solid #667eea; padding: 30px; text-align: center; margin: 25px 0; border-radius: 8px; }
          .otp-code { font-size: 36px; font-weight: bold; color: #667eea; letter-spacing: 8px; margin: 20px 0; font-family: 'Courier New', monospace; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
          .warning { color: #dc3545; font-weight: bold; margin-top: 20px; padding: 15px; background: #f8d7da; border-radius: 5px; }
          .timer { background: #fff3cd; padding: 10px; border-radius: 5px; margin: 15px 0; color: #856404; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Admin Login Verification</h1>
            <p>Two-Factor Authentication</p>
          </div>
          <div class="content">
            <h2>Hello ${adminName},</h2>
            <p>A login attempt was made to your Collabkaroo admin account from <strong>${email}</strong>.</p>

            <div class="otp-box">
              <h3>Your Verification Code</h3>
              <p>Enter this code to complete your login:</p>
              <div class="otp-code">${otp}</div>
              <div class="timer">⏱️ This code expires in 5 minutes</div>
            </div>

            <p><strong>Security Information:</strong></p>
            <ul>
              <li>This OTP is valid for <strong>5 minutes only</strong></li>
              <li>Never share this code with anyone</li>
              <li>You have 5 attempts to enter the correct code</li>
              <li>If you didn't attempt to login, please secure your account immediately</li>
            </ul>

            <div class="warning">
              ⚠️ <strong>Security Alert:</strong> If this wasn't you, please contact support immediately and change your password.
            </div>

            <div class="footer">
              <p>This is an automated security notification.</p>
              <p><strong>Collabkaroo Admin Panel</strong></p>
              <p>&copy; 2025 Collabkaroo. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

    // Send email asynchronously without blocking
    this.transporter
      .sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject,
        html,
      })
      .then(() => {
        console.log(`Admin login OTP sent to: ${email}`);
      })
      .catch((error) => {
        console.error(`Failed to send admin login OTP to ${email}:`, error);
      });
  }
}
