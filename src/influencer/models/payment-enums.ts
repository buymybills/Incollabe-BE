export enum SubscriptionStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
  PAYMENT_PENDING = 'payment_pending',
  PAYMENT_FAILED = 'payment_failed',
  INACTIVE = 'inactive',
}

export enum PaymentMethod {
  RAZORPAY = 'razorpay',
  MANUAL = 'manual',
  FREE_TRIAL = 'free_trial',
  ADMIN_GRANTED = 'admin_granted',
}

export enum InvoiceStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  DEDUCTED_NOT_RECEIVED = 'deducted_not_received',
  PAID = 'paid',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

export enum TransactionType {
  PAYMENT = 'payment',
  REFUND = 'refund',
  ADJUSTMENT = 'adjustment',
}

export enum TransactionStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
  PENDING = 'pending',
}

export enum UpiMandateStatus {
  NOT_CREATED = 'not_created',
  PENDING = 'pending',
  AUTHENTICATED = 'authenticated',
  PAUSED = 'paused',
  CANCELLED = 'cancelled',
  REJECTED = 'rejected',
  REVOKED = 'revoked',
}
