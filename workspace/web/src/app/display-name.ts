import { MAX_NAME_LENGTH } from "@shared/protocol";

export const NAME_STORAGE_KEY = "3dreviewer:name";

export function loadStoredName(): string {
  try {
    return localStorage.getItem(NAME_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveName(name: string): void {
  const trimmed = name.trim();
  if (!trimmed) {
    return;
  }
  try {
    localStorage.setItem(NAME_STORAGE_KEY, trimmed);
  } catch {
    // localStorage may be unavailable in private browsing or restricted contexts.
  }
}

export function guestName(digits: () => string = randomDigits): string {
  return `Guest-${digits()}`;
}

export function resolveDisplayName(input: string, digits?: () => string): string {
  const trimmed = input.trim().slice(0, MAX_NAME_LENGTH);
  return trimmed || guestName(digits);
}

function randomDigits(): string {
  return Math.floor(Math.random() * 10000).toString().padStart(4, "0");
}
