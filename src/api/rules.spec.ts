import { ConflictException, BadRequestException } from '@nestjs/common';
import {
  assertCheckInAllowed,
  assertCheckOutAllowed,
  assertStatusTransition,
  assertStatusFilter,
  ownedNotificationFilter,
  pagination,
  validateCoordinates,
} from './rules.js';

describe('API business rules', () => {
  it('rejects reopening a completed ticket', () => {
    expect(() => assertStatusTransition('DONE', 'IN_PROGRESS')).toThrow(
      ConflictException,
    );
    expect(() => assertStatusTransition('NEW', 'IN_PROGRESS')).not.toThrow();
  });

  it('bounds pagination and defaults to a safe page size', () => {
    expect(pagination('0', '500')).toEqual({ skip: 0, take: 100 });
    expect(pagination(undefined, undefined)).toEqual({ skip: 0, take: 20 });
  });

  it('rejects unsupported status filters before querying persistence', () => {
    expect(() => assertStatusFilter('IN_PROGRESS', ['NEW', 'DONE'])).toThrow(
      BadRequestException,
    );
    expect(() => assertStatusFilter('NEW', ['NEW', 'DONE'])).not.toThrow();
  });

  it('requires valid coordinate pairs when location is provided', () => {
    expect(() => validateCoordinates(91, 0)).toThrow(BadRequestException);
    expect(() => validateCoordinates(-6, undefined)).toThrow(
      BadRequestException,
    );
    expect(() => validateCoordinates(-6, 106)).not.toThrow();
  });

  it('rejects duplicate and out-of-order attendance actions', () => {
    expect(() => assertCheckInAllowed(true)).toThrow(ConflictException);
    expect(() => assertCheckOutAllowed(false, false)).toThrow(
      ConflictException,
    );
    expect(() => assertCheckOutAllowed(true, true)).toThrow(ConflictException);
    expect(() => assertCheckOutAllowed(true, false)).not.toThrow();
  });

  it('scopes notification reads and deletes to their recipient', () => {
    expect(ownedNotificationFilter('recipient-1', 'notification-1')).toEqual({
      userId: 'recipient-1',
      id: 'notification-1',
    });
  });
});
