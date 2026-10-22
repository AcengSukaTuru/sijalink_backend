export function publicAttendance<
  T extends {
    id: string;
    checkInPhotoKey: string | null;
    checkOutPhotoKey: string | null;
  },
>(attendance: T) {
  const { checkInPhotoKey, checkOutPhotoKey, ...fields } = attendance;
  return {
    ...fields,
    checkInPhotoUrl: checkInPhotoKey
      ? `/api/v1/attendance/${attendance.id}/photo/check-in`
      : null,
    checkOutPhotoUrl: checkOutPhotoKey
      ? `/api/v1/attendance/${attendance.id}/photo/check-out`
      : null,
  };
}
