import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Health API (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  it('/api/v1/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe('ok');
        expect(body.service).toBe('sijalink-backend');
      });
  });

  it('protects application endpoints with bearer authentication', () =>
    request(app.getHttpServer()).get('/api/v1/customers').expect(401));

  it('documents operations under feature-specific Swagger tags', () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().build(),
      { autoTagControllers: false },
    );
    const tags = new Set(
      Object.values(document.paths).flatMap((path) =>
        Object.values(path ?? {}).flatMap((operation) =>
          operation && 'tags' in operation ? (operation.tags ?? []) : [],
        ),
      ),
    );
    expect(tags).toEqual(
      new Set([
        'auth',
        'Users',
        'Customers',
        'Tickets',
        'SPK',
        'Attendance',
        'Notifications',
        'Routers',
        'health',
      ]),
    );
  });

  afterEach(async () => {
    await app.close();
  });
});
