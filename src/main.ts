import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ResponseInterceptor } from "./middleware/response.interceptor";
import { GlobalExceptionFilter } from "./middleware/exception.filter";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  );
  app.enableCors({
    origin: "*",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle("Cloutsy Application Backend")
    .setDescription("API documentation for the Cloutsy application")
    .setVersion("1.0")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document);

  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new GlobalExceptionFilter());

  const configService = app.get(ConfigService);
  const port = configService.get("PORT") || 3002;
  await app.listen(port);
  console.log(`Cloutsy is running on: http://localhost:${port}/api`);
}
bootstrap();
