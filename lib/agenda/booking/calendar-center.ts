// Which center the booking calendar reads availability from. A move never changes an appointment's
// center (the reschedule omits `centerId`), so while one is moving the calendar shows the appointment's
// OWN center, whatever the screen's picker or the top bar says; otherwise the screen's center.
export function calendarCenter(
  screenCenter: string | undefined,
  moving: { centerId?: string | null } | undefined,
): string | undefined {
  return moving?.centerId ?? screenCenter;
}
