"use client";

import * as React from "react";

import type { BookingResult } from "@/lib/agenda/booking/booking-result";
import { BookingResultDialog } from "./booking-result-dialog";

// The app-wide booking success dialog (spec §1): mounted once in the shell, so it outlives the form
// that booked (CitaModal and the service form unmount on save) and no screen wires it by hand.

type BookingResultValue = { show: (result: BookingResult) => void };

const BookingResultContext = React.createContext<BookingResultValue | null>(null);

export function BookingResultProvider({ children }: { children: React.ReactNode }) {
  const [result, setResult] = React.useState<BookingResult | null>(null);
  const value = React.useMemo<BookingResultValue>(() => ({ show: setResult }), []);
  return (
    <BookingResultContext.Provider value={value}>
      {children}
      {result && <BookingResultDialog result={result} onClose={() => setResult(null)} />}
    </BookingResultContext.Provider>
  );
}

export function useBookingResult(): BookingResultValue {
  const value = React.useContext(BookingResultContext);
  if (!value) throw new Error("useBookingResult needs a BookingResultProvider (components/app-shell.tsx)");
  return value;
}
