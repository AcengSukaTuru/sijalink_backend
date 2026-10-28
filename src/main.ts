import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { AppLogger } from './common/logger/app-logger.js';
import { httpLogger } from './common/logger/http-logger.middleware.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new AppLogger(),
  });

  app.use(httpLogger);
  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();
  const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim());
  app.enableCors({ origin: origins, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('SijaLink Backend API')
    .setDescription('API backend untuk aplikasi operasional teknisi ISP.')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig, {
    autoTagControllers: false,
  });
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  const storageDriver = (process.env.STORAGE_DRIVER ?? 'local').toUpperCase();
  const storageTarget =
    storageDriver === 'MINIO'
      ? `bucket: ${process.env.MINIO_BUCKET ?? 'sijalink-private'}`
      : `dir: ${process.env.PRIVATE_UPLOAD_DIR ?? 'private-uploads'}`;

  process.stdout.write(`
\x1b[32m✔ SijaLink Backend siap melayani request!\x1b[0m
  \x1b[36m➜\x1b[0m  \x1b[1mAPI Base:\x1b[0m     http://localhost:${port}/api/v1
  \x1b[36m➜\x1b[0m  \x1b[1mSwagger Docs:\x1b[0m http://localhost:${port}/docs
  \x1b[36m➜\x1b[0m  \x1b[1mDatabase:\x1b[0m     PostgreSQL (${process.env.DB_NAME ?? 'sijalink'})
  \x1b[36m➜\x1b[0m  \x1b[1mStorage:\x1b[0m      ${storageDriver} (${storageTarget})
\n`);
}
await bootstrap();
