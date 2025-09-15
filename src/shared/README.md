# Shared Module

This directory contains shared services, utilities, and components that are used across multiple modules within the API Gateway. It provides reusable functionality to avoid code duplication and maintain consistency.

## Overview

The shared module provides:

- Common services used across the application
- Utility functions and helpers
- Third-party service integrations
- Cross-module functionality
- Reusable components and pipes

## Files

### 1. `sms.service.ts`

Service for sending SMS messages via the Fast2SMS API.

**Purpose:**

- Send OTP via SMS to phone numbers
- Handle SMS delivery failures
- Manage SMS provider configuration
- Track SMS sending metrics
- Provide fallback mechanisms

**Features:**

- Fast2SMS API integration
- Template-based SMS sending
- Delivery status tracking
- Error handling and retries
- Rate limiting support

**Methods:**

```typescript
async sendOtp(phoneNumber: string, otp: string): Promise<boolean>
```

**Configuration:**

```typescript
{
  apiKey: process.env.FAST2SMS_API_KEY,
  baseUrl: 'https://www.fast2sms.com/dev/bulkV2',
  sender: 'FSTSMS',
  route: 'otp',
  timeout: 10000
}
```

**Usage Example:**

```typescript
// Inject SMS service
constructor(private smsService: SmsService) {}

// Send OTP
const success = await this.smsService.sendOtp('+1234567890', '123456');
if (!success) {
  throw new BadRequestException('Failed to send OTP');
}
```

### 2. `shared.module.ts`

Module configuration that exports shared services for use in other modules.

**Exports:**

- SmsService
- Other shared utilities (future additions)

**Imports:**

- HttpModule for API calls
- ConfigModule for environment variables

## SMS Service Implementation

### API Integration Details

**Fast2SMS API Configuration:**

```typescript
{
  method: 'POST',
  url: 'https://www.fast2sms.com/dev/bulkV2',
  headers: {
    'Authorization': process.env.FAST2SMS_API_KEY,
    'Content-Type': 'application/json'
  },
  data: {
    sender_id: 'FSTSMS',
    message: `Your OTP is: ${otp}`,
    route: 'otp',
    numbers: phoneNumber
  }
}
```

### Error Handling

**Common SMS Errors:**

- Invalid phone number format
- API key authentication failure
- Insufficient balance
- Network connectivity issues
- Rate limiting exceeded

**Error Responses:**

```json
{
  "success": false,
  "error": {
    "code": "SMS_DELIVERY_FAILED",
    "message": "Failed to send SMS",
    "details": {
      "provider": "Fast2SMS",
      "errorCode": "INVALID_NUMBER"
    }
  }
}
```

### Retry Mechanism

```typescript
async sendOtpWithRetry(phoneNumber: string, otp: string, maxRetries: number = 3): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await this.sendOtp(phoneNumber, otp);
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      await this.delay(1000 * attempt); // Exponential backoff
    }
  }
}
```

## Service Configuration

### Environment Variables

```env
# Fast2SMS Configuration
FAST2SMS_API_KEY=your-api-key-here
FAST2SMS_SENDER_ID=FSTSMS
FAST2SMS_ROUTE=otp

# SMS Settings
SMS_RETRY_COUNT=3
SMS_TIMEOUT=10000
SMS_RATE_LIMIT=10 # per minute
```

### Module Registration

```typescript
@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 3,
    }),
    ConfigModule,
  ],
  providers: [SmsService],
  exports: [SmsService],
})
export class SharedModule {}
```

## Usage Across Modules

### In Authentication Module

```typescript
// auth.module.ts
@Module({
  imports: [SharedModule], // Import shared module
  // ...
})
export class AuthModule {}

// auth.service.ts
constructor(private smsService: SmsService) {}

async requestOtp(phoneNumber: string) {
  const otp = this.generateOtp();

  // Send OTP via SMS
  const smsSent = await this.smsService.sendOtp(phoneNumber, otp);
  if (!smsSent) {
    throw new BadRequestException('Failed to send OTP');
  }

  // Store OTP in database
  await this.storeOtp(phoneNumber, otp);

  return { message: 'OTP sent successfully' };
}
```

## Monitoring and Logging

### SMS Delivery Metrics

- Success rate
- Delivery time
- Error rates by type
- Provider performance
- Cost tracking

### Logging Implementation

```typescript
async sendOtp(phoneNumber: string, otp: string): Promise<boolean> {
  const startTime = Date.now();

  try {
    // Log SMS attempt
    this.logger.log(`Sending OTP to ${phoneNumber.substring(0, 4)}****`);

    const result = await this.callSmsApi(phoneNumber, otp);

    // Log success
    this.logger.log(`OTP sent successfully in ${Date.now() - startTime}ms`);

    return result.success;
  } catch (error) {
    // Log failure
    this.logger.error(`SMS delivery failed: ${error.message}`, error.stack);

    return false;
  }
}
```

## Security Considerations

### 1. API Key Management

- Store API keys in environment variables
- Rotate keys regularly
- Monitor API key usage
- Implement key-specific rate limiting

### 2. Phone Number Privacy

- Never log complete phone numbers
- Mask phone numbers in logs
- Comply with privacy regulations
- Implement data retention policies

### 3. OTP Security

- Never log OTP values
- Use secure random generation
- Implement proper expiration
- Rate limit OTP requests

## Future Enhancements

### Planned Shared Services

**1. Email Service:**

```typescript
@Injectable()
export class EmailService {
  async sendEmail(to: string, subject: string, body: string): Promise<boolean> {
    // Implementation
  }
}
```

**2. File Upload Service:**

```typescript
@Injectable()
export class FileUploadService {
  async uploadFile(file: Buffer, filename: string): Promise<string> {
    // Implementation
  }
}
```

**3. Cache Service:**

```typescript
@Injectable()
export class CacheService {
  async set(key: string, value: any, ttl: number): Promise<void> {
    // Implementation
  }

  async get(key: string): Promise<any> {
    // Implementation
  }
}
```

**4. Notification Service:**

```typescript
@Injectable()
export class NotificationService {
  async sendPushNotification(userId: string, message: string): Promise<boolean> {
    // Implementation
  }
}
```

## Testing

### Unit Testing SMS Service

```typescript
describe("SmsService", () => {
  let service: SmsService;
  let httpService: HttpService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [HttpModule],
      providers: [SmsService],
    }).compile();

    service = module.get<SmsService>(SmsService);
    httpService = module.get<HttpService>(HttpService);
  });

  it("should send OTP successfully", async () => {
    // Mock HTTP response
    jest.spyOn(httpService, "post").mockReturnValue(of({ data: { success: true } }));

    const result = await service.sendOtp("+1234567890", "123456");
    expect(result).toBe(true);
  });

  it("should handle SMS delivery failure", async () => {
    // Mock HTTP error
    jest.spyOn(httpService, "post").mockReturnValue(throwError(() => new Error("API Error")));

    const result = await service.sendOtp("+1234567890", "123456");
    expect(result).toBe(false);
  });
});
```

### Integration Testing

```typescript
describe("SMS Integration", () => {
  it("should send real SMS in test environment", async () => {
    const testPhoneNumber = process.env.TEST_PHONE_NUMBER;
    if (!testPhoneNumber) {
      return; // Skip if no test number configured
    }

    const result = await smsService.sendOtp(testPhoneNumber, "123456");
    expect(result).toBe(true);
  });
});
```

## Best Practices

1. **Service Design:**
   - Keep services focused and single-purpose
   - Use dependency injection
   - Implement proper error handling
   - Add comprehensive logging

2. **Configuration:**
   - Use environment variables for external configs
   - Validate configuration on startup
   - Provide sensible defaults
   - Document all configuration options

3. **Error Handling:**
   - Handle external service failures gracefully
   - Implement retry mechanisms
   - Log errors with context
   - Provide fallback options when possible

4. **Testing:**
   - Mock external dependencies
   - Test error scenarios
   - Provide integration tests for critical paths
   - Use test-specific configurations
