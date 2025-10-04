# Campaign Module Architecture

## Overview
This module follows **SOLID principles** and **Clean Architecture** patterns for maintainability and scalability.

## Architecture Patterns

### 1. **Separation of Concerns**
- **Controllers**: Handle HTTP requests/responses
- **Services**: Business logic orchestration
- **Query Services**: Database operations
- **Helpers**: Reusable utility functions
- **Constants**: Centralized configuration

### 2. **Single Responsibility Principle (SRP)**
Each class has one reason to change:
- `CampaignService`: Campaign business logic
- `CampaignQueryService`: Database queries
- `QueryBuilderHelper`: Query construction
- `CampaignStatsHelper`: Statistics calculation

### 3. **Dependency Injection**
All dependencies are injected through constructors, making testing easier and reducing coupling.

## Directory Structure

```
campaign/
├── constants/
│   └── query-builder.constants.ts    # SQL queries, model attributes, enums
├── dto/
│   └── *.dto.ts                       # Data Transfer Objects
├── helpers/
│   ├── query-builder.helper.ts       # Query construction utilities
│   └── campaign-stats.helper.ts      # Statistics calculation utilities
├── interfaces/
│   └── campaign-with-stats.interface.ts  # TypeScript interfaces
├── models/
│   └── *.model.ts                     # Database models
├── services/
│   └── campaign-query.service.ts      # Database query service
├── campaign.controller.ts             # HTTP request handlers
├── campaign.service.ts                # Business logic
└── campaign.module.ts                 # Module configuration
```

## Key Improvements

### Type Safety
- Proper TypeScript interfaces for all data structures
- No `any` types in business logic
- Generic helper functions with proper typing

### Maintainability
- Constants extracted to centralized files
- Reusable helper functions
- Clear separation between query logic and business logic

### Performance
- Database indexes defined in migrations
- Efficient query patterns
- In-memory sorting only when necessary

### Testability
- Each service can be tested independently
- Pure functions in helpers
- Mock-friendly dependency injection

## Usage Examples

### Getting Campaigns by Category
```typescript
// In controller
const { campaigns } = await this.campaignService.getCampaignsByCategory(
  brandId,
  'open'
);

// The service delegates to query service
// Query service uses helpers for clean, reusable code
```

### Building Complex Queries
```typescript
// Using QueryBuilderHelper
const ageConditions = QueryBuilderHelper.buildAgeFilter(18, 35);
const platformFilter = QueryBuilderHelper.buildPlatformFilter('instagram');
const literalConditions = QueryBuilderHelper.combineLiteralConditions(
  ageMin,
  ageMax,
  experience
);
```

### Adding Statistics
```typescript
// Using CampaignStatsHelper
const campaignsWithStats = CampaignStatsHelper.addStatsToCampaigns(
  campaigns,
  CampaignStatsHelper.addApplicationCount
);
```

## Best Practices Applied

1. **DRY (Don't Repeat Yourself)**: Common logic extracted to helpers
2. **KISS (Keep It Simple, Stupid)**: Each function has a clear, single purpose
3. **YAGNI (You Aren't Gonna Need It)**: No over-engineering, only what's needed
4. **Composition over Inheritance**: Using helper functions and services
5. **Immutability**: Functional programming patterns in helpers
6. **Documentation**: JSDoc comments on all public methods

## Database Indexes

Performance indexes are defined in `migrations/005_add_performance_indexes.sql`:
- Campaign queries by brand and status
- Application queries by status and influencer
- Follower count queries
- Location and demographic filters

## Testing Strategy

### Unit Tests
- Test helpers in isolation (pure functions)
- Mock database models in service tests
- Test edge cases and error handling

### Integration Tests
- Test controller → service → database flow
- Test complex query scenarios
- Test pagination and filtering

## Future Improvements

1. **Caching Layer**: Redis for frequently accessed data
2. **Event Sourcing**: Track campaign state changes
3. **CQRS Pattern**: Separate read/write models for complex queries
4. **GraphQL**: For flexible client queries
5. **Microservices**: Extract campaign module to separate service

## Contributing

When adding new features:
1. Follow existing patterns
2. Add proper TypeScript types
3. Extract reusable logic to helpers
4. Write tests for new functionality
5. Update this documentation
