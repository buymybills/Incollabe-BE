# Middleware

This directory contains global middleware components that handle cross-cutting concerns like error handling, response formatting, and request/response transformation throughout the API Gateway.

## Overview

Middleware components provide:

- Consistent error handling and formatting
- Standardized API response structure
- Request/response transformation
- Logging and monitoring
- Global application-wide processing

## Files

### 1. `exception.filter.ts`

Global exception filter that catches and formats all unhandled errors.

**Purpose:**

- Catch all unhandled exceptions
- Format errors into consistent structure
- Log errors for monitoring
- Hide sensitive information in production
- Provide meaningful error messages to clients

**Features:**

- HTTP exception handling
- Database error handling
- Validation error formatting
- Stack trace management
- Error logging and monitoring

**Error Response Format:**

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {} // Additional error context (dev only)
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Error Types Handled:**

- **HttpException**: NestJS HTTP exceptions
- **ValidationError**: Input validation failures
- **DatabaseError**: Sequelize/database errors
- **AuthenticationError**: JWT/auth failures
- **UnknownError**: Unexpected system errors

### 2. `response.interceptor.ts`

Global response interceptor that standardizes all API responses.

**Purpose:**

- Ensure consistent response format
- Transform response data
- Add metadata (timestamps, status)
- Handle response streaming
- Performance timing

**Features:**

- Response transformation
- Metadata injection
- Performance monitoring
- Success/error standardization
- Response caching headers

**Success Response Format:**

```json
{
  "success": true,
  "data": {}, // Actual response data
  "message": "Operation successful",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "meta": {
    "executionTime": "150ms",
    "version": "1.0.0"
  }
}
```

## Implementation Details

### Exception Filter Implementation

**Global Registration:**

```typescript
// In main.ts
app.useGlobalFilters(new GlobalExceptionFilter());
```

**Error Processing Flow:**

1. Exception thrown in application
2. Filter catches exception
3. Determine error type and code
4. Format error message
5. Log error details
6. Return formatted response

**Error Codes:**

- `VALIDATION_ERROR`: Input validation failures
- `AUTHENTICATION_ERROR`: Auth-related errors
- `AUTHORIZATION_ERROR`: Permission denied
- `NOT_FOUND`: Resource not found
- `CONFLICT`: Business logic conflicts
- `INTERNAL_ERROR`: System/unknown errors

### Response Interceptor Implementation

**Global Registration:**

```typescript
// In main.ts
app.useGlobalInterceptors(new ResponseInterceptor());
```

**Response Processing Flow:**

1. Controller returns data
2. Interceptor wraps data
3. Add metadata
4. Format response
5. Return standardized response

## Usage Examples

### Custom Exception Throwing

```typescript
// In services
throw new BadRequestException("Invalid phone number format");
throw new UnauthorizedException("Invalid or expired token");
throw new NotFoundException("User not found");

// Custom business logic errors
throw new ConflictException("Phone number already registered");
```

### Response Handling

```typescript
// Controller methods automatically wrapped
@Get('users')
getUsers() {
  return this.userService.findAll(); // Auto-wrapped in success format
}

// Manual message override
@Post('users')
createUser(@Body() userData) {
  const user = this.userService.create(userData);
  return {
    data: user,
    message: 'User created successfully'
  };
}
```

## Configuration

### Environment-Based Behavior

```typescript
// Development: Include stack traces
if (process.env.NODE_ENV === "development") {
  errorResponse.error.stack = exception.stack;
}

// Production: Hide sensitive details
if (process.env.NODE_ENV === "production") {
  errorResponse.error.details = undefined;
}
```

### Logging Configuration

```typescript
// Error logging
logger.error(`${exception.message}`, {
  stack: exception.stack,
  url: request.url,
  method: request.method,
  body: request.body,
  user: request.user?.id,
});
```

## Error Handling Strategies

### 1. Business Logic Errors

```typescript
// Service layer
if (await this.isPhoneNumberTaken(phoneNumber)) {
  throw new ConflictException("Phone number already registered");
}
```

### 2. Validation Errors

```typescript
// Automatically handled by ValidationPipe
// DTOs with class-validator decorators
@IsNotEmpty()
@IsPhoneNumber()
phoneNumber: string;
```

### 3. Database Errors

```typescript
// Sequelize errors mapped to HTTP errors
catch (error) {
  if (error.name === 'SequelizeUniqueConstraintError') {
    throw new ConflictException('Resource already exists');
  }
  if (error.name === 'SequelizeConnectionError') {
    throw new InternalServerErrorException('Database connection failed');
  }
  throw new InternalServerErrorException('Database operation failed');
}
```

## Monitoring and Logging

### Error Metrics

- Error rate by endpoint
- Error types distribution
- Response time percentiles
- User error patterns

### Log Structure

```json
{
  "timestamp": "2024-01-01T00:00:00.000Z",
  "level": "error",
  "message": "Validation failed",
  "context": {
    "endpoint": "/auth/verify-otp",
    "method": "POST",
    "userId": "uuid",
    "errorCode": "VALIDATION_ERROR",
    "stack": "Error stack trace..."
  }
}
```

## Security Considerations

### 1. Information Disclosure

- Hide internal error details in production
- Sanitize error messages
- Avoid exposing system information
- Log full errors server-side only

### 2. Error Response Timing

- Consistent response times
- Avoid timing attacks
- Rate limiting on error responses

### 3. Sensitive Data Handling

- Never include sensitive data in error responses
- Sanitize request/response logging
- Implement data masking

## Best Practices

### 1. Exception Handling

- Use specific exception types
- Provide meaningful error messages
- Include error context when helpful
- Handle errors at appropriate layers

### 2. Response Consistency

- Always use standard response format
- Include relevant metadata
- Provide clear success/error indicators
- Version API responses appropriately

### 3. Performance

- Minimize response transformation overhead
- Use efficient error logging
- Cache error responses where appropriate
- Monitor response processing time

### 4. Debugging

- Include correlation IDs
- Log request/response pairs
- Provide detailed error context in development
- Implement error reproduction tools

## Testing

### Unit Testing Middleware

```typescript
describe("ExceptionFilter", () => {
  it("should format HTTP exceptions correctly", () => {
    const filter = new GlobalExceptionFilter();
    const exception = new BadRequestException("Test error");
    // Test error formatting
  });
});

describe("ResponseInterceptor", () => {
  it("should wrap successful responses", () => {
    const interceptor = new ResponseInterceptor();
    // Test response wrapping
  });
});
```
