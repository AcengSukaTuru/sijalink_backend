import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { JwtService } from '@nestjs/jwt';

describe('Health API (e2e)', () => {
  let app: INestApplication<App>;
  const db = {
    user: {
      findUnique: vi
        .fn()
        .mockResolvedValue({
          id: 'tech-1',
          email: 'tech@example.test',
          role: 'TECHNICIAN',
          active: true,
        }),
    },
    ticket: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn().mockResolvedValue(null),
    },
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(db)
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

  it('scopes technician jobs, hides someone else’s detail, and rejects email edits', async () => {
    const token = await app
      .get(JwtService)
      .signAsync({
        sub: 'tech-1',
        email: 'tech@example.test',
        role: 'TECHNICIAN',
      });
    await request(app.getHttpServer())
      .get('/api/v1/tickets?assigneeId=other')
      .auth(token, { type: 'bearer' })
      .expect(200)
      .expect(({ body }) =>
        expect(body).toMatchObject({ items: [], total: 0 }),
      );
    expect(db.ticket.findMany.mock.lastCall?.[0].where.assigneeId).toBe(
      'tech-1',
    );
    await request(app.getHttpServer())
      .get('/api/v1/tickets/someone-else')
      .auth(token, { type: 'bearer' })
      .expect(404);
    await request(app.getHttpServer())
      .patch('/api/v1/users/me')
      .auth(token, { type: 'bearer' })
      .send({ email: 'changed@example.test' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/attendance/check-in')
      .auth(token, { type: 'bearer' })
      .field('latitude', '-6.2')
      .expect(400);
  });

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
