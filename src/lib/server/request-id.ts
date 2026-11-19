import { randomUUID } from 'node:crypto';

// Bound and validate caller-provided IDs before echoing or logging them.
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function requestIdFor(value: string | null | undefined): string {
  return value && UUID_V4.test(value) ? value.toLowerCase() : randomUUID();
}
