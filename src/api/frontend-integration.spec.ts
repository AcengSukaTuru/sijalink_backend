import { ConflictException, NotFoundException } from '@nestjs/common';
import { ApiController } from './api.controller.js';
import { LeaveController } from './leave.controller.js';
import { businessDay, isLate, workRange } from './leave-rules.js';
import { publicAttendance } from './attendance-response.js';

const technician = {
  sub: 'tech-1',
  email: 'tech@test.invalid',
  role: 'TECHNICIAN' as const,
};
const supervisor = {
  sub: 'boss-1',
  email: 'boss@test.invalid',
  role: 'SUPERVISOR' as const,
};

describe('frontend integration security', () => {
  it('forces technician list scope and hides other technicians’ details', async () => {
    const db = {
      ticket: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      spk: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const api = new ApiController(db as never, {} as never);
    await api.tickets({ assigneeId: 'tech-2' }, technician);
    await api.spks({ assigneeId: 'tech-2' }, technician);
    expect(db.ticket.findMany.mock.calls[0][0].where.assigneeId).toBe('tech-1');
    expect(db.spk.findMany.mock.calls[0][0].where.assigneeId).toBe('tech-1');
    await expect(api.ticket('other-ticket', technician)).rejects.toThrow(
      NotFoundException,
    );
    await expect(api.spk('other-spk', technician)).rejects.toThrow(
      NotFoundException,
    );
    expect(db.ticket.findFirst.mock.calls[0][0].where).toMatchObject({
      id: 'other-ticket',
      assigneeId: 'tech-1',
    });
    expect(db.spk.findFirst.mock.calls[0][0].where).toMatchObject({
      id: 'other-spk',
      assigneeId: 'tech-1',
    });
    await api.tickets({ assigneeId: 'tech-2' }, supervisor);
    expect(db.ticket.findMany.mock.calls[1][0].where.assigneeId).toBe('tech-2');
  });

  it('denies technician status changes on jobs they do not own', async () => {
    const tx = {
      ticket: {
        findFirst: vi.fn().mockResolvedValue(null),
        updateMany: vi.fn(),
      },
      spk: { findFirst: vi.fn().mockResolvedValue(null), updateMany: vi.fn() },
    };
    const db = {
      $transaction: (fn: (value: typeof tx) => Promise<unknown>) => fn(tx),
    };
    const api = new ApiController(db as never, {} as never);
    await expect(
      api.ticketStatus('other-ticket', { status: 'DONE' }, technician),
    ).rejects.toThrow(NotFoundException);
    await expect(
      api.spkStatus('other-spk', { status: 'DONE' }, technician),
    ).rejects.toThrow(NotFoundException);
    expect(tx.ticket.updateMany).not.toHaveBeenCalled();
    expect(tx.spk.updateMany).not.toHaveBeenCalled();
  });

  it('rejects leave overlapping attendance and does not create it', async () => {
    const tx = {
      $queryRaw: vi.fn(),
      leaveRequest: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },
      attendance: {
        findFirst: vi.fn().mockResolvedValue({ id: 'checked-in' }),
      },
    };
    const db = {
      $transaction: (fn: (value: typeof tx) => Promise<unknown>) => fn(tx),
    };
    const api = new LeaveController(db as never);
    const day = businessDay().toISOString().slice(0, 10);
    await expect(
      api.request(technician, {
        type: 'SICK',
        reason: 'Sedang sakit',
        startDate: day,
        endDate: day,
      }),
    ).rejects.toThrow(ConflictException);
    expect(tx.leaveRequest.create).not.toHaveBeenCalled();
  });

  it('rejects approval if a pending leave overlaps check-in', async () => {
    const day = businessDay();
    const leave = {
      id: 'leave-1',
      userId: 'tech-1',
      startDate: day,
      endDate: day,
      status: 'PENDING',
    };
    const tx = {
      $queryRaw: vi.fn(),
      leaveRequest: {
        findUnique: vi.fn().mockResolvedValue(leave),
        findUniqueOrThrow: vi.fn().mockResolvedValue(leave),
        updateMany: vi.fn(),
      },
      attendance: {
        findFirst: vi.fn().mockResolvedValue({ id: 'checked-in' }),
      },
    };
    const api = new LeaveController({
      $transaction: (fn: (value: typeof tx) => Promise<unknown>) => fn(tx),
    } as never);
    await expect(
      api.review('leave-1', supervisor, { status: 'APPROVED' }),
    ).rejects.toThrow(ConflictException);
    expect(tx.leaveRequest.updateMany).not.toHaveBeenCalled();
  });
});

describe('attendance contract', () => {
  it('validates calendar dates and range lengths', () => {
    expect(() => workRange('2026-02-30', '2026-03-01')).toThrow();
    expect(() => workRange('2026-03-02', '2026-03-01')).toThrow();
    expect(workRange('2026-10-20', '2026-10-22').days).toBe(3);
    expect(() => workRange('2026-01-01', '2026-02-02')).toThrow();
  });
  it('counts late arrivals in the business time zone and exposes authenticated photo URLs, not storage keys', () => {
    expect(isLate(new Date('2026-10-20T01:00:00.000Z'), '08:00')).toBe(false);
    expect(isLate(new Date('2026-10-20T01:01:00.000Z'), '08:00')).toBe(true);
    const value = publicAttendance({
      id: 'attendance-1',
      checkInPhotoKey: 'secret.jpg',
      checkOutPhotoKey: null,
    });
    expect(value.checkInPhotoUrl).toBe(
      '/api/v1/attendance/attendance-1/photo/check-in',
    );
    expect(value).not.toHaveProperty('checkInPhotoKey');
  });
});
