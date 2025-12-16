# Monorepo Migration Guide - Admin Microservice

## New Architecture

```
Incollabe-BE/                          # Single Git Repository
├── apps/
│   ├── api/                           # Main API Gateway (Port 3000)
│   │   ├── src/
│   │   │   ├── auth/
│   │   │   ├── brand/
│   │   │   ├── campaign/
│   │   │   ├── influencer/
│   │   │   ├── post/
│   │   │   ├── admin-gateway/         # Proxy to admin microservice
│   │   │   ├── app.module.ts
│   │   │   └── main.ts
│   │   └── test/
│   │
│   └── admin/                         # Admin Microservice (Port 3001)
│       ├── src/
│       │   ├── admin/                 # Admin-specific logic
│       │   │   ├── controllers/
│       │   │   ├── services/
│       │   │   └── admin.module.ts
│       │   ├── profile-review/
│       │   ├── dashboard/
│       │   ├── push-notification/
│       │   ├── app.module.ts
│       │   └── main.ts (TCP transport)
│       └── test/
│
├── libs/                              # Shared Libraries
│   └── shared/
│       ├── src/
│       │   ├── models/                # All Sequelize models
│       │   │   ├── admin.model.ts
│       │   │   ├── brand.model.ts
│       │   │   ├── influencer.model.ts
│       │   │   ├── campaign.model.ts
│       │   │   └── ... all models
│       │   ├── dto/                   # Shared DTOs
│       │   ├── services/              # Shared services
│       │   │   ├── database.service.ts
│       │   │   ├── email.service.ts
│       │   │   ├── whatsapp.service.ts
│       │   │   ├── firebase.service.ts
│       │   │   └── s3.service.ts
│       │   ├── guards/                # Shared guards
│       │   ├── decorators/            # Shared decorators
│       │   └── index.ts
│       └── tsconfig.lib.json
│
├── package.json                       # Single package.json for all deps
├── nest-cli.json                      # Monorepo configuration
├── tsconfig.json                      # Base TypeScript config
├── docker-compose.yml                 # Both services + database
├── .github/
│   └── workflows/
│       └── ci-cd.yml                  # Single CI/CD pipeline
└── README.md
```

## Migration Steps

### Step 1: Backup Current Code

```bash
cd /Users/bhartimishra/Desktop/bmb/Incollabe-BE
git add .
git commit -m "Backup before monorepo migration"
git branch backup-before-monorepo
```

### Step 2: Create Monorepo Structure

```bash
# Create apps directory
mkdir -p apps/api
mkdir -p apps/admin

# Move current src to apps/api
mv src apps/api/
mv test apps/api/

# Create libs directory
mkdir -p libs/shared/src
```

### Step 3: Update nest-cli.json

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "apps/api/src",
  "monorepo": true,
  "root": "apps/api",
  "compilerOptions": {
    "webpack": true,
    "tsConfigPath": "apps/api/tsconfig.app.json",
    "deleteOutDir": true
  },
  "projects": {
    "api": {
      "type": "application",
      "root": "apps/api",
      "entryFile": "main",
      "sourceRoot": "apps/api/src",
      "compilerOptions": {
        "tsConfigPath": "apps/api/tsconfig.app.json"
      }
    },
    "admin": {
      "type": "application",
      "root": "apps/admin",
      "entryFile": "main",
      "sourceRoot": "apps/admin/src",
      "compilerOptions": {
        "tsConfigPath": "apps/admin/tsconfig.app.json"
      }
    },
    "shared": {
      "type": "library",
      "root": "libs/shared",
      "entryFile": "index",
      "sourceRoot": "libs/shared/src",
      "compilerOptions": {
        "tsConfigPath": "libs/shared/tsconfig.lib.json"
      }
    }
  }
}
```

### Step 4: Update package.json Scripts

```json
{
  "scripts": {
    "build": "nest build",
    "build:api": "nest build api",
    "build:admin": "nest build admin",
    "start": "nest start",
    "start:api": "nest start api",
    "start:admin": "nest start admin",
    "start:dev": "concurrently \"nest start api --watch\" \"nest start admin --watch\"",
    "start:dev:api": "nest start api --watch",
    "start:dev:admin": "nest start admin --watch",
    "start:debug:api": "nest start api --debug --watch",
    "start:debug:admin": "nest start admin --debug --watch",
    "start:prod": "concurrently \"node dist/apps/api/main\" \"node dist/apps/admin/main\"",
    "test": "jest",
    "test:api": "jest --config apps/api/test/jest.json",
    "test:admin": "jest --config apps/admin/test/jest.json"
  },
  "devDependencies": {
    "concurrently": "^8.2.2"
  }
}
```

### Step 5: Create TypeScript Configs

**tsconfig.json** (root)
```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2021",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": false,
    "noImplicitAny": false,
    "strictBindCallApply": false,
    "forceConsistentCasingInFileNames": false,
    "noFallthroughCasesInSwitch": false,
    "paths": {
      "@app/shared": ["libs/shared/src"],
      "@app/shared/*": ["libs/shared/src/*"]
    }
  }
}
```

**apps/api/tsconfig.app.json**
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "declaration": false,
    "outDir": "../../dist/apps/api"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test", "**/*spec.ts"]
}
```

**apps/admin/tsconfig.app.json**
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "declaration": false,
    "outDir": "../../dist/apps/admin"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test", "**/*spec.ts"]
}
```

**libs/shared/tsconfig.lib.json**
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "declaration": true,
    "outDir": "../../dist/libs/shared"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test", "**/*spec.ts"]
}
```

### Step 6: Create Shared Library

**libs/shared/src/index.ts**
```typescript
// Models
export * from './models/admin.model';
export * from './models/brand.model';
export * from './models/influencer.model';
export * from './models/campaign.model';
export * from './models/post.model';
// ... export all models

// Services
export * from './services/database.module';
export * from './services/email.service';
export * from './services/whatsapp.service';
export * from './services/firebase.service';
export * from './services/s3.service';
export * from './services/logger.service';

// DTOs
export * from './dto/pagination.dto';
// ... export shared DTOs

// Guards
export * from './guards/auth.guard';

// Decorators
export * from './decorators/public.decorator';
```

**Move models to shared:**
```bash
# Move all models to libs/shared/src/models/
mv apps/api/src/auth/model/*.model.ts libs/shared/src/models/
mv apps/api/src/brand/model/*.model.ts libs/shared/src/models/
mv apps/api/src/admin/models/*.model.ts libs/shared/src/models/
mv apps/api/src/campaign/models/*.model.ts libs/shared/src/models/
mv apps/api/src/post/models/*.model.ts libs/shared/src/models/
mv apps/api/src/shared/models/*.model.ts libs/shared/src/models/
mv apps/api/src/influencer/models/*.model.ts libs/shared/src/models/

# Move shared services
mkdir -p libs/shared/src/services
mv apps/api/src/shared/*.service.ts libs/shared/src/services/
mv apps/api/src/shared/services/*.service.ts libs/shared/src/services/
```

**libs/shared/src/services/database.module.ts**
```typescript
import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as models from '../models';

@Module({
  imports: [
    SequelizeModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        dialect: 'postgres',
        host: config.get('POSTGRES_HOST'),
        port: config.get('POSTGRES_PORT'),
        username: config.get('POSTGRES_USER'),
        password: config.get('POSTGRES_PASSWORD'),
        database: config.get('POSTGRES_DB'),
        models: Object.values(models),
        autoLoadModels: true,
        synchronize: false,
        logging: false,
      }),
    }),
  ],
  exports: [SequelizeModule],
})
export class DatabaseModule {}
```

### Step 7: Create Admin Microservice

**apps/admin/src/main.ts**
```typescript
import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.TCP,
      options: {
        host: '0.0.0.0',
        port: 3001,
      },
    },
  );

  await app.listen();
  console.log('🚀 Admin Microservice listening on port 3001');
}

bootstrap();
```

**apps/admin/src/app.module.ts**
```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '@app/shared/services/database.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AdminModule,
  ],
})
export class AppModule {}
```

**apps/admin/src/admin/admin.controller.ts**
```typescript
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AdminAuthService } from './admin-auth.service';
// Import services from current admin module

@Controller()
export class AdminController {
  constructor(
    private readonly adminAuthService: AdminAuthService,
    // Inject other services
  ) {}

  @MessagePattern({ cmd: 'admin.login' })
  async login(@Payload() data: any) {
    return this.adminAuthService.login(data);
  }

  @MessagePattern({ cmd: 'admin.getDashboardStats' })
  async getDashboardStats() {
    return this.adminAuthService.getDashboardStats();
  }

  // Add all other message patterns...
}
```

**Copy admin code:**
```bash
# Copy admin services and controllers
cp -r apps/api/src/admin/* apps/admin/src/admin/
```

### Step 8: Update API Gateway

**apps/api/src/admin-gateway/admin-gateway.module.ts**
```typescript
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AdminGatewayController } from './admin-gateway.controller';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'ADMIN_SERVICE',
        transport: Transport.TCP,
        options: {
          host: process.env.ADMIN_SERVICE_HOST || 'localhost',
          port: parseInt(process.env.ADMIN_SERVICE_PORT) || 3001,
        },
      },
    ]),
  ],
  controllers: [AdminGatewayController],
})
export class AdminGatewayModule {}
```

**apps/api/src/admin-gateway/admin-gateway.controller.ts**
```typescript
import { Controller, Post, Get, Body, Query, Param, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
export class AdminGatewayController {
  constructor(
    @Inject('ADMIN_SERVICE') private readonly adminClient: ClientProxy,
  ) {}

  @Post('login')
  async login(@Body() loginDto: any) {
    return firstValueFrom(
      this.adminClient.send({ cmd: 'admin.login' }, loginDto),
    );
  }

  @Get('dashboard/stats')
  async getDashboardStats() {
    return firstValueFrom(
      this.adminClient.send({ cmd: 'admin.getDashboardStats' }, {}),
    );
  }

  // Add all other proxied endpoints...
}
```

**Update apps/api/src/app.module.ts:**
```typescript
import { Module } from '@nestjs/common';
import { DatabaseModule } from '@app/shared/services/database.module';
import { AdminGatewayModule } from './admin-gateway/admin-gateway.module';
// Remove AdminModule import
// ... other imports

@Module({
  imports: [
    DatabaseModule,
    AdminGatewayModule, // Add gateway
    // Remove AdminModule
    // ... other modules
  ],
})
export class AppModule {}
```

### Step 9: Update Import Paths

Update all imports in both apps to use shared library:

```typescript
// Before
import { Brand } from '../brand/model/brand.model';
import { Influencer } from '../auth/model/influencer.model';

// After
import { Brand, Influencer } from '@app/shared';
```

### Step 10: Update Docker Compose

**docker-compose.yml**
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16
    container_name: incollab_postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: root
      POSTGRES_DB: incollab_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - incollab-network

  redis:
    image: redis:7-alpine
    container_name: incollab_redis
    ports:
      - "6379:6379"
    networks:
      - incollab-network

  api:
    build:
      context: .
      dockerfile: Dockerfile
      target: api
    container_name: incollab_api
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      POSTGRES_HOST: postgres
      REDIS_HOST: redis
      ADMIN_SERVICE_HOST: admin
      ADMIN_SERVICE_PORT: 3001
    depends_on:
      - postgres
      - redis
      - admin
    networks:
      - incollab-network

  admin:
    build:
      context: .
      dockerfile: Dockerfile
      target: admin
    container_name: incollab_admin
    ports:
      - "3001:3001"
    environment:
      NODE_ENV: production
      POSTGRES_HOST: postgres
      REDIS_HOST: redis
    depends_on:
      - postgres
      - redis
    networks:
      - incollab-network

volumes:
  postgres_data:

networks:
  incollab-network:
    driver: bridge
```

### Step 11: Update Dockerfile

**Dockerfile**
```dockerfile
# Base stage
FROM node:18-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Development stage
FROM base AS development
COPY . .
RUN npm run build

# API Production stage
FROM node:18-alpine AS api
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=development /app/dist/apps/api ./dist/apps/api
COPY --from=development /app/dist/libs ./dist/libs
EXPOSE 3000
CMD ["node", "dist/apps/api/main"]

# Admin Production stage
FROM node:18-alpine AS admin
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=development /app/dist/apps/admin ./dist/apps/admin
COPY --from=development /app/dist/libs ./dist/libs
EXPOSE 3001
CMD ["node", "dist/apps/admin/main"]
```

### Step 12: GitHub Workflow

**.github/workflows/ci-cd.yml**
```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run lint
      - run: npm run test:api
      - run: npm run test:admin

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build:api
      - run: npm run build:admin

  deploy:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to production
        run: |
          docker-compose -f docker-compose.yml up -d --build
```

## Testing

### Start Both Services Locally

```bash
# Terminal 1: Start both services
npm run start:dev

# Or separately:
# Terminal 1: API
npm run start:dev:api

# Terminal 2: Admin
npm run start:dev:admin
```

### Test Endpoints

```bash
# Test API (3000)
curl http://localhost:3000/api/auth/health

# Test Admin through gateway (3000 → 3001)
curl http://localhost:3000/api/admin/dashboard/stats
```

## Advantages of This Approach

1. **Single Repository**: All code in one place
2. **Shared Code**: No code duplication for models/DTOs
3. **Type Safety**: TypeScript paths work across apps
4. **Common CI/CD**: Single pipeline for both services
5. **Easier Development**: Run both services with one command
6. **Better Organization**: Clear separation of concerns
7. **Scalable**: Easy to add more microservices

## Migration Checklist

- [ ] Backup current code
- [ ] Create monorepo structure (apps/, libs/)
- [ ] Update nest-cli.json
- [ ] Update package.json scripts
- [ ] Create TypeScript configs
- [ ] Move models to shared library
- [ ] Create admin microservice
- [ ] Create admin gateway in API
- [ ] Update all import paths
- [ ] Update Docker configuration
- [ ] Test both services
- [ ] Update GitHub workflow

This is a much cleaner architecture that keeps everything in one repository while still achieving microservice separation!
