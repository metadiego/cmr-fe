// The appointments screen used to be two tabbed calendars (Medical / Services) owned by this layout.
// Both routes now render the one booking screen (components/appointments-booking/booking-screen.tsx),
// so the layout only passes its page through. The route group stays so /scheduling/appointments/services
// keeps working for inbound links.
export default function AppointmentsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
