import type { AreaUnit, CallHistoryEntry, LandType, UserRole } from './types';

export function formatPrice(value: number) {
  if (value >= 1_00_00_000) return `₹${trimZeros(value / 1_00_00_000)} Cr`;
  if (value >= 1_00_000) return `₹${trimZeros(value / 1_00_000)} L`;
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

function trimZeros(value: number) {
  return value.toFixed(2).replace(/\.?0+$/, '');
}

const areaUnitLabels: Record<AreaUnit, { one: string; many: string }> = {
  sqft: { one: 'sq ft', many: 'sq ft' },
  sqm: { one: 'sq m', many: 'sq m' },
  acre: { one: 'acre', many: 'acres' },
  cent: { one: 'cent', many: 'cents' },
  guntha: { one: 'guntha', many: 'guntha' },
  hectare: { one: 'hectare', many: 'hectares' },
};

export function formatArea(area: number | null, unit: AreaUnit) {
  if (!area) return null;
  const amount = Number(area);
  const label = amount === 1 ? areaUnitLabels[unit].one : areaUnitLabels[unit].many;
  return `${amount.toLocaleString('en-IN')} ${label}`;
}

export const landTypeLabels: Record<LandType, string> = {
  residential: 'Residential',
  agricultural: 'Agricultural',
  commercial: 'Commercial',
  industrial: 'Industrial',
};

export const roleLabels: Record<UserRole, string> = {
  buyer: 'Buyer',
  seller: 'Seller',
  broker: 'Broker',
};

export function formatChatTime(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function formatCallTime(iso: string) {
  const date = new Date(iso);
  const day = formatChatTime(iso);
  const sameDay = date.toDateString() === new Date().toDateString();
  return sameDay ? day : `${day}, ${formatClock(iso)}`;
}

export function formatClock(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

export function formatDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

export function describeCall(entry: CallHistoryEntry) {
  if (entry.status === 'ended' && entry.answered_at && entry.ended_at) {
    const seconds = (new Date(entry.ended_at).getTime() - new Date(entry.answered_at).getTime()) / 1000;
    return formatDuration(seconds);
  }
  if (entry.status === 'missed') return entry.outgoing ? 'No answer' : 'Missed';
  if (entry.status === 'rejected') return entry.outgoing ? 'Declined' : 'You declined';
  if (entry.status === 'cancelled') return 'Cancelled';
  if (entry.status === 'accepted') return 'In progress';
  return 'Ringing';
}

export function initials(name: string | null | undefined) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}
