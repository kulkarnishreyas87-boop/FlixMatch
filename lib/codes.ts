import { customAlphabet } from "nanoid";

// Unambiguous uppercase alphabet (no 0/O/1/I) for a code partners can read
// aloud or type in as a link fallback.
const nanoid = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

export function generateSessionCode(): string {
  return nanoid();
}
