import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '../config/event';

/** Uppercase, strip anything that is not allowed, and cap the length. */
export function normaliseRoomCode(raw: string): string {
  return raw
    .toUpperCase()
    .split('')
    .filter((ch) => ROOM_CODE_ALPHABET.includes(ch))
    .join('')
    .slice(0, ROOM_CODE_LENGTH);
}

export function isValidRoomCode(code: string): boolean {
  return (
    code.length === ROOM_CODE_LENGTH &&
    code.split('').every((ch) => ROOM_CODE_ALPHABET.includes(ch))
  );
}
