import { buildSeedRows, SHEET_HEADERS } from '../data/sampleSeedData';
import type { SiteConfig, SiteDataset } from '../types/cms';

const STATIC_DB_KEY = 'qoshkopir_static_db_v1';
const STATIC_CONFIG_KEY = 'qoshkopir_static_config_v1';

export function parseAllowedEmails(raw: string | undefined | null): string[] {
  if (!raw) return ['burgutsony@gmail.com'];
  const parsed = raw
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  return parsed.length > 0 ? Array.from(new Set(parsed)) : ['burgutsony@gmail.com'];
}

function mapSeedRowsToObjects<T>(headers: string[], rows: string[][]): T[] {
  return rows.map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = row[i] ?? '';
    });
    return obj as T;
  });
}

function createSeedDataset(): SiteDataset {
  const seed = buildSeedRows({});
  const settingsRows = mapSeedRowsToObjects<{
    key: string;
    value: string;
    label: string;
    section: string;
  }>(SHEET_HEADERS.Sozlamalar, seed.Sozlamalar);

  const settings: Record<string, string> = {};
  for (const row of settingsRows) {
    if (row.key) settings[row.key] = row.value || '';
  }

  return {
    news: mapSeedRowsToObjects(SHEET_HEADERS.Yangiliklar, seed.Yangiliklar),
    leadership: mapSeedRowsToObjects(SHEET_HEADERS.Rahbariyat, seed.Rahbariyat),
    programs: mapSeedRowsToObjects(SHEET_HEADERS.Yonalishlar, seed.Yonalishlar),
    documents: mapSeedRowsToObjects(SHEET_HEADERS.Hujjatlar, seed.Hujjatlar),
    media: mapSeedRowsToObjects(SHEET_HEADERS.Media, seed.Media),
    settingsRows,
    settings,
    appeals: mapSeedRowsToObjects(SHEET_HEADERS.Murojaatlar, seed.Murojaatlar),
  };
}

export function getStaticConfig(): SiteConfig | null {
  try {
    const raw = localStorage.getItem(STATIC_CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SiteConfig;
    return parsed?.spreadsheetId ? parsed : null;
  } catch {
    return null;
  }
}

export function saveStaticConfig(config: SiteConfig | null): void {
  try {
    if (!config) {
      localStorage.removeItem(STATIC_CONFIG_KEY);
    } else {
      localStorage.setItem(STATIC_CONFIG_KEY, JSON.stringify(config));
    }
  } catch {
    // ignore
  }
}

export function getStaticDataset(): SiteDataset {
  try {
    const raw = localStorage.getItem(STATIC_DB_KEY);
    if (raw) {
      return JSON.parse(raw) as SiteDataset;
    }
  } catch {
    // ignore
  }
  const seeded = createSeedDataset();
  saveStaticDataset(seeded);
  return seeded;
}

export function saveStaticDataset(data: SiteDataset): void {
  try {
    localStorage.setItem(STATIC_DB_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export function stripSensitiveRows<T extends { key?: string }>(rows: T[]): T[] {
  return rows.filter(
    (r) =>
      r.key !== 'admin_login' &&
      r.key !== 'admin_password' &&
      r.key !== 'admin_allowed_emails'
  );
}

export async function fetchApiOrFallback<T>(
  url: string,
  options?: RequestInit
): Promise<{ isBackendAvailable: boolean; response?: Response; data?: T }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(url, {
      ...options,
      signal: options?.signal ?? controller.signal,
    });
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = (await res.json()) as T;
      return { isBackendAvailable: true, response: res, data };
    }
    return { isBackendAvailable: false };
  } catch {
    return { isBackendAvailable: false };
  } finally {
    clearTimeout(timeoutId);
  }
}

function getCollectionKey(
  tab: string
): keyof Pick<
  SiteDataset,
  'news' | 'leadership' | 'programs' | 'documents' | 'media' | 'settingsRows' | 'appeals'
> | null {
  switch (tab) {
    case 'Yangiliklar':
      return 'news';
    case 'Rahbariyat':
      return 'leadership';
    case 'Yonalishlar':
      return 'programs';
    case 'Hujjatlar':
      return 'documents';
    case 'Media':
      return 'media';
    case 'Sozlamalar':
      return 'settingsRows';
    case 'Murojaatlar':
      return 'appeals';
    default:
      return null;
  }
}

export function upsertStaticRow(
  tab: string,
  item: Record<string, string>
): void {
  const key = getCollectionKey(tab);
  if (!key) return;
  const db = getStaticDataset();
  const idField = tab === 'Sozlamalar' ? 'key' : 'id';
  const list = db[key] as unknown as Array<Record<string, string>>;
  const idx = list.findIndex((r) => r[idField] === item[idField]);
  if (idx === -1) {
    list.unshift(item);
  } else {
    list[idx] = item;
  }
  saveStaticDataset(db);
}

export function deleteStaticRow(tab: string, id: string): void {
  const key = getCollectionKey(tab);
  if (!key) return;
  const db = getStaticDataset();
  const idField = tab === 'Sozlamalar' ? 'key' : 'id';
  const list = db[key] as unknown as Array<Record<string, string>>;
  (db[key] as unknown as Array<Record<string, string>>) = list.filter(
    (r) => r[idField] !== id
  );
  saveStaticDataset(db);
}

export function saveStaticSettingsRows(
  rows: Array<{ key: string; value: string; label: string; section: string }>
): void {
  const db = getStaticDataset();
  const preserved = db.settingsRows.filter(
    (r) =>
      r.key === 'admin_login' ||
      r.key === 'admin_password' ||
      r.key === 'admin_allowed_emails'
  );
  db.settingsRows = [...stripSensitiveRows(rows), ...preserved];
  const map: Record<string, string> = {};
  for (const r of stripSensitiveRows(db.settingsRows)) {
    if (r.key) map[r.key] = r.value || '';
  }
  db.settings = map;
  saveStaticDataset(db);
}

export function upsertStaticSecuritySetting(
  key: string,
  value: string,
  label: string
): void {
  upsertStaticRow('Sozlamalar', {
    key,
    value,
    label,
    section: 'Xavfsizlik',
  });
}
