import { createHash } from 'node:crypto';
import type { ClubInvite } from './erp-workspace';
export function inviteHash(token: string) {
  return /^[a-f0-9]{64}$/.test(token) ? createHash('sha256').update(token).digest('hex') : null;
}
export function findValidInvite(invites: ClubInvite[], token: string, now = new Date()) {
  const hash = inviteHash(token);
  return hash ? invites.find(i => i.hash === hash && !i.usedAt && new Date(i.expiresAt) > now) : undefined;
}
