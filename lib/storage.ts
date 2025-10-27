import AsyncStorage from '@react-native-async-storage/async-storage';
import { Paths } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';

const STORAGE_KEY = '@imageloader:saved_items';
const LEGACY_FILE = `${Paths.cache}saved_items.json`;

export type SavedItem = {
  id: string;
  name: string;
  type: 'zip' | 'folder';
  files: string[]; // array of file URIs (prefer file:// cache URIs)
  savedAt: number;
};

async function migrateFromLegacy(): Promise<SavedItem[] | null> {
  try {
    const info = await FileSystem.getInfoAsync(LEGACY_FILE);
    if (!info.exists) return null;
    const content = await FileSystem.readAsStringAsync(LEGACY_FILE).catch(() => '');
    if (!content) return null;
    const parsed = JSON.parse(content) as SavedItem[];
    // write into AsyncStorage
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    // remove legacy file
    await FileSystem.deleteAsync(LEGACY_FILE).catch(() => {});
    return parsed;
  } catch (e) {
    console.warn('migration failed', e);
    return null;
  }
}

export async function getSavedItems(): Promise<SavedItem[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as SavedItem[];
    // attempt migration from legacy file if present
    const migrated = await migrateFromLegacy();
    if (migrated) return migrated;
    return [];
  } catch (e) {
    console.warn('getSavedItems error', e);
    return [];
  }
}

export async function saveItem(item: Omit<SavedItem, 'savedAt' | 'id'> & { id?: string }) {
  try {
    const list = await getSavedItems();
    const id = item.id ?? `${Date.now()}`;
    const saved: SavedItem = {
      id,
      name: item.name,
      type: item.type,
      files: item.files,
      savedAt: Date.now(),
    };
    // Deduplicate: if an existing saved item has the same files (same length and same entries in order),
    // treat it as the same selection — update its savedAt and move it to the front instead of adding a new one.
    const isSameFiles = (a: string[], b: string[]) => {
      if (!Array.isArray(a) || !Array.isArray(b)) return false;
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
      return true;
    };

    const existing = list.find(i => (i.type === saved.type && (i.name === saved.name || isSameFiles(i.files, saved.files))));
    if (existing) {
      // Update timestamp and move to front
      const updated: SavedItem = { ...existing, savedAt: Date.now(), files: existing.files.length ? existing.files : saved.files };
      const next = [updated, ...list.filter(i => i.id !== existing.id)];
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return updated;
    }

    const next = [saved, ...list];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return saved;
  } catch (e) {
    console.warn('saveItem error', e);
    throw e;
  }
}

export async function removeItem(id: string) {
  try {
    const list = await getSavedItems();
    const next = list.filter(i => i.id !== id);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (e) {
    console.warn('removeItem error', e);
    throw e;
  }
}

export async function updateItemName(id: string, newName: string) {
  try {
    const list = await getSavedItems();
    const next = list.map(i => i.id === id ? { ...i, name: newName } : i);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next.find(i => i.id === id) ?? null;
  } catch (e) {
    console.warn('updateItemName error', e);
    throw e;
  }
}
