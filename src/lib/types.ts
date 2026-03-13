export type EntryMode = 'direct' | 'difference';

export type EntryUnit = 'g' | 'pcs';

export type ExportFormat = 'simple' | 'raw';

export interface FoodProfile {
  id: string;
  name: string;
  normalizedName: string;
  usageCount: number;
  lastUsedAt: string;
  createdAt: string;
  isFavorite: boolean;
  lastUnit: EntryUnit;
}

export interface SessionEntry {
  id: string;
  foodId: string;
  foodName: string;
  mode: EntryMode;
  amount: number;
  unit: EntryUnit;
  beforeWeight?: number;
  afterWeight?: number;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface EntryPayload {
  foodName: string;
  mode: EntryMode;
  amount: number;
  unit: EntryUnit;
  beforeWeight?: number;
  afterWeight?: number;
  note: string;
}

export interface PersistedAppState {
  version: 1;
  foods: FoodProfile[];
  currentSession: SessionEntry[];
  exportFormat: ExportFormat;
}

