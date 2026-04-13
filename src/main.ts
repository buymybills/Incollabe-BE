import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ResponseInterceptor } from './middleware/response.interceptor';
import { useContainer } from 'class-validator';
import { Request, Response } from 'express';
import compression from 'compression';

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

  // Enable response compression for JSON/text (not for media files)
  // Reduces API response sizes by 50-90% for chat history, message lists, etc.
  app.use(
    compression({
      // Only compress responses that benefit from compression
      filter: (req: Request, res: Response) => {
        const contentType = res.getHeader('content-type') as string;

        // Skip compression for media files (already compressed)
        if (contentType) {
          const skipTypes = [
            'video/', 'image/', 'audio/',     // Media files
            'application/octet-stream',       // Binary data
            'application/zip',                // Archives
            'application/pdf'                 // PDFs
          ];

          if (skipTypes.some(type => contentType.includes(type))) {
            return false;
          }
        }

        // Compress JSON, HTML, text, JavaScript, CSS
        return compression.filter(req, res);
      },
      // Compression level (0-9, where 6 is default balance of speed/ratio)
      level: 6,
      // Only compress responses larger than 1KB
      threshold: 1024,
    }),
  );

  // Increase payload size limit for file uploads
  // Note: Large files (up to 500MB) use chunked multipart upload directly to S3
  // These limits are for standard uploads and API payloads
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const express = require('express');
  app.use(express.json({ limit: '10mb' })); // For JSON payloads (increased for chunked upload metadata)
  app.use(express.urlencoded({ limit: '50mb', extended: true })); // For URL-encoded and standard uploads (50MB max)
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

  const isDev = configService.get('NODE_ENV') !== 'production';

  app.enableCors({
    origin: isDev ? '*' : allowedOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: isDev ? false : true,
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

  // Rewrite S3 URLs → CloudFront in every API response for CDN cost savings
  const s3Bucket = configService.get<string>('AWS_S3_BUCKET_NAME');
  const awsRegion = configService.get<string>('AWS_REGION');
  const cloudFrontDomain = configService.get<string>('CLOUDFRONT_DOMAIN');
  const s3Prefix = s3Bucket && awsRegion
    ? `https://${s3Bucket}.s3.${awsRegion}.amazonaws.com/`
    : undefined;
  const cfPrefix = cloudFrontDomain ? `https://${cloudFrontDomain}/` : undefined;

  app.useGlobalInterceptors(new ResponseInterceptor(s3Prefix, cfPrefix));
  app.useGlobalFilters(new GlobalExceptionFilter(loggerService));

  const port = configService.get('PORT') || 3002;

  await app.listen(port);

  // Use our custom logger for startup message
  loggerService.info(`Collabkaroo server started successfully!`, {
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
