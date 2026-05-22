import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { appConfig } from './config/app-config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: appConfig.allowedOrigins,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
  });
  app.setGlobalPrefix('api');
  await app.listen(appConfig.port);
}
bootstrap();
