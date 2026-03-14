import type { ExportFormat, FoodProfile } from './types';

interface BackupSettings {
  exportFormat: ExportFormat;
  exportLeadIn: string;
}

interface FoodMemoryBackup {
  app: 'FoodSnap';
  version: 2;
  exportedAt: string;
  foods: FoodProfile[];
  settings: BackupSettings;
}

export function downloadFoodMemoryBackup(foods: FoodProfile[], settings: BackupSettings) {
  const payload: FoodMemoryBackup = {
    app: 'FoodSnap',
    version: 2,
    exportedAt: new Date().toISOString(),
    foods,
    settings
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json'
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const dateStamp = payload.exportedAt.slice(0, 10);

  anchor.href = url;
  anchor.download = `foodsnap-food-memory-${dateStamp}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
