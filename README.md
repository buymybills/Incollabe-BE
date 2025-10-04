<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

# Collabkaroo - Brand and Influencer Collaboration Platform

## Description

Collabkaroo is a comprehensive platform built with [NestJS](https://nestjs.com/) that connects brands with influencers for meaningful collaborations. The platform provides secure authentication, profile management, and campaign coordination features for both brands and influencers.

## Features

### 🔐 Authentication System
- **Dual User Types**: Separate authentication flows for Brands and Influencers
- **OTP Verification**: Phone number verification using SMS OTP
- **JWT Tokens**: Secure access and refresh token system with Redis session management
- **Profile Completion**: Multi-step onboarding process for both user types

### 👥 User Management
- **Influencer Profiles**: Complete profile creation with demographics, bio, and niche selection
- **Brand Profiles**: Comprehensive business profiles with company details, POC information, and legal documentation
- **Niche Categories**: Organized content categories (Fashion, Beauty, Food, Tech, etc.)

### 🗄️ Data Management
- **PostgreSQL Database**: Robust relational database with proper associations
- **Redis Caching**: Session management and rate limiting
- **File Upload Support**: Profile images and document storage
- **Data Validation**: Comprehensive input validation using class-validator

### 🛡️ Security Features
- **Rate Limiting**: OTP request throttling and brute-force protection
- **Session Management**: Secure user session handling with Redis
- **Global Error Handling**: Centralized error management
- **Input Sanitization**: Protection against common web vulnerabilities

## Tech Stack

- **Framework**: NestJS with TypeScript
- **Database**: PostgreSQL with Sequelize ORM
- **Caching**: Redis
- **Authentication**: JWT with refresh tokens
- **SMS Service**: Integrated SMS OTP verification
- **Validation**: class-validator and class-transformer
- **API Documentation**: Swagger/OpenAPI

## Architecture

```
src/
├── auth/                 # Authentication module
│   ├── dto/             # Data Transfer Objects
│   ├── model/           # Database models
│   └── guards/          # Authentication guards
├── database/            # Database configuration
├── redis/              # Redis configuration
├── shared/             # Shared utilities and services
└── main.ts            # Application bootstrap
```

## Environment Setup

### Prerequisites
- Node.js (v18+)
- PostgreSQL (v13+)
- Redis (v6+)
- npm or yarn

### Environment Variables
Create a `.env` file in the root directory:

```env
# Database Configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
POSTGRES_DB=incollab_db

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT Configuration
JWT_SECRET=your_super_secure_jwt_secret
JWT_REFRESH_SECRET=your_super_secure_refresh_secret

# SMS Configuration (for OTP)
SMS_API_KEY=your_sms_provider_api_key
SMS_SENDER_ID=COLLABKAROO

# Application
NODE_ENV=staging
PORT=3000
```

## Installation

```bash
# Install dependencies
$ npm install

# Setup database
$ npm run db:create
$ npm run db:migrate
$ npm run db:seed
```

## Running the Application

```bash
# Development mode with auto-reload
$ npm run start:dev

# Production mode
$ npm run start:prod

# Debug mode
$ npm run start:debug
```

## API Documentation

Once the application is running, visit:
- **Swagger UI**: http://localhost:3000/api
- **API JSON**: http://localhost:3000/api-json

## API Endpoints

### Authentication - Influencer
- `POST /auth/influencer/request-otp` - Request OTP for phone verification
- `POST /auth/influencer/verify-otp` - Verify OTP and login/signup
- `POST /auth/influencer/signup` - Complete influencer registration

### Authentication - Brand
- `POST /auth/brand/request-otp` - Request OTP for phone verification
- `POST /auth/brand/verify-otp` - Verify OTP and login/signup
- `POST /auth/brand/signup` - Complete brand registration
- `POST /auth/brand/login` - Email/password login for brands

### General
- `GET /auth/niches` - Get all available content niches

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
