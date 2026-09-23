"use client";

const DEVICE_ID_KEY = "match-night:device-id";

// Persistent anonymous per-browser identity. No accounts: a "couple" is just
// the same two device-ids reconnecting across sessions.
export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}
