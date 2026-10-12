// Central place for event details. Nothing here is invented:
// anything you have not provided stays null and the UI shows "To be announced".
// Fill these in through the .env file (see .env.example), not by editing code.

function clean(value: string | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
}

export const eventConfig = {
  festName: 'FEST INFINITO',
  title: 'THE ULTIMATE BID',
  organiserName: clean(import.meta.env.VITE_ORGANISER_NAME),
  date: clean(import.meta.env.VITE_EVENT_DATE),
  venue: clean(import.meta.env.VITE_EVENT_VENUE),
  contact: clean(import.meta.env.VITE_EVENT_CONTACT),
} as const;

export const TO_BE_ANNOUNCED = 'To be announced';

// Room codes: 6 characters, letters and digits that are hard to confuse.
// (No 0/O, 1/I/L.) The same alphabet is used by the database function in Stage 3.
export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
