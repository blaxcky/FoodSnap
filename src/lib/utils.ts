import type { EntryUnit, SessionEntry } from './types';

export function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function formatNumber(value: number) {
  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(1).replace(/\.0$/, '');
}

export function formatAmount(value: number, unit: EntryUnit) {
  return unit === 'g' ? `${formatNumber(value)}g` : formatNumber(value);
}

export function formatEntryMeta(entry: SessionEntry) {
  if (entry.needsAfterWeight && entry.afterWeight == null) {
    const before = entry.beforeWeight ?? entry.amount;
    return `Before ${formatNumber(before)}g • after pending`;
  }

  if (entry.mode === 'difference') {
    return `${formatNumber(entry.beforeWeight ?? 0)}g -> ${formatNumber(entry.afterWeight ?? 0)}g`;
  }

  return entry.unit === 'g' ? 'Direct grams' : 'Direct pieces';
}

export function isAfterWeightPending(entry: SessionEntry) {
  return Boolean(entry.needsAfterWeight && entry.afterWeight == null);
}

export function isValidPositiveNumber(value: string) {
  if (value.trim() === '') {
    return false;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
}
