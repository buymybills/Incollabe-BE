import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ResponseInterceptor } from './middleware/response.interceptor';
import { useContainer } from 'class-validator';
import { Request, Response } from 'express';

import { GlobalExceptionFilter } from './shared/filters/global-exception.filter';
import { LoggerService } from './shared/services/logger.service';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable dependency injection for class-validator custom validators
  useContainer(app.select(AppModule), { fallbackOnErrors: true });

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

  // Create full Swagger document
  const config = new DocumentBuilder()
    .setTitle('Collabkaroo Application Backend')
    .setDescription('API documentation for the Collabkaroo application')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const fullDocument = SwaggerModule.createDocument(app, config);

  // Filter documents for different domains
  const adminDocument = {
    ...fullDocument,
    info: {
      ...fullDocument.info,
      title: 'Collabkaroo Admin API',
      description: 'API documentation for Admin endpoints only',
    },
    paths: Object.keys(fullDocument.paths || {})
      .filter((path) => path.startsWith('/api/admin'))
      .reduce((acc, path) => {
        acc[path] = fullDocument.paths[path];
        return acc;
      }, {}),
  };

  const publicDocument = {
    ...fullDocument,
    info: {
      ...fullDocument.info,
      title: 'Collabkaroo Public API',
      description: 'API documentation for public endpoints (excludes admin)',
    },
    paths: Object.keys(fullDocument.paths || {})
      .filter((path) => !path.startsWith('/api/admin'))
      .reduce((acc, path) => {
        acc[path] = fullDocument.paths[path];
        return acc;
      }, {}),
  };

  // Setup dynamic Swagger that serves different docs based on domain
  const expressApp = app.getHttpAdapter().getInstance();

  // Custom middleware to serve domain-specific Swagger JSON
  expressApp.get('/api/docs-json', (req: Request, res: Response) => {
    const domain =
      (req.headers['x-original-domain'] as string) ||
      (req.headers['host'] as string) ||
      '';

    // Serve admin docs if:
    // 1. Domain is teamcollabkaroo.com (production)
    // 2. Query param ?admin=true is present (local testing)
    const isAdminDomain = domain.includes('teamcollabkaroo.com');
    const isAdminQuery = req.query.admin === 'true';

    if (isAdminDomain || isAdminQuery) {
      return res.json(adminDocument);
    }

    return res.json(publicDocument);
  });

  // Setup Swagger UI with dynamic URL
  expressApp.get('/api/docs', (req: Request, res: Response) => {
    const isAdminQuery = req.query.admin === 'true';
    const jsonUrl = isAdminQuery
      ? '/api/docs-json?admin=true'
      : '/api/docs-json';

    // Generate Swagger HTML with dynamic JSON URL
    const swaggerHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${isAdminQuery ? 'Collabkaroo Admin API Docs' : 'Collabkaroo API Docs'}</title>
    <link rel="stylesheet" type="text/css" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css">
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
    <script>
        window.onload = function() {
            SwaggerUIBundle({
                url: '${jsonUrl}',
                dom_id: '#swagger-ui',
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIStandalonePreset
                ],
                layout: "BaseLayout",
                persistAuthorization: true
            });
        };
    </script>
</body>
</html>`;

    res.send(swaggerHtml);
  });

  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new GlobalExceptionFilter(loggerService));

  const port = configService.get('PORT') || 3002;

  await app.listen(port);

  // Use our custom logger for startup message
  loggerService.info(`Collabkaroo server started successfully!!!`, {
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
