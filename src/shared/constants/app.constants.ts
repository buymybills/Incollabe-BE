export const APP_CONSTANTS = {
  OTP: {
    EXPIRY_MINUTES: 10,
    LENGTH: 6,
    MIN_VALUE: 100000,
    MAX_VALUE: 999999,
  },
  WHATSAPP: {
    TEMPLATE_NAMES: {
      OTP: 'otp',
      PROFILE_VERIFICATION_PENDING: 'profile_verification_inprogress',
      PROFILE_INCOMPLETE: 'profile_incomplete',
      PROFILE_VERIFIED: 'profile_verified',
      PROFILE_REJECTED: 'profile_rejected',
      CAMPAIGN_INVITATION: 'campaign_invite',
      CAMPAIGN_APPLICATION_CONFIRMATION: 'campaign_application_confirmation',
    },
    BUTTON_TEXT: {
      VERIFY: 'verify',
    },
    LANGUAGE_CODE: 'en',
    MESSAGING_PRODUCT: 'whatsapp',
  },
  FILE_UPLOAD: {
    MAX_SIZE_MB: 5,
    ALLOWED_IMAGE_TYPES: ['jpg', 'jpeg', 'png', 'webp'],
    ALLOWED_DOCUMENT_TYPES: ['pdf', 'jpg', 'jpeg', 'png'],
  },
  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 10,
    MAX_LIMIT: 100,
  },
} as const;

export const ERROR_MESSAGES = {
  INFLUENCER: {
    NOT_FOUND: 'Influencer not found',
    ALREADY_EXISTS: 'Influencer already exists',
    PROFILE_INCOMPLETE: 'Profile is incomplete',
  },
  OTP: {
    INVALID_FORMAT: 'Invalid OTP format',
    EXPIRED: 'OTP has expired',
    INVALID: 'Invalid or expired OTP',
    ALREADY_USED: 'OTP has already been used',
  },
  WHATSAPP: {
    VERIFICATION_FAILED: 'WhatsApp verification failed',
    SEND_FAILED: 'Failed to send WhatsApp message',
    ALREADY_VERIFIED: 'WhatsApp number is already verified',
  },
  COMMON: {
    UNAUTHORIZED: 'Unauthorized access',
    FORBIDDEN: 'Access forbidden',
    VALIDATION_FAILED: 'Validation failed',
    INTERNAL_ERROR: 'Internal server error',
  },
} as const;

export const SUCCESS_MESSAGES = {
  OTP: {
    SENT: 'OTP sent successfully',
    VERIFIED: 'OTP verified successfully',
  },
  WHATSAPP: {
    OTP_SENT: 'WhatsApp OTP sent successfully',
    VERIFIED: 'WhatsApp verified successfully',
  },
  PROFILE: {
    UPDATED: 'Profile updated successfully',
    SUBMITTED_FOR_VERIFICATION: 'Profile submitted for verification',
  },
} as const;
