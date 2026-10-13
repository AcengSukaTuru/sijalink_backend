import { BadRequestException, ConflictException } from '@nestjs/common';
import type { TicketStatus } from '@prisma/client';

export function assertStatusTransition(
  current: TicketStatus,
  next: TicketStatus,
): void {
  if (
    current === 'CANCELLED' ||
    (current === 'DONE' && next === 'IN_PROGRESS')
  ) {
    throw new ConflictException('Transisi status tidak valid.');
  }
}

export function validateCoordinates(
  latitude?: number,
  longitude?: number,
): void {
  if (latitude !== undefined && (latitude < -90 || latitude > 90)) {
    throw new BadRequestException('latitude di luar rentang.');
  }
  if (longitude !== undefined && (longitude < -180 || longitude > 180)) {
    throw new BadRequestException('longitude di luar rentang.');
  }
  if ((latitude === undefined) !== (longitude === undefined)) {
    throw new BadRequestException(
      'Latitude dan longitude harus dikirim bersama.',
    );
  }
}

export function pagination(page?: string, limit?: string) {
  const requestedPage = Number(page);
  const requestedLimit = Number(limit);
  const pageNumber =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;
  const pageSize =
    Number.isSafeInteger(requestedLimit) && requestedLimit > 0
      ? Math.min(100, requestedLimit)
      : 20;
  return { skip: (pageNumber - 1) * pageSize, take: pageSize };
}

export function assertStatusFilter(
  status: string | undefined,
  allowed: readonly string[],
): void {
  if (status && !allowed.includes(status)) {
    throw new BadRequestException('Filter status tidak valid.');
  }
}

export function ownedNotificationFilter(userId: string, id?: string) {
  return { userId, ...(id ? { id } : {}) };
}

export function assertCheckInAllowed(alreadyCheckedIn: boolean): void {
  if (alreadyCheckedIn) {
    throw new ConflictException('Check-in hari ini sudah tercatat.');
  }
}

export function assertCheckOutAllowed(
  checkedIn: boolean,
  alreadyCheckedOut: boolean,
): void {
  if (!checkedIn) throw new ConflictException('Check-in belum dilakukan.');
  if (alreadyCheckedOut) {
    throw new ConflictException('Check-out hari ini sudah tercatat.');
  }
}
