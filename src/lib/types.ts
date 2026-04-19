export type EntryMode = 'direct' | 'difference';

export type EntryUnit = 'g' | 'pcs';

export type PhotoStatus = 'pending' | 'archived';

export type NutritionScope = 'per100g' | 'total';

export interface NutritionFields {
  calories?: number;
  carbs?: number;
  fat?: number;
  protein?: number;
  nutritionScope?: NutritionScope;
}

export interface FoodProfile extends NutritionFields {
  id: string;
  name: string;
  normalizedName: string;
  usageCount: number;
  lastUsedAt: string;
  createdAt: string;
  isFavorite: boolean;
  lastUnit: EntryUnit;
}

export interface SessionEntry extends NutritionFields {
  id: string;
  foodId: string;
  foodName: string;
  sourcePhotoId?: string;
  mode: EntryMode;
  amount: number;
  unit: EntryUnit;
  beforeWeight?: number;
  afterWeight?: number;
  needsAfterWeight?: boolean;
  note: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  undoExpiresAt?: string;
}

export interface EntryPayload extends NutritionFields {
  foodName: string;
  mode: EntryMode;
  amount: number;
  unit: EntryUnit;
  beforeWeight?: number;
  afterWeight?: number;
  needsAfterWeight?: boolean;
  note: string;
}

export interface PhotoItem {
  id: string;
  status: PhotoStatus;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  foodName?: string;
  weightGrams?: number;
  linkedEntryId?: string;
}

export interface PersistedAppState {
  version: 3;
  foods: FoodProfile[];
  currentSession: SessionEntry[];
  photoItems: PhotoItem[];
  exportLeadIn: string;
}
