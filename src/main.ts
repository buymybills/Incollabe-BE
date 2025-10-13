import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ResponseInterceptor } from './middleware/response.interceptor';
import { GlobalExceptionFilter as OldGlobalExceptionFilter } from './middleware/exception.filter';
import { GlobalExceptionFilter } from './shared/filters/global-exception.filter';
import { LoggerService } from './shared/services/logger.service';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Get our custom logger service
  const loggerService = app.get(LoggerService);

  app.setGlobalPrefix('api');

  // Increase payload size limit for file uploads (including multipart/form-data)
  // Total limit: 2 images (5MB each) + 3 documents (10MB each) = 40MB max
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const express = require('express');
  app.use(express.json({ limit: '5mb' })); // For JSON payloads
  app.use(express.urlencoded({ limit: '10mb', extended: true })); // For URL-encoded payloads
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  );

  const configService = app.get(ConfigService);
  const allowedOrigins = configService
    .get<string>('ALLOWED_ORIGINS', '')
    .split(',')
    .filter(Boolean);

  console.log('Allowed CORS origins:', allowedOrigins);

  app.enableCors({
    origin: allowedOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('Collabkaroo Application Backend')
    .setDescription('API documentation for the Collabkaroo application')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new GlobalExceptionFilter(loggerService));

  const port = configService.get('PORT') || 3002;

  await app.listen(port);

  // Use our custom logger for startup message
  loggerService.info(`Collabkaroo server started successfully`, {
    port,
    environment: process.env.NODE_ENV || 'development',
    apiDocs: `http://localhost:${port}/api/docs`,
    timestamp: new Date().toISOString(),
  });
}
bootstrap().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
