import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Header,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Type } from 'class-transformer';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
  PartialType,
} from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { hash } from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '../auth/auth.js';
import type { Principal } from '../auth/auth.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MikrotikService } from '../integrations/mikrotik/mikrotik.service.js';
import {
  PrivatePhotosService,
  type PhotoUpload,
} from './private-photos.service.js';
import { businessDay, isLate, workDay } from './leave-rules.js';
import { publicAttendance } from './attendance-response.js';
import {
  assertStatusTransition,
  pagination,
  validateCoordinates,
  ownedNotificationFilter,
  assertCheckInAllowed,
  assertCheckOutAllowed,
  assertStatusFilter,
} from './rules.js';

class PageDto {
  @ApiPropertyOptional({ example: 'Budi' })
  @IsOptional() @IsString() @MaxLength(200) search?: string;
  @ApiPropertyOptional({ example: 'ACTIVE' })
  @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional({ example: 'user-id-from-api' })
  @IsOptional() @IsString() assigneeId?: string;
  @ApiPropertyOptional({ example: '1', default: '1' })
  @IsOptional() @IsString() page?: string;
  @ApiPropertyOptional({ example: '20', default: '20' })
  @IsOptional() @IsString() limit?: string;
}
class CustomerDto {
  @ApiProperty({ example: 'CUST-001' })
  @IsString() accountCode!: string;
  @ApiProperty({ example: 'Budi Santoso' })
  @IsString() name!: string;
  @ApiPropertyOptional({ example: '081234567890' })
  @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional({ example: 'Jl. Merdeka No. 10, Jakarta' })
  @IsOptional() @IsString() address?: string;
  @ApiPropertyOptional({ example: '50 Mbps' })
  @IsOptional() @IsString() plan?: string;
  @ApiPropertyOptional({ example: '2026-01-15T00:00:00.000Z' })
  @IsOptional() @IsDateString() installationDate?: string;
  @ApiPropertyOptional({ example: 'budi-customer' })
  @IsOptional() @IsString() pppoeUsername?: string;
  @ApiPropertyOptional({ example: 'ODP-01 / Port 4' })
  @IsOptional() @IsString() odp?: string;
  @ApiPropertyOptional({ example: 'router-id-from-api' })
  @IsOptional() @IsString() routerId?: string;
  @ApiPropertyOptional({ enum: ['ACTIVE', 'ISOLATED', 'INACTIVE'], example: 'ACTIVE' })
  @IsOptional() @IsEnum(['ACTIVE', 'ISOLATED', 'INACTIVE']) status?:
    'ACTIVE' | 'ISOLATED' | 'INACTIVE';
}
class UpdateCustomerDto extends PartialType(CustomerDto) {}
class TicketDto {
  @ApiProperty({ example: 'Internet pelanggan tidak bisa digunakan' })
  @IsString() title!: string;
  @ApiPropertyOptional({ example: 'Lampu LOS menyala merah.' })
  @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional({ example: 'HIGH' })
  @IsOptional() @IsString() priority?: string;
  @ApiPropertyOptional({ example: 'customer-id-from-api' })
  @IsOptional() @IsString() customerId?: string;
}
class SpkDto {
  @ApiProperty({ example: 'Pemasangan baru' })
  @IsString() workType!: string;
  @ApiProperty({ example: 'Jl. Merdeka No. 10, Jakarta' })
  @IsString() address!: string;
  @ApiPropertyOptional({ example: 'Pasang ONU dan tarik kabel dropcore.' })
  @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional({ example: 'customer-id-from-api' })
  @IsOptional() @IsString() customerId?: string;
}
class StatusDto {
  @ApiProperty({ enum: ['NEW', 'IN_PROGRESS', 'DONE', 'CANCELLED'], example: 'IN_PROGRESS' })
  @IsEnum(['NEW', 'IN_PROGRESS', 'DONE', 'CANCELLED']) status!:
    'NEW' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
}
class AssignmentDto {
  @ApiPropertyOptional({ example: 'user-id-from-api', nullable: true })
  @IsOptional() @IsString() assigneeId?: string | null;
}
class AttendanceDto {
  @ApiPropertyOptional({ example: -6.200000, description: 'Latitude lokasi teknisi.' })
  @IsOptional() @Type(() => Number) @IsNumber() latitude?: number;
  @ApiPropertyOptional({ example: 106.816666, description: 'Longitude lokasi teknisi.' })
  @IsOptional() @Type(() => Number) @IsNumber() longitude?: number;
}
class UserDto {
  @ApiProperty({ example: 'Teknisi Baru' })
  @IsString() name!: string;
  @ApiProperty({ example: 'teknisi.baru@sijalink.test' })
  @IsEmail() email!: string;
  @ApiProperty({ example: 'Password-Aman-123!' })
  @IsString() @MinLength(12) password!: string;
  @ApiPropertyOptional({ enum: ['ADMIN', 'SUPERVISOR', 'TECHNICIAN'], example: 'TECHNICIAN' })
  @IsOptional() @IsEnum(['ADMIN', 'SUPERVISOR', 'TECHNICIAN']) role?:
    'ADMIN' | 'SUPERVISOR' | 'TECHNICIAN';
}
class RouterDto {
  @ApiProperty({ example: 'Router Pusat' })
  @IsString() name!: string;
  @ApiProperty({ example: '192.168.88.1' })
  @IsString() managementAddress!: string;
  @ApiPropertyOptional({ example: 'Ruang server utama' })
  @IsOptional() @IsString() location?: string;
  @ApiPropertyOptional({ example: 'RouterOS 7.16' })
  @IsOptional() @IsString() version?: string;
  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional() @IsBoolean() enabled?: boolean;
}
class UpdateRouterDto extends PartialType(RouterDto) {}

const ticketInclude = {
  customer: {
    select: { id: true, accountCode: true, name: true, address: true },
  },
  assignee: { select: { id: true, name: true, email: true } },
};
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class ApiController {
  constructor(
    private readonly db: PrismaService,
    private readonly photos: PrivatePhotosService,
    private readonly mikrotik: MikrotikService,
  ) {}

  @ApiTags('Users')
  @Get('users')
  @Roles('ADMIN', 'SUPERVISOR')
  users() {
    return this.db.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
      },
    });
  }
  @ApiTags('Users')
  @Post('users')
  @Roles('ADMIN')
  async createUser(@Body() d: UserDto) {
    return this.db.user.create({
      data: {
        name: d.name,
        email: d.email,
        passwordHash: await hash(d.password, 12),
        role: d.role ?? 'TECHNICIAN',
      },
      select: { id: true, name: true, email: true, role: true, active: true },
    });
  }

  @ApiTags('Customers')
  @Get('customers')
  async customers(@Query() q: PageDto) {
    assertStatusFilter(q.status, ['ACTIVE', 'ISOLATED', 'INACTIVE']);
    const p = pagination(q.page, q.limit);
    const where: any = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.search
        ? {
            OR: [
              { name: { contains: q.search, mode: 'insensitive' } },
              { accountCode: { contains: q.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.db.customer.findMany({
        where,
        ...p,
        orderBy: { name: 'asc' },
        include: { router: { select: { id: true, name: true } } },
      }),
      this.db.customer.count({ where }),
    ]);
    return { items, total, page: Number(q.page) || 1, limit: p.take };
  }
  @ApiTags('Customers')
  @Get('customers/:id')
  customer(@Param('id') id: string) {
    return this.db.customer.findUniqueOrThrow({
      where: { id },
      include: { router: { select: { id: true, name: true } } },
    });
  }
  @ApiTags('Customers')
  @Post('customers')
  @Roles('ADMIN', 'SUPERVISOR')
  createCustomer(@Body() d: CustomerDto) {
    return this.db.customer.create({
      data: Object.assign({}, d, {
        installationDate: d.installationDate
          ? new Date(d.installationDate)
          : undefined,
      }),
    });
  }
  @ApiTags('Customers')
  @Patch('customers/:id')
  @Roles('ADMIN', 'SUPERVISOR')
  updateCustomer(@Param('id') id: string, @Body() d: UpdateCustomerDto) {
    return this.db.customer.update({
      where: { id },
      data: Object.assign({}, d, {
        installationDate: d.installationDate
          ? new Date(d.installationDate)
          : undefined,
      }),
    });
  }
  @ApiTags('Customers')
  @Delete('customers/:id')
  @Roles('ADMIN', 'SUPERVISOR')
  async deleteCustomer(@Param('id') id: string) {
    await this.db.customer.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });
    return { success: true };
  }

  @ApiTags('Tickets')
  @Get('tickets')
  async tickets(@Query() q: PageDto, @CurrentUser() actor: Principal) {
    assertStatusFilter(q.status, ['NEW', 'IN_PROGRESS', 'DONE', 'CANCELLED']);
    const p = pagination(q.page, q.limit);
    const where: any = {
      ...(q.status ? { status: q.status } : {}),
      ...(actor.role === 'TECHNICIAN'
        ? { assigneeId: actor.sub }
        : q.assigneeId
          ? { assigneeId: q.assigneeId }
          : {}),
      ...(q.search
        ? {
            OR: [
              { number: { contains: q.search, mode: 'insensitive' } },
              { title: { contains: q.search, mode: 'insensitive' } },
              {
                customer: { name: { contains: q.search, mode: 'insensitive' } },
              },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.db.ticket.findMany({
        where,
        ...p,
        orderBy: { createdAt: 'desc' },
        include: ticketInclude,
      }),
      this.db.ticket.count({ where }),
    ]);
    return { items, total, page: Number(q.page) || 1, limit: p.take };
  }
  @ApiTags('Tickets')
  @Get('tickets/:id')
  async ticket(@Param('id') id: string, @CurrentUser() actor: Principal) {
    const result = await this.db.ticket.findFirst({
      where: {
        id,
        ...(actor.role === 'TECHNICIAN' ? { assigneeId: actor.sub } : {}),
      },
      include: ticketInclude,
    });
    if (!result) throw new NotFoundException();
    return result;
  }
  @ApiTags('Tickets')
  @Post('tickets')
  @Roles('ADMIN', 'SUPERVISOR', 'TECHNICIAN')
  createTicket(@Body() d: TicketDto, @CurrentUser() actor: Principal) {
    return this.db.ticket.create({
      data: Object.assign({}, d, {
        number: `TKT-${Date.now()}-${randomUUID().slice(0, 8)}`,
        ...(actor.role === 'TECHNICIAN' ? { assigneeId: actor.sub } : {}),
      }),
      include: ticketInclude,
    });
  }
  @ApiTags('Tickets')
  @Patch('tickets/:id/status')
  async ticketStatus(
    @Param('id') id: string,
    @Body() d: StatusDto,
    @CurrentUser() actor: Principal,
  ) {
    return this.db.$transaction(async (tx) => {
      const prev = await tx.ticket.findFirst({
        where: {
          id,
          ...(actor.role === 'TECHNICIAN' ? { assigneeId: actor.sub } : {}),
        },
      });
      if (!prev) throw new NotFoundException();
      assertStatusTransition(prev.status, d.status, actor.role);
      const changed = await tx.ticket.updateMany({
        where: {
          id,
          status: prev.status,
          ...(actor.role === 'TECHNICIAN' ? { assigneeId: actor.sub } : {}),
        },
        data: { status: d.status },
      });
      if (!changed.count)
        throw new ConflictException('Pekerjaan berubah; muat ulang.');
      const updated = await tx.ticket.findUniqueOrThrow({
        where: { id },
        include: ticketInclude,
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.sub,
          entityType: 'TICKET',
          entityId: id,
          action: 'STATUS_CHANGED',
          before: { status: prev.status },
          after: { status: updated.status },
        },
      });
      if (updated.assigneeId && updated.assigneeId !== actor.sub)
        await tx.notification.create({
          data: {
            userId: updated.assigneeId,
            title: `Tiket diperbarui: ${updated.number}`,
            body: `Status pekerjaan berubah menjadi ${updated.status}`,
          },
        });
      return updated;
    });
  }
  @ApiTags('Tickets')
  @Patch('tickets/:id/assignment')
  @Roles('ADMIN', 'SUPERVISOR')
  ticketAssignment(@Param('id') id: string, @Body() d: AssignmentDto) {
    return this.db.ticket.update({
      where: { id },
      data: { assigneeId: d.assigneeId ?? null },
      include: ticketInclude,
    });
  }

  @ApiTags('SPK')
  @Get('spk')
  async spks(@Query() q: PageDto, @CurrentUser() actor: Principal) {
    assertStatusFilter(q.status, ['NEW', 'IN_PROGRESS', 'DONE', 'CANCELLED']);
    const p = pagination(q.page, q.limit);
    const where: any = {
      ...(q.status ? { status: q.status } : {}),
      ...(actor.role === 'TECHNICIAN'
        ? { assigneeId: actor.sub }
        : q.assigneeId
          ? { assigneeId: q.assigneeId }
          : {}),
      ...(q.search
        ? {
            OR: [
              { number: { contains: q.search, mode: 'insensitive' } },
              { workType: { contains: q.search, mode: 'insensitive' } },
              {
                customer: { name: { contains: q.search, mode: 'insensitive' } },
              },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.db.spk.findMany({
        where,
        ...p,
        orderBy: { createdAt: 'desc' },
        include: ticketInclude,
      }),
      this.db.spk.count({ where }),
    ]);
    return { items, total, page: Number(q.page) || 1, limit: p.take };
  }
  @ApiTags('SPK')
  @Get('spk/:id')
  async spk(@Param('id') id: string, @CurrentUser() actor: Principal) {
    const result = await this.db.spk.findFirst({
      where: {
        id,
        ...(actor.role === 'TECHNICIAN' ? { assigneeId: actor.sub } : {}),
      },
      include: ticketInclude,
    });
    if (!result) throw new NotFoundException();
    return result;
  }
  @ApiTags('SPK')
  @Post('spk')
  @Roles('ADMIN', 'SUPERVISOR')
  createSpk(@Body() d: SpkDto) {
    return this.db.spk.create({
      data: Object.assign({}, d, {
        number: `SPK-${Date.now()}-${randomUUID().slice(0, 8)}`,
      }),
      include: ticketInclude,
    });
  }
  @ApiTags('SPK')
  @Patch('spk/:id/status')
  async spkStatus(
    @Param('id') id: string,
    @Body() d: StatusDto,
    @CurrentUser() actor: Principal,
  ) {
    return this.db.$transaction(async (tx) => {
      const previous = await tx.spk.findFirst({
        where: {
          id,
          ...(actor.role === 'TECHNICIAN' ? { assigneeId: actor.sub } : {}),
        },
      });
      if (!previous) throw new NotFoundException();
      assertStatusTransition(previous.status, d.status, actor.role);
      const changed = await tx.spk.updateMany({
        where: {
          id,
          status: previous.status,
          ...(actor.role === 'TECHNICIAN' ? { assigneeId: actor.sub } : {}),
        },
        data: { status: d.status },
      });
      if (!changed.count)
        throw new ConflictException('Pekerjaan berubah; muat ulang.');
      const updated = await tx.spk.findUniqueOrThrow({
        where: { id },
        include: ticketInclude,
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.sub,
          entityType: 'SPK',
          entityId: id,
          action: 'STATUS_CHANGED',
          before: { status: previous.status },
          after: { status: updated.status },
        },
      });
      if (updated.assigneeId && updated.assigneeId !== actor.sub)
        await tx.notification.create({
          data: {
            userId: updated.assigneeId,
            title: `SPK diperbarui: ${updated.number}`,
            body: `Status pekerjaan berubah menjadi ${updated.status}`,
            spkNumber: updated.number,
          },
        });
      return updated;
    });
  }
  @ApiTags('SPK')
  @Patch('spk/:id/assignment')
  @Roles('ADMIN', 'SUPERVISOR')
  async spkAssignment(
    @Param('id') id: string,
    @Body() d: AssignmentDto,
    @CurrentUser() actor: Principal,
  ) {
    return this.db.$transaction(async (tx) => {
      const previous = await tx.spk.findUniqueOrThrow({ where: { id } });
      const updated = await tx.spk.update({
        where: { id },
        data: { assigneeId: d.assigneeId ?? null },
        include: ticketInclude,
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.sub,
          entityType: 'SPK',
          entityId: id,
          action: 'ASSIGNMENT_CHANGED',
          before: { assigneeId: previous.assigneeId },
          after: { assigneeId: updated.assigneeId },
        },
      });
      if (updated.assigneeId)
        await tx.notification.create({
          data: {
            userId: updated.assigneeId,
            title: `SPK ditugaskan: ${updated.number}`,
            body: `${updated.workType} — ${updated.address}`,
            spkNumber: updated.number,
          },
        });
      return updated;
    });
  }

  @ApiTags('Attendance')
  @Post('attendance/check-in')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['photo'],
      properties: {
        photo: { type: 'string', format: 'binary' },
        latitude: { type: 'number' },
        longitude: { type: 'number' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('photo', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  async checkIn(
    @CurrentUser() user: Principal,
    @Body() d: AttendanceDto,
    @UploadedFile() file?: PhotoUpload,
  ) {
    this.validateLocation(d);
    const key = await this.photos.save(file);
    try {
      const result = await this.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${user.sub}))::text`;
        const date = businessDay();
        const leave = await tx.leaveRequest.findFirst({
          where: {
            userId: user.sub,
            status: 'APPROVED',
            startDate: { lte: date },
            endDate: { gte: date },
          },
        });
        if (leave)
          throw new ConflictException(
            'Hari ini sudah tercatat sebagai izin disetujui.',
          );
        const current = await tx.attendance.findUnique({
          where: { userId_workDate: { userId: user.sub, workDate: date } },
        });
        assertCheckInAllowed(Boolean(current?.checkInAt));
        const data = {
          checkInAt: new Date(),
          checkInLat: d.latitude,
          checkInLng: d.longitude,
          checkInPhotoKey: key,
        };
        return current
          ? tx.attendance.update({ where: { id: current.id }, data })
          : tx.attendance.create({
              data: { userId: user.sub, workDate: date, ...data },
            });
      });
      return publicAttendance(result);
    } catch (error) {
      await this.photos.remove(key);
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Check-in hari ini sudah tercatat.');
      }
      throw error;
    }
  }
  @ApiTags('Attendance')
  @Post('attendance/check-out')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['photo'],
      properties: {
        photo: { type: 'string', format: 'binary' },
        latitude: { type: 'number' },
        longitude: { type: 'number' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('photo', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  async checkOut(
    @CurrentUser() user: Principal,
    @Body() d: AttendanceDto,
    @UploadedFile() file?: PhotoUpload,
  ) {
    this.validateLocation(d);
    const key = await this.photos.save(file);
    try {
      const result = await this.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${user.sub}))::text`;
        const date = businessDay();
        const current = await tx.attendance.findUnique({
          where: { userId_workDate: { userId: user.sub, workDate: date } },
        });
        assertCheckOutAllowed(
          Boolean(current?.checkInAt),
          Boolean(current?.checkOutAt),
        );
        const result = await tx.attendance.updateMany({
          where: { id: current!.id, checkOutAt: null },
          data: {
            checkOutAt: new Date(),
            checkOutLat: d.latitude,
            checkOutLng: d.longitude,
            checkOutPhotoKey: key,
          },
        });
        if (!result.count)
          throw new ConflictException('Check-out hari ini sudah tercatat.');
        return tx.attendance.findUniqueOrThrow({ where: { id: current!.id } });
      });
      return publicAttendance(result);
    } catch (error) {
      await this.photos.remove(key);
      throw error;
    }
  }
  @ApiTags('Attendance')
  @Get('attendance/today')
  async today(@CurrentUser() user: Principal) {
    const record = await this.db.attendance.findUnique({
      where: {
        userId_workDate: { userId: user.sub, workDate: businessDay() },
      },
    });
    return record ? publicAttendance(record) : null;
  }
  @ApiTags('Attendance')
  @Get('attendance/:id/photo/:kind')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Cache-Control', 'private, no-store')
  async attendancePhoto(
    @CurrentUser() user: Principal,
    @Param('id') id: string,
    @Param('kind') kind: string,
  ): Promise<StreamableFile> {
    if (kind !== 'check-in' && kind !== 'check-out')
      throw new NotFoundException();
    const record = await this.db.attendance.findFirst({
      where: {
        id,
        ...(user.role === 'TECHNICIAN' ? { userId: user.sub } : {}),
      },
    });
    if (!record) throw new NotFoundException();
    return this.photos.open(
      kind === 'check-in' ? record.checkInPhotoKey : record.checkOutPhotoKey,
    );
  }
  @ApiTags('Attendance')
  @Get('attendance/history')
  async history(
    @CurrentUser() user: Principal,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('userId') userId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (from) workDay(from);
    if (to) workDay(to);
    if (from && to && from > to)
      throw new BadRequestException('from tidak boleh setelah to.');
    const p = pagination(page, limit);
    const owner = user.role === 'TECHNICIAN' ? user.sub : (userId ?? undefined);
    const rows = await this.db.attendance.findMany({
      where: {
        ...(owner ? { userId: owner } : {}),
        ...(from || to
          ? {
              workDate: {
                ...(from ? { gte: workDay(from) } : {}),
                ...(to ? { lte: workDay(to) } : {}),
              },
            }
          : {}),
      },
      ...p,
      orderBy: { workDate: 'desc' },
    });
    return rows.map(publicAttendance);
  }
  @ApiTags('Attendance')
  @Get('attendance/summary')
  async summary(
    @CurrentUser() user: Principal,
    @Query('month') month?: string,
  ) {
    const m = month ?? businessDay().toISOString().slice(0, 7);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(m))
      throw new BadRequestException('month harus berformat YYYY-MM.');
    const from = new Date(`${m}-01T00:00:00.000Z`);
    const to = new Date(
      Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1),
    );
    const rows = await this.db.attendance.findMany({
      where: { userId: user.sub, workDate: { gte: from, lt: to } },
      orderBy: { workDate: 'asc' },
    });
    const leaves = await this.db.leaveRequest.findMany({
      where: {
        userId: user.sub,
        status: 'APPROVED',
        startDate: { lt: to },
        endDate: { gte: from },
      },
    });
    const leaveDays = {
      SICK: new Set<string>(),
      PERMISSION: new Set<string>(),
    };
    for (const leave of leaves) {
      for (
        let day = Math.max(leave.startDate.getTime(), from.getTime());
        day <= Math.min(leave.endDate.getTime(), to.getTime() - 86400000);
        day += 86400000
      )
        leaveDays[leave.type].add(new Date(day).toISOString().slice(0, 10));
    }
    return {
      month: m,
      totalPresent: rows.filter((r) => r.checkInAt).length,
      totalLate: rows.filter((r) => r.checkInAt && isLate(r.checkInAt)).length,
      totalSick: leaveDays.SICK.size,
      totalPermission: leaveDays.PERMISSION.size,
      lateRuleConfigured: true,
      records: rows.map(publicAttendance),
    };
  }

  @ApiTags('Notifications')
  @Get('notifications')
  notifications(
    @CurrentUser() u: Principal,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    const p = pagination(page, limit);
    return this.db.notification.findMany({
      where: {
        userId: u.sub,
        ...(unreadOnly === 'true' ? { readAt: null } : {}),
      },
      ...p,
      orderBy: { createdAt: 'desc' },
    });
  }
  @ApiTags('Notifications')
  @Get('notifications/unread-count')
  async unreadCount(@CurrentUser() u: Principal) {
    return {
      count: await this.db.notification.count({
        where: { userId: u.sub, readAt: null },
      }),
    };
  }
  @ApiTags('Notifications')
  @Patch('notifications/:id/read')
  async readNotification(@CurrentUser() u: Principal, @Param('id') id: string) {
    const n = await this.db.notification.findFirst({
      where: ownedNotificationFilter(u.sub, id),
    });
    if (!n) throw new NotFoundException();
    return this.db.notification.update({
      where: { id },
      data: { readAt: n.readAt ?? new Date() },
    });
  }
  @ApiTags('Notifications')
  @Patch('notifications/read-all')
  async readAll(@CurrentUser() u: Principal) {
    const result = await this.db.notification.updateMany({
      where: { ...ownedNotificationFilter(u.sub), readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }
  @ApiTags('Notifications')
  @Delete('notifications/:id')
  async removeNotification(
    @CurrentUser() u: Principal,
    @Param('id') id: string,
  ) {
    const result = await this.db.notification.deleteMany({
      where: ownedNotificationFilter(u.sub, id),
    });
    if (!result.count) throw new NotFoundException();
    return { success: true };
  }

  @ApiTags('Routers')
  @Get('routers')
  routers() {
    return this.db.router.findMany({
      select: {
        id: true,
        name: true,
        managementAddress: true,
        location: true,
        version: true,
        enabled: true,
        status: true,
        lastCheckedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
  @ApiTags('Routers')
  @Get('routers/:id/health')
  async routerHealth(@Param('id') id: string) {
    const router = await this.db.router.findUnique({
      where: { id },
      select: { id: true, managementAddress: true, enabled: true },
    });
    if (!router) throw new NotFoundException();
    if (!router.enabled)
      throw new ConflictException('Router sedang dinonaktifkan.');
    if (router.managementAddress !== this.mikrotik.getConnectionConfig().host)
      throw new ConflictException(
        'Router belum terhubung ke credential MikroTik aktif.',
      );

    const checkedAt = new Date();
    try {
      const [identity, resource] = await Promise.all([
        this.mikrotik.identity(),
        this.mikrotik.resource(),
      ]);
      await this.db.router.update({
        where: { id },
        data: {
          status: 'ONLINE',
          lastCheckedAt: checkedAt,
          version:
            typeof resource[0]?.version === 'string'
              ? resource[0].version
              : '',
        },
      });
      return {
        routerId: id,
        reachable: true,
        checkedAt,
        identity: identity[0] ?? null,
        resource: resource[0] ?? null,
      };
    } catch (error) {
      await this.db.router.update({
        where: { id },
        data: { status: 'OFFLINE', lastCheckedAt: checkedAt },
      });
      throw error;
    }
  }

  @ApiTags('Routers')
  @Get('routers/:id/resource')
  async routerResource(@Param('id') id: string) {
    const router = await this.db.router.findUnique({
      where: { id },
      select: { id: true, managementAddress: true, enabled: true },
    });
    if (!router) throw new NotFoundException();
    if (!router.enabled) throw new ConflictException('Router sedang dinonaktifkan.');
    if (router.managementAddress !== this.mikrotik.getConnectionConfig().host)
      throw new ConflictException('Router belum terhubung ke credential MikroTik aktif.');
    return { routerId: id, resource: await this.mikrotik.resource() };
  }

  @ApiTags('Routers')
  @Get('routers/:id/interfaces')
  async routerInterfaces(@Param('id') id: string) {
    const router = await this.db.router.findUnique({
      where: { id },
      select: { id: true, managementAddress: true, enabled: true },
    });
    if (!router) throw new NotFoundException();
    if (!router.enabled) throw new ConflictException('Router sedang dinonaktifkan.');
    if (router.managementAddress !== this.mikrotik.getConnectionConfig().host)
      throw new ConflictException('Router belum terhubung ke credential MikroTik aktif.');
    return { routerId: id, interfaces: await this.mikrotik.interfaces() };
  }

  @ApiTags('Routers')
  @Get('routers/:id')
  router(@Param('id') id: string) {
    return this.db.router.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        name: true,
        managementAddress: true,
        location: true,
        version: true,
        enabled: true,
        status: true,
        lastCheckedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
  @ApiTags('Routers')
  @Post('routers')
  @Roles('ADMIN', 'SUPERVISOR')
  createRouter(@Body() d: RouterDto) {
    return this.db.router.create({
      data: Object.assign({}, d, { status: 'UNKNOWN' as const }),
    });
  }
  @ApiTags('Routers')
  @Patch('routers/:id')
  @Roles('ADMIN', 'SUPERVISOR')
  updateRouter(@Param('id') id: string, @Body() d: UpdateRouterDto) {
    return this.db.router.update({ where: { id }, data: d });
  }
  @ApiTags('Routers')
  @Delete('routers/:id')
  @Roles('ADMIN', 'SUPERVISOR')
  async deleteRouter(@Param('id') id: string) {
    await this.db.router.delete({ where: { id } });
    return { success: true };
  }

  private validateLocation(d: AttendanceDto) {
    validateCoordinates(d.latitude, d.longitude);
  }
}
