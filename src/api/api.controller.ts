import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, PartialType } from '@nestjs/swagger';
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
  @IsOptional() @IsString() @MaxLength(200) search?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() assigneeId?: string;
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() limit?: string;
}
class CustomerDto {
  @IsString() accountCode!: string;
  @IsString() name!: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() plan?: string;
  @IsOptional() @IsDateString() installationDate?: string;
  @IsOptional() @IsString() pppoeUsername?: string;
  @IsOptional() @IsString() odp?: string;
  @IsOptional() @IsString() routerId?: string;
  @IsOptional() @IsEnum(['ACTIVE', 'ISOLATED', 'INACTIVE']) status?:
    'ACTIVE' | 'ISOLATED' | 'INACTIVE';
}
class UpdateCustomerDto extends PartialType(CustomerDto) {}
class TicketDto {
  @IsString() title!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() priority?: string;
  @IsOptional() @IsString() customerId?: string;
}
class SpkDto {
  @IsString() workType!: string;
  @IsString() address!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() customerId?: string;
}
class StatusDto {
  @IsEnum(['NEW', 'IN_PROGRESS', 'DONE', 'CANCELLED']) status!:
    'NEW' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
}
class AssignmentDto {
  @IsOptional() @IsString() assigneeId?: string | null;
}
class AttendanceDto {
  @IsOptional() @IsNumber() latitude?: number;
  @IsOptional() @IsNumber() longitude?: number;
}
class UserDto {
  @IsString() name!: string;
  @IsEmail() email!: string;
  @IsString() @MinLength(12) password!: string;
  @IsOptional() @IsEnum(['ADMIN', 'SUPERVISOR', 'TECHNICIAN']) role?:
    'ADMIN' | 'SUPERVISOR' | 'TECHNICIAN';
}
class RouterDto {
  @IsString() name!: string;
  @IsString() managementAddress!: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() version?: string;
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
  constructor(private readonly db: PrismaService) {}

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
  async tickets(@Query() q: PageDto) {
    assertStatusFilter(q.status, ['NEW', 'IN_PROGRESS', 'DONE', 'CANCELLED']);
    const p = pagination(q.page, q.limit);
    const where: any = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.assigneeId ? { assigneeId: q.assigneeId } : {}),
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
  ticket(@Param('id') id: string) {
    return this.db.ticket.findUniqueOrThrow({
      where: { id },
      include: ticketInclude,
    });
  }
  @ApiTags('Tickets')
  @Post('tickets')
  @Roles('ADMIN', 'SUPERVISOR', 'TECHNICIAN')
  createTicket(@Body() d: TicketDto) {
    return this.db.ticket.create({
      data: Object.assign({}, d, {
        number: `TKT-${Date.now()}-${randomUUID().slice(0, 8)}`,
      }),
      include: ticketInclude,
    });
  }
  @ApiTags('Tickets')
  @Patch('tickets/:id/status')
  async ticketStatus(@Param('id') id: string, @Body() d: StatusDto) {
    const prev = await this.db.ticket.findUniqueOrThrow({ where: { id } });
    assertStatusTransition(prev.status, d.status);
    return this.db.ticket.update({
      where: { id },
      data: { status: d.status },
      include: ticketInclude,
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
  async spks(@Query() q: PageDto) {
    assertStatusFilter(q.status, ['NEW', 'IN_PROGRESS', 'DONE', 'CANCELLED']);
    const p = pagination(q.page, q.limit);
    const where: any = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.assigneeId ? { assigneeId: q.assigneeId } : {}),
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
  spk(@Param('id') id: string) {
    return this.db.spk.findUniqueOrThrow({
      where: { id },
      include: ticketInclude,
    });
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
      const previous = await tx.spk.findUniqueOrThrow({ where: { id } });
      assertStatusTransition(previous.status, d.status);
      const updated = await tx.spk.update({
        where: { id },
        data: { status: d.status },
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
      if (updated.assigneeId)
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
  async checkIn(@CurrentUser() user: Principal, @Body() d: AttendanceDto) {
    this.validateLocation(d);
    const date = this.businessDate();
    const current = await this.db.attendance.findUnique({
      where: { userId_workDate: { userId: user.sub, workDate: date } },
    });
    assertCheckInAllowed(Boolean(current?.checkInAt));
    if (current)
      return this.db.attendance.update({
        where: { id: current.id },
        data: {
          checkInAt: new Date(),
          checkInLat: d.latitude,
          checkInLng: d.longitude,
        },
      });
    try {
      return await this.db.attendance.create({
        data: {
          userId: user.sub,
          workDate: date,
          checkInAt: new Date(),
          checkInLat: d.latitude,
          checkInLng: d.longitude,
        },
      });
    } catch (error) {
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
  async checkOut(@CurrentUser() user: Principal, @Body() d: AttendanceDto) {
    this.validateLocation(d);
    const date = this.businessDate();
    const current = await this.db.attendance.findUnique({
      where: { userId_workDate: { userId: user.sub, workDate: date } },
    });
    assertCheckOutAllowed(
      Boolean(current?.checkInAt),
      Boolean(current?.checkOutAt),
    );
    const result = await this.db.attendance.updateMany({
      where: { id: current!.id, checkOutAt: null },
      data: {
        checkOutAt: new Date(),
        checkOutLat: d.latitude,
        checkOutLng: d.longitude,
      },
    });
    if (!result.count)
      throw new ConflictException('Check-out hari ini sudah tercatat.');
    return this.db.attendance.findUniqueOrThrow({ where: { id: current!.id } });
  }
  @ApiTags('Attendance')
  @Get('attendance/today')
  today(@CurrentUser() user: Principal) {
    return this.db.attendance.findUnique({
      where: {
        userId_workDate: { userId: user.sub, workDate: this.businessDate() },
      },
    });
  }
  @ApiTags('Attendance')
  @Get('attendance/history')
  history(
    @CurrentUser() user: Principal,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('userId') userId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const p = pagination(page, limit);
    const owner = user.role === 'TECHNICIAN' ? user.sub : (userId ?? undefined);
    return this.db.attendance.findMany({
      where: {
        ...(owner ? { userId: owner } : {}),
        ...(from || to
          ? {
              workDate: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      ...p,
      orderBy: { workDate: 'desc' },
    });
  }
  @ApiTags('Attendance')
  @Get('attendance/summary')
  async summary(
    @CurrentUser() user: Principal,
    @Query('month') month?: string,
  ) {
    const m = month ?? this.businessDate().toISOString().slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(m))
      throw new BadRequestException('month harus berformat YYYY-MM.');
    const from = new Date(`${m}-01T00:00:00.000Z`);
    const to = new Date(
      Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1),
    );
    const rows = await this.db.attendance.findMany({
      where: { userId: user.sub, workDate: { gte: from, lt: to } },
      orderBy: { workDate: 'asc' },
    });
    return {
      month: m,
      totalPresent: rows.filter((r) => r.checkInAt).length,
      totalLate: null,
      lateRuleConfigured: false,
      records: rows,
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

  private businessDate() {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: process.env.BUSINESS_TIMEZONE ?? 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((value) => value.type === type)!.value;
    return new Date(
      Date.UTC(
        Number(part('year')),
        Number(part('month')) - 1,
        Number(part('day')),
      ),
    );
  }
  private validateLocation(d: AttendanceDto) {
    validateCoordinates(d.latitude, d.longitude);
  }
}
