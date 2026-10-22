import { BadRequestException } from '@nestjs/common';

export function workDay(date: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw new BadRequestException('Tanggal harus YYYY-MM-DD.');
  const value = new Date(`${date}T00:00:00.000Z`);
  if (
    Number.isNaN(value.getTime()) ||
    value.toISOString().slice(0, 10) !== date
  )
    throw new BadRequestException('Tanggal tidak valid.');
  return value;
}

export function workRange(startDate: string, endDate: string) {
  const start = workDay(startDate);
  const end = workDay(endDate);
  const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  if (days < 1 || days > 31)
    throw new BadRequestException('Rentang izin harus 1–31 hari.');
  return { start, end, days };
}

export function businessDay(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: process.env.BUSINESS_TIMEZONE ?? 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((value) => value.type === type)!.value;
  return workDay(`${part('year')}-${part('month')}-${part('day')}`);
}

export function isLate(
  instant: Date,
  clock = process.env.WORK_START_TIME ?? '08:00',
): boolean {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(clock))
    throw new Error('WORK_START_TIME harus HH:mm.');
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: process.env.BUSINESS_TIMEZONE ?? 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(instant);
  return time > clock;
}
