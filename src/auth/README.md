# Authentication Module

The Authentication module handles user authentication and authorization for both **Influencers** and **Brands** in the Collabkaroo platform.

## Overview

This module provides secure authentication flows with OTP verification, JWT token management, and comprehensive user profile creation for two distinct user types.

## Features

### 🔐 Dual Authentication System
- **Influencer Flow**: OTP-based authentication with profile completion
- **Brand Flow**: Both OTP verification and email/password login
- **Session Management**: Redis-based session storage with device tracking

### 📱 OTP Verification
- SMS-based phone number verification
- Rate limiting and brute-force protection
- 5-minute OTP expiry with customizable retry logic
- Environment-specific test OTP (staging: `123456`)

### 🔑 JWT Token System
- Access tokens (15 minutes) for API authentication
- Refresh tokens (7 days) for token renewal
- Profile completion status tracking in tokens
- Device-specific session management

## Architecture

```
auth/
├── controller/
│   └── auth.controller.ts      # API endpoints
├── dto/                        # Data Transfer Objects
│   ├── request-otp.dto.ts
│   ├── verify-otp.dto.ts
│   ├── influencer-signup.dto.ts
│   ├── brand-signup.dto.ts
│   └── brand-login.dto.ts
├── model/                      # Database models
│   ├── influencer.model.ts
│   ├── brand.model.ts
│   ├── niche.model.ts
│   ├── otp.model.ts
│   ├── influencer-niche.model.ts
│   └── brand-niche.model.ts
├── auth.service.ts            # Business logic
└── auth.module.ts             # Module configuration
```

## Models

### Influencer
- Demographics (name, username, email, phone, DOB, gender)
- Profile information (bio, profile image)
- Phone verification status
- Many-to-many relationship with Niches

### Brand
- Business information (brand name, legal entity, company type)
- Contact details (email, phone, POC information)
- Authentication (email/password + OTP verification)
- Document storage (incorporation, GST, PAN documents)
- Many-to-many relationship with Niches

### Niche
- Content categories (Fashion, Beauty, Food, Tech, etc.)
- Associated with both Influencers and Brands
- Active/inactive status management

### OTP
- Phone number verification codes
- Expiry tracking and usage status
- Rate limiting support

## API Endpoints

### Influencer Authentication
```typescript
POST /auth/influencer/request-otp
POST /auth/influencer/verify-otp
POST /auth/influencer/signup
```

### Brand Authentication
```typescript
POST /auth/brand/request-otp
POST /auth/brand/verify-otp
POST /auth/brand/signup
POST /auth/brand/login
```

### General
```typescript
GET /auth/niches
```

## Security Features

### Rate Limiting
- **OTP Requests**: 5 requests per 15 minutes per phone
- **OTP Attempts**: 5 failed attempts before lockout
- **Cooldown**: 60-second cooldown between OTP requests

### Session Management
- Redis-based session storage
- Device and user-agent tracking
- Automatic session cleanup
- Multi-device login support

### Data Protection
- Password hashing with bcrypt (salt rounds: 10)
- Input validation with class-validator
- SQL injection protection via Sequelize ORM
- XSS protection through input sanitization

## Usage Examples

### Request OTP
```typescript
POST /auth/influencer/request-otp
{
  "phone": "+919876543210"
}
```

### Verify OTP
```typescript
POST /auth/influencer/verify-otp
{
  "phone": "+919876543210",
  "otp": "123456"
}
```

### Influencer Signup
```typescript
POST /auth/influencer/signup
{
  "phone": "+919876543210",
  "name": "John Doe",
  "username": "johndoe_influencer",
  "email": "john@example.com",
  "dateOfBirth": "1995-01-15",
  "gender": "Male",
  "bio": "Fashion and lifestyle content creator",
  "nicheIds": [1, 4]
}
```

### Brand Login
```typescript
POST /auth/brand/login
{
  "email": "brand@example.com",
  "password": "securePassword123"
}
```

## Error Handling

The module includes comprehensive error handling:

- **400 Bad Request**: Invalid input data
- **401 Unauthorized**: Invalid credentials or expired OTP
- **403 Forbidden**: Rate limit exceeded or account locked
- **409 Conflict**: User already exists or username taken
- **500 Internal Server Error**: System errors (handled by global filter)

## Dependencies

### Internal
- `DatabaseModule` - PostgreSQL connection
- `RedisModule` - Session management
- `SmsService` - OTP delivery

### External
- `@nestjs/jwt` - JWT token management
- `@nestjs/sequelize` - Database ORM
- `class-validator` - Input validation
- `bcrypt` - Password hashing
- `ioredis` - Redis client

## Configuration

### Environment Variables
```env
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret
SMS_API_KEY=your_sms_provider_key
NODE_ENV=development|staging|production
```

### Module Configuration
The module is configured with:
- Global ConfigModule for environment variables
- JWT module with dynamic configuration
- Sequelize models registration
- Redis service injection

## Testing

### Unit Tests
```bash
npm run test auth
```

### Integration Tests
```bash
npm run test:e2e auth
```

### Test Coverage
- Controller endpoints
- Service methods
- Model validations
- Error scenarios
- Rate limiting behavior

## Development Notes

### Adding New User Types
1. Create new model in `model/` directory
2. Add corresponding DTOs
3. Implement service methods
4. Add controller endpoints
5. Update module imports

### Extending Authentication
1. Implement new authentication strategy
2. Add corresponding guards
3. Update JWT payload structure
4. Modify session management logic

### Database Migrations
When modifying models, ensure proper database migrations:
```bash
npm run migration:generate -- --name=add_new_field
npm run migration:run
```

## Troubleshooting

### Common Issues

**OTP Not Received**
- Check SMS service configuration
- Verify phone number format
- Check rate limiting status

**Token Validation Failed**
- Verify JWT secrets in environment
- Check token expiry
- Validate Redis connection

**Database Connection Issues**
- Verify PostgreSQL configuration
- Check model associations
- Validate migration status