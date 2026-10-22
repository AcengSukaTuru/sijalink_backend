import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '../auth/auth.js';
import type { Principal } from '../auth/auth.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { businessDay, workRange } from './leave-rules.js';
import { pagination } from './rules.js';

class RequestLeaveDto {
  @IsEnum(['SICK', 'PERMISSION']) type!: 'SICK' | 'PERMISSION';
  @IsString() @MinLength(5) @MaxLength(1000) reason!: string;
  @IsString() startDate!: string;
  @IsString() endDate!: string;
}
class ReviewDto {
  @IsEnum(['APPROVED', 'REJECTED']) status!: 'APPROVED' | 'REJECTED';
}

@ApiTags('Attendance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('attendance/leave-requests')
export class LeaveController {
  constructor(private readonly db: PrismaService) {}

  @Post()
  @Roles('TECHNICIAN')
  async request(@CurrentUser() actor: Principal, @Body() dto: RequestLeaveDto) {
    const { start, end } = workRange(dto.startDate, dto.endDate);
    if (start < businessDay())
      throw new BadRequestException('Tanggal awal izin tidak boleh lampau.');
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${actor.sub}))::text`;
      const overlapping = await tx.leaveRequest.findFirst({
        where: {
          userId: actor.sub,
          status: { in: ['PENDING', 'APPROVED'] },
          startDate: { lte: end },
          endDate: { gte: start },
        },
      });
      if (overlapping)
        throw new ConflictException(
          'Permohonan izin pada rentang ini sudah ada.',
        );
      const present = await tx.attendance.findFirst({
        where: {
          userId: actor.sub,
          workDate: { gte: start, lte: end },
          checkInAt: { not: null },
        },
      });
      if (present)
        throw new ConflictException('Sudah ada check-in pada rentang izin.');
      return tx.leaveRequest.create({
        data: {
          userId: actor.sub,
          type: dto.type,
          reason: dto.reason,
          startDate: start,
          endDate: end,
        },
      });
    });
  }

  @Get()
  async list(
    @CurrentUser() actor: Principal,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('userId') userId?: string,
    @Query('status') status?: string,
  ) {
    if (status && !['PENDING', 'APPROVED', 'REJECTED'].includes(status))
      throw new BadRequestException('Filter status tidak valid.');
    const p = pagination(page, limit);
    const where = {
      ...(actor.role === 'TECHNICIAN'
        ? { userId: actor.sub }
        : userId
          ? { userId }
          : {}),
      ...(status
        ? { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.db.leaveRequest.findMany({
        where,
        ...p,
        orderBy: { createdAt: 'desc' },
      }),
      this.db.leaveRequest.count({ where }),
    ]);
    return {
      items,
      total,
      page: Math.floor(p.skip / p.take) + 1,
      limit: p.take,
    };
  }

  @Patch(':id/review')
  @Roles('ADMIN', 'SUPERVISOR')
  async review(
    @Param('id') id: string,
    @CurrentUser() actor: Principal,
    @Body() dto: ReviewDto,
  ) {
    return this.db.$transaction(async (tx) => {
      const initial = await tx.leaveRequest.findUnique({ where: { id } });
      if (!initial) throw new NotFoundException();
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${initial.userId}))::text`;
      const leave = await tx.leaveRequest.findUniqueOrThrow({ where: { id } });
      if (leave.status !== 'PENDING')
        throw new ConflictException('Permohonan sudah diproses.');
      if (dto.status === 'APPROVED') {
        const present = await tx.attendance.findFirst({
          where: {
            userId: leave.userId,
            workDate: { gte: leave.startDate, lte: leave.endDate },
            checkInAt: { not: null },
          },
        });
        if (present)
          throw new ConflictException('Sudah ada check-in pada rentang izin.');
      }
      const result = await tx.leaveRequest.updateMany({
        where: { id, status: 'PENDING' },
        data: {
          status: dto.status,
          reviewedById: actor.sub,
          reviewedAt: new Date(),
        },
      });
      if (!result.count)
        throw new ConflictException('Permohonan sudah diproses.');
      await tx.auditLog.create({
        data: {
          actorId: actor.sub,
          entityType: 'LEAVE_REQUEST',
          entityId: id,
          action: 'REVIEWED',
          before: { status: leave.status },
          after: { status: dto.status },
        },
      });
      await tx.notification.create({
        data: {
          userId: leave.userId,
          title: `Permohonan ${leave.type === 'SICK' ? 'sakit' : 'izin'} ${dto.status === 'APPROVED' ? 'disetujui' : 'ditolak'}`,
          body: `${leave.startDate.toISOString().slice(0, 10)} sampai ${leave.endDate.toISOString().slice(0, 10)}`,
        },
      });
      return tx.leaveRequest.findUniqueOrThrow({ where: { id } });
    });
  }
}
