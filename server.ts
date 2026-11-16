import express from 'express';
import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { buildSeedRows, SHEET_HEADERS } from './src/data/sampleSeedData.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const CONFIG_PATH = path.join(DATA_DIR, 'site-config.json');
const DB_PATH = path.join(DATA_DIR, 'school-db.json');
const APPEALS_QUEUE_PATH = path.join(DATA_DIR, 'pending-appeals.json');

interface SiteConfigRecord {
  spreadsheetId: string;
  rootFolderId: string;
  mediaFolderId: string;
  docsFolderId: string;
  schoolTitle: string;
  configuredAt: string;
  configuredByEmail?: string;
}

interface QueuedAppeal {
  id: string;
  fullName: string;
  phone: string;
  topic: string;
  message: string;
  date: string;
  status: string;
}

interface SchoolDbData {
  news: Array<Record<string, string>>;
  leadership: Array<Record<string, string>>;
  programs: Array<Record<string, string>>;
  documents: Array<Record<string, string>>;
  media: Array<Record<string, string>>;
  settingsRows: Array<Record<string, string>>;
  appeals: Array<Record<string, string>>;
}

function ensureDataDirs(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

function mapSeedRowsToObjects(
  headers: string[],
  rows: string[][]
): Array<Record<string, string>> {
  return rows.map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = row[i] ?? '';
    });
    return obj;
  });
}

function createInitialDb(): SchoolDbData {
  const seed = buildSeedRows({});
  return {
    news: mapSeedRowsToObjects(SHEET_HEADERS.Yangiliklar, seed.Yangiliklar),
    leadership: mapSeedRowsToObjects(SHEET_HEADERS.Rahbariyat, seed.Rahbariyat),
    programs: mapSeedRowsToObjects(SHEET_HEADERS.Yonalishlar, seed.Yonalishlar),
    documents: mapSeedRowsToObjects(SHEET_HEADERS.Hujjatlar, seed.Hujjatlar),
    media: mapSeedRowsToObjects(SHEET_HEADERS.Media, seed.Media),
    settingsRows: mapSeedRowsToObjects(SHEET_HEADERS.Sozlamalar, seed.Sozlamalar),
    appeals: mapSeedRowsToObjects(SHEET_HEADERS.Murojaatlar, seed.Murojaatlar),
  };
}

function ensureAdminCredsInDb(db: SchoolDbData): boolean {
  let changed = false;
  if (!db.settingsRows.some((r) => r.key === 'admin_login')) {
    db.settingsRows.push({
      key: 'admin_login',
      value: 'ibragim',
      label: 'Admin login',
      section: 'Xavfsizlik',
    });
    changed = true;
  }
  if (!db.settingsRows.some((r) => r.key === 'admin_password')) {
    db.settingsRows.push({
      key: 'admin_password',
      value: '!ibragim@',
      label: 'Admin parol',
      section: 'Xavfsizlik',
    });
    changed = true;
  }
  if (!db.settingsRows.some((r) => r.key === 'admin_allowed_emails')) {
    db.settingsRows.push({
      key: 'admin_allowed_emails',
      value: 'burgutsony@gmail.com',
      label: 'Ruxsat etilgan Gmail manzillar',
      section: 'Xavfsizlik',
    });
    changed = true;
  }
  return changed;
}

function parseAllowedEmails(raw: string | undefined | null): string[] {
  if (!raw) return ['burgutsony@gmail.com'];
  const parsed = raw
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  return parsed.length > 0 ? Array.from(new Set(parsed)) : ['burgutsony@gmail.com'];
}

function readFirebaseApiKey(): string {
  try {
    const cfgPath = path.resolve(__dirname, 'firebase-applet-config.json');
    if (fs.existsSync(cfgPath)) {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8')) as {
        apiKey?: string;
      };
      return cfg.apiKey || '';
    }
  } catch {
    // ignore
  }
  return '';
}

function readSchoolDb(): SchoolDbData {
  ensureDataDirs();
  if (!fs.existsSync(DB_PATH)) {
    const initial = createInitialDb();
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as SchoolDbData;
    let changed = false;
    if (
      Array.isArray(parsed.news) &&
      parsed.news.length === 4 &&
      parsed.news[3]?.id === 'YNG-004'
    ) {
      const fresh = createInitialDb();
      parsed.news = fresh.news;
      changed = true;
    }
    if (ensureAdminCredsInDb(parsed)) {
      changed = true;
    }
    if (changed) {
      fs.writeFileSync(DB_PATH, JSON.stringify(parsed, null, 2), 'utf-8');
    }
    return parsed;
  } catch {
    const initial = createInitialDb();
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
}

function stripSensitiveSettingsRows(
  rows: Array<Record<string, string>>
): Array<Record<string, string>> {
  return rows.filter(
    (r) =>
      r.key !== 'admin_login' &&
      r.key !== 'admin_password' &&
      r.key !== 'admin_allowed_emails'
  );
}

function writeSchoolDb(db: SchoolDbData): void {
  ensureDataDirs();
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
}

function buildSettingsMap(
  settingsRows: Array<Record<string, string>>
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const row of settingsRows) {
    if (row.key) {
      map[row.key] = row.value || '';
    }
  }
  return map;
}

function readSiteConfig(): SiteConfigRecord | null {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return null;
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as SiteConfigRecord;
    if (!parsed.spreadsheetId) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSiteConfig(config: SiteConfigRecord): void {
  ensureDataDirs();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

function readPendingAppeals(): QueuedAppeal[] {
  try {
    if (!fs.existsSync(APPEALS_QUEUE_PATH)) return [];
    const raw = fs.readFileSync(APPEALS_QUEUE_PATH, 'utf-8');
    return JSON.parse(raw) as QueuedAppeal[];
  } catch {
    return [];
  }
}

function writePendingAppeals(items: QueuedAppeal[]): void {
  ensureDataDirs();
  fs.writeFileSync(APPEALS_QUEUE_PATH, JSON.stringify(items, null, 2), 'utf-8');
}

function parseGvizResponse(text: string): Array<Record<string, string>> {
  const startIdx = text.indexOf('setResponse(');
  if (startIdx === -1) return [];
  const jsonStart = startIdx + 'setResponse('.length;
  const jsonEnd = text.lastIndexOf(');');
  if (jsonEnd <= jsonStart) return [];

  const payload = JSON.parse(text.slice(jsonStart, jsonEnd)) as {
    status?: string;
    table?: {
      cols?: Array<{ id?: string; label?: string }>;
      rows?: Array<{ c?: Array<{ v?: unknown; f?: string } | null> }>;
    };
  };

  if (!payload.table || !payload.table.cols || !payload.table.rows) {
    return [];
  }

  const headers = payload.table.cols.map(
    (col, idx) => (col.label && col.label.trim()) || col.id || `col_${idx}`
  );

  const records: Array<Record<string, string>> = [];
  for (const row of payload.table.rows) {
    const cells = row.c || [];
    const obj: Record<string, string> = {};
    let hasValue = false;
    headers.forEach((header, idx) => {
      const cell = cells[idx];
      let val = '';
      if (cell && cell.f !== undefined && cell.f !== null) {
        val = String(cell.f);
      } else if (cell && cell.v !== undefined && cell.v !== null) {
        val = String(cell.v);
      }
      if (val.trim() !== '') hasValue = true;
      obj[header] = val;
    });
    if (hasValue) {
      records.push(obj);
    }
  }
  return records;
}

async function fetchPublicSheetTab(
  spreadsheetId: string,
  tabName: string
): Promise<Array<Record<string, string>>> {
  const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(
    spreadsheetId
  )}/gviz/tq?tqx=out:json&headers=1&sheet=${encodeURIComponent(tabName)}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'QoshkopirSchoolPortal/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Sheet tab "${tabName}" fetch failed: ${response.status}`);
  }

  const text = await response.text();
  return parseGvizResponse(text);
}

function getDbCollectionKey(tab: string): keyof SchoolDbData | null {
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

async function createApp() {
  ensureDataDirs();
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  // Serve local uploads if any
  app.use('/api/uploads', express.static(UPLOADS_DIR));

  // Google Workspace Config Endpoints
  app.get('/api/config', (_req: Request, res: Response) => {
    const config = readSiteConfig();
    res.json({ configured: Boolean(config?.spreadsheetId), config });
  });

  app.post('/api/config', (req: Request, res: Response) => {
    const body = req.body as Partial<SiteConfigRecord>;
    if (!body.spreadsheetId) {
      res.status(400).json({ error: 'spreadsheetId is required' });
      return;
    }
    const record: SiteConfigRecord = {
      spreadsheetId: body.spreadsheetId.trim(),
      rootFolderId: (body.rootFolderId || '').trim(),
      mediaFolderId: (body.mediaFolderId || '').trim(),
      docsFolderId: (body.docsFolderId || '').trim(),
      schoolTitle: (
        body.schoolTitle || "Qo'shko'pir tuman ixtisoslashtirilgan maktab"
      ).trim(),
      configuredAt: body.configuredAt || new Date().toISOString(),
      configuredByEmail: body.configuredByEmail || '',
    };
    writeSiteConfig(record);
    res.json({ ok: true, config: record });
  });

  app.delete('/api/config', (_req: Request, res: Response) => {
    if (fs.existsSync(CONFIG_PATH)) {
      fs.unlinkSync(CONFIG_PATH);
    }
    res.json({ ok: true });
  });

  // Public Site Data (Live from Google Sheets when configured, backed by school-db.json)
  app.get('/api/public/site-data', async (req: Request, res: Response) => {
    const querySheetId =
      typeof req.query.spreadsheetId === 'string'
        ? req.query.spreadsheetId.trim()
        : '';
    const config = readSiteConfig();
    const spreadsheetId = querySheetId || config?.spreadsheetId || '';

    if (spreadsheetId) {
      try {
        const [news, leadership, programs, documents, media, settingsRows] =
          await Promise.all([
            fetchPublicSheetTab(spreadsheetId, 'Yangiliklar'),
            fetchPublicSheetTab(spreadsheetId, 'Rahbariyat'),
            fetchPublicSheetTab(spreadsheetId, 'Yonalishlar'),
            fetchPublicSheetTab(spreadsheetId, 'Hujjatlar'),
            fetchPublicSheetTab(spreadsheetId, 'Media'),
            fetchPublicSheetTab(spreadsheetId, 'Sozlamalar'),
          ]);

        if (news.length > 0 || programs.length > 0 || settingsRows.length > 0) {
          const currentDb = readSchoolDb();
          const syncedDb: SchoolDbData = {
            news,
            leadership,
            programs,
            documents,
            media,
            settingsRows,
            appeals: currentDb.appeals,
          };
          writeSchoolDb(syncedDb);

          const publicSettingsRows = stripSensitiveSettingsRows(settingsRows);
          res.json({
            configured: true,
            source: 'google-sheets',
            config,
            data: {
              ...syncedDb,
              settingsRows: publicSettingsRows,
              settings: buildSettingsMap(publicSettingsRows),
              appeals: [],
            },
            pendingAppealsCount: readPendingAppeals().length,
          });
          return;
        }
      } catch {
        // Fallback to cached server DB if public sheet gviz fails
      }
    }

    const db = readSchoolDb();
    const publicSettingsRows = stripSensitiveSettingsRows(db.settingsRows);
    res.json({
      configured: Boolean(spreadsheetId),
      source: 'local-db',
      config,
      data: {
        news: db.news,
        leadership: db.leadership,
        programs: db.programs,
        documents: db.documents,
        media: db.media,
        settings: buildSettingsMap(publicSettingsRows),
        settingsRows: publicSettingsRows,
        appeals: [],
      },
      pendingAppealsCount: readPendingAppeals().length,
    });
  });

  // Admin Login & Credentials Management (verified against Google Sheets Sozlamalar when linked, or local DB)
  app.post('/api/admin/login', async (req: Request, res: Response) => {
    const { login, password } = req.body as {
      login?: string;
      password?: string;
    };
    if (!login || !password) {
      res.status(400).json({ error: 'Login va parolni kiriting' });
      return;
    }

    const db = readSchoolDb();
    let expectedLogin =
      db.settingsRows.find((r) => r.key === 'admin_login')?.value || 'ibragim';
    let expectedPassword =
      db.settingsRows.find((r) => r.key === 'admin_password')?.value ||
      '!ibragim@';

    const config = readSiteConfig();
    if (config?.spreadsheetId) {
      try {
        const sheetSettings = await fetchPublicSheetTab(
          config.spreadsheetId,
          'Sozlamalar'
        );
        const sheetLogin = sheetSettings.find(
          (r) => r.key === 'admin_login'
        )?.value;
        const sheetPassword = sheetSettings.find(
          (r) => r.key === 'admin_password'
        )?.value;
        if (sheetLogin && sheetPassword) {
          expectedLogin = sheetLogin;
          expectedPassword = sheetPassword;
        }
      } catch {
        // fallback to local DB
      }
    }

    if (login.trim() === expectedLogin && password === expectedPassword) {
      res.json({
        ok: true,
        login: expectedLogin,
      });
      return;
    }

    res.status(401).json({ error: 'Login yoki parol noto‘g‘ri' });
  });

  app.post('/api/admin/credentials', (req: Request, res: Response) => {
    const { login, password } = req.body as {
      login?: string;
      password?: string;
    };
    if (!login || !login.trim() || !password || password.length < 4) {
      res.status(400).json({
        error: 'Login bo‘sh bo‘lmasligi va parol kamida 4 belgidan iborat bo‘lishi kerak',
      });
      return;
    }

    const db = readSchoolDb();
    const upsertSetting = (key: string, value: string, label: string) => {
      const idx = db.settingsRows.findIndex((r) => r.key === key);
      const row = { key, value, label, section: 'Xavfsizlik' };
      if (idx === -1) db.settingsRows.push(row);
      else db.settingsRows[idx] = row;
    };

    upsertSetting('admin_login', login.trim(), 'Admin login');
    upsertSetting('admin_password', password, 'Admin parol');
    writeSchoolDb(db);

    res.json({ ok: true, login: login.trim() });
  });

  app.post('/api/admin/gmail-login', async (req: Request, res: Response) => {
    const { idToken } = req.body as { idToken?: string };
    if (!idToken) {
      res.status(400).json({ error: 'Google tasdiqlash tokeni topilmadi' });
      return;
    }

    const apiKey = readFirebaseApiKey();
    if (!apiKey) {
      res.status(500).json({ error: 'Firebase API kaliti sozlanmagan' });
      return;
    }

    let verifiedEmail = '';
    try {
      const verifyRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(
          apiKey
        )}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        }
      );
      if (!verifyRes.ok) {
        res.status(401).json({ error: 'Google hisobni tasdiqlab bo‘lmadi' });
        return;
      }
      const verifyJson = (await verifyRes.json()) as {
        users?: Array<{ email?: string; emailVerified?: boolean }>;
      };
      const account = verifyJson.users?.[0];
      if (!account?.email) {
        res.status(401).json({ error: 'Google hisob email manzili topilmadi' });
        return;
      }
      verifiedEmail = account.email.trim().toLowerCase();
    } catch {
      res.status(500).json({ error: 'Google tasdiqlash serveriga ulanib bo‘lmadi' });
      return;
    }

    const db = readSchoolDb();
    let allowedRaw =
      db.settingsRows.find((r) => r.key === 'admin_allowed_emails')?.value ||
      'burgutsony@gmail.com';

    const config = readSiteConfig();
    if (config?.spreadsheetId) {
      try {
        const sheetSettings = await fetchPublicSheetTab(
          config.spreadsheetId,
          'Sozlamalar'
        );
        const sheetAllowed = sheetSettings.find(
          (r) => r.key === 'admin_allowed_emails'
        )?.value;
        if (sheetAllowed) {
          allowedRaw = sheetAllowed;
        }
      } catch {
        // fallback to local DB
      }
    }

    const allowedList = parseAllowedEmails(allowedRaw);
    if (!allowedList.includes(verifiedEmail)) {
      res.status(403).json({
        error: `Kechirasiz, "${verifiedEmail}" manziliga admin panelga kirish ruxsati berilmagan.`,
      });
      return;
    }

    res.json({
      ok: true,
      email: verifiedEmail,
      login: verifiedEmail,
    });
  });

  app.post('/api/admin/allowed-emails', (req: Request, res: Response) => {
    const { emails, emailsText } = req.body as {
      emails?: string[];
      emailsText?: string;
    };
    const raw = Array.isArray(emails) ? emails.join(',') : emailsText || '';
    const cleaned = raw
      .split(/[\s,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    if (cleaned.length === 0) {
      res.status(400).json({
        error: 'Kamida bitta ruxsat etilgan Gmail manzili bo‘lishi shart.',
      });
      return;
    }

    const invalid = cleaned.find((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    if (invalid) {
      res.status(400).json({
        error: `Email formati noto‘g‘ri: ${invalid}`,
      });
      return;
    }

    const uniqueEmails = Array.from(new Set(cleaned));
    const joined = uniqueEmails.join(', ');

    const db = readSchoolDb();
    const idx = db.settingsRows.findIndex(
      (r) => r.key === 'admin_allowed_emails'
    );
    const row = {
      key: 'admin_allowed_emails',
      value: joined,
      label: 'Ruxsat etilgan Gmail manzillar',
      section: 'Xavfsizlik',
    };
    if (idx === -1) db.settingsRows.push(row);
    else db.settingsRows[idx] = row;
    writeSchoolDb(db);

    res.json({ ok: true, emails: uniqueEmails, value: joined });
  });

  app.post('/api/admin/security-rows', (req: Request, res: Response) => {
    const { login } = req.body as { login?: string };
    const db = readSchoolDb();
    const expectedLogin =
      db.settingsRows.find((r) => r.key === 'admin_login')?.value || 'ibragim';
    const allowedEmails = parseAllowedEmails(
      db.settingsRows.find((r) => r.key === 'admin_allowed_emails')?.value
    );
    const normalized = (login || '').trim().toLowerCase();
    const isAuthorized =
      normalized === expectedLogin.trim().toLowerCase() ||
      allowedEmails.includes(normalized);

    if (!login || !isAuthorized) {
      res.status(403).json({ error: 'Ruxsat rad etildi' });
      return;
    }
    const rows = db.settingsRows.filter(
      (r) =>
        r.key === 'admin_login' ||
        r.key === 'admin_password' ||
        r.key === 'admin_allowed_emails'
    );
    res.json({ rows });
  });

  // Admin CMS API (Full CRUD backed by school-db.json + mirrored to Google Sheets on client)
  app.get('/api/cms/data', (_req: Request, res: Response) => {
    const db = readSchoolDb();
    const config = readSiteConfig();
    const safeSettingsRows = stripSensitiveSettingsRows(db.settingsRows);
    const adminLogin =
      db.settingsRows.find((r) => r.key === 'admin_login')?.value || 'ibragim';
    const allowedEmails = parseAllowedEmails(
      db.settingsRows.find((r) => r.key === 'admin_allowed_emails')?.value
    );
    res.json({
      configured: Boolean(config?.spreadsheetId),
      config,
      adminLogin,
      allowedEmails,
      data: {
        ...db,
        settingsRows: safeSettingsRows,
        settings: buildSettingsMap(safeSettingsRows),
      },
    });
  });

  app.post('/api/cms/upsert/:tab', (req: Request, res: Response) => {
    const tab = String(req.params.tab || '');
    const key = getDbCollectionKey(tab);
    if (!key) {
      res.status(400).json({ error: 'Unknown tab' });
      return;
    }
    const item = req.body as Record<string, string>;
    const idField = tab === 'Sozlamalar' ? 'key' : 'id';
    const itemId = item[idField];
    if (!itemId) {
      res.status(400).json({ error: `${idField} is required` });
      return;
    }

    const db = readSchoolDb();
    const list = db[key];
    const idx = list.findIndex((row) => row[idField] === itemId);
    if (idx === -1) {
      list.unshift(item);
    } else {
      list[idx] = item;
    }
    writeSchoolDb(db);
    res.json({ ok: true, item });
  });

  app.delete('/api/cms/delete/:tab/:id', (req: Request, res: Response) => {
    const tab = String(req.params.tab || '');
    const id = String(req.params.id || '');
    const key = getDbCollectionKey(tab);
    if (!key) {
      res.status(400).json({ error: 'Unknown tab' });
      return;
    }
    const idField = tab === 'Sozlamalar' ? 'key' : 'id';
    const db = readSchoolDb();
    db[key] = db[key].filter((row) => row[idField] !== id);
    writeSchoolDb(db);
    res.json({ ok: true });
  });

  app.post('/api/cms/settings', (req: Request, res: Response) => {
    const rows = req.body?.rows as Array<Record<string, string>>;
    if (!Array.isArray(rows)) {
      res.status(400).json({ error: 'rows array is required' });
      return;
    }
    const db = readSchoolDb();
    const preservedCreds = db.settingsRows.filter(
      (r) =>
        r.key === 'admin_login' ||
        r.key === 'admin_password' ||
        r.key === 'admin_allowed_emails'
    );
    const cleanIncoming = stripSensitiveSettingsRows(rows);
    db.settingsRows = [...cleanIncoming, ...preservedCreds];
    ensureAdminCredsInDb(db);
    writeSchoolDb(db);
    res.json({ ok: true });
  });

  app.post('/api/cms/replace-all', (req: Request, res: Response) => {
    const payload = req.body as Partial<SchoolDbData>;
    const current = readSchoolDb();
    const incomingSettings = payload.settingsRows ?? current.settingsRows;
    const hasLogin = incomingSettings.some((r) => r.key === 'admin_login');
    const hasPass = incomingSettings.some((r) => r.key === 'admin_password');
    const hasAllowed = incomingSettings.some(
      (r) => r.key === 'admin_allowed_emails'
    );
    const preserved = current.settingsRows.filter(
      (r) =>
        (r.key === 'admin_login' && !hasLogin) ||
        (r.key === 'admin_password' && !hasPass) ||
        (r.key === 'admin_allowed_emails' && !hasAllowed)
    );
    const next: SchoolDbData = {
      news: payload.news ?? current.news,
      leadership: payload.leadership ?? current.leadership,
      programs: payload.programs ?? current.programs,
      documents: payload.documents ?? current.documents,
      media: payload.media ?? current.media,
      settingsRows: [...incomingSettings, ...preserved],
      appeals: payload.appeals ?? current.appeals,
    };
    ensureAdminCredsInDb(next);
    writeSchoolDb(next);
    res.json({ ok: true });
  });

  app.post('/api/cms/reset-sample', (_req: Request, res: Response) => {
    const initial = createInitialDb();
    writeSchoolDb(initial);
    res.json({ ok: true, data: initial });
  });

  // File Upload endpoint (for local CMS storage when Drive isn't linked yet)
  app.post('/api/upload', (req: Request, res: Response) => {
    const { fileName, base64 } = req.body as {
      fileName?: string;
      base64?: string;
    };
    if (!fileName || !base64) {
      res.status(400).json({ error: 'fileName and base64 are required' });
      return;
    }
    ensureDataDirs();
    const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
    const safeName = `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const filePath = path.join(UPLOADS_DIR, safeName);
    const buf = Buffer.from(cleanBase64, 'base64');
    fs.writeFileSync(filePath, buf);
    res.json({
      ok: true,
      url: `/api/uploads/${safeName}`,
      size: `${Math.max(1, Math.round(buf.length / 1024))} KB`,
    });
  });

  // Public Drive Media Proxy
  app.get('/api/public/media/:fileId', async (req: Request, res: Response) => {
    const fileId = req.params.fileId;
    if (!fileId || !/^[a-zA-Z0-9_-]+$/.test(fileId)) {
      res.status(400).send('Invalid file ID');
      return;
    }

    const candidates = [
      `https://lh3.googleusercontent.com/d/${fileId}=w1600`,
      `https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`,
      `https://drive.google.com/uc?export=download&id=${fileId}`,
    ];

    for (const targetUrl of candidates) {
      try {
        const upstream = await fetch(targetUrl, {
          redirect: 'follow',
          headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        const contentType = upstream.headers.get('content-type') || '';
        if (
          upstream.ok &&
          (contentType.startsWith('image/') ||
            contentType.startsWith('application/octet-stream'))
        ) {
          res.setHeader('Content-Type', contentType);
          res.setHeader('Cache-Control', 'public, max-age=3600');
          const buffer = Buffer.from(await upstream.arrayBuffer());
          res.send(buffer);
          return;
        }
      } catch {
        // try next
      }
    }

    res.status(404).send('Media not accessible');
  });

  // Public Appeal Submission
  app.post('/api/public/appeal', (req: Request, res: Response) => {
    const body = req.body as Partial<QueuedAppeal>;
    if (!body.fullName || !body.phone || !body.message) {
      res.status(400).json({ error: 'Ism, telefon va murojaat matni majburiy' });
      return;
    }
    const item: QueuedAppeal = {
      id: `MR-${Date.now().toString().slice(-6)}`,
      fullName: body.fullName.trim(),
      phone: body.phone.trim(),
      topic: (body.topic || 'Umumiy murojaat').trim(),
      message: body.message.trim(),
      date: new Date().toISOString().slice(0, 10),
      status: 'Yangi',
    };

    // Save to school DB immediately so Admin sees it right away
    const db = readSchoolDb();
    db.appeals.unshift(item as unknown as Record<string, string>);
    writeSchoolDb(db);

    // Also queue for Google Sheets sync
    const current = readPendingAppeals();
    current.unshift(item);
    writePendingAppeals(current);

    res.json({ ok: true, item });
  });

  app.get('/api/public/appeals-queue', (_req: Request, res: Response) => {
    res.json({ items: readPendingAppeals() });
  });

  app.post('/api/public/appeals-queue/clear', (req: Request, res: Response) => {
    const ids = Array.isArray(req.body?.ids)
      ? (req.body.ids as string[])
      : null;
    if (!ids) {
      writePendingAppeals([]);
    } else {
      const remaining = readPendingAppeals().filter(
        (item) => !ids.includes(item.id)
      );
      writePendingAppeals(remaining);
    }
    res.json({ ok: true });
  });

  // Vite Dev Middleware or Static Production Build
  const isProd =
    process.env.NODE_ENV === 'production' ||
    process.env.npm_lifecycle_event === 'start';
  if (!isProd) {
    app.get('/@vite/client', (_req: Request, res: Response) => {
      res.type('application/javascript').send(`
const sheetsMap = new Map();
export function updateStyle(id, content) {
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.setAttribute('data-vite-dev-id', id);
    document.head.appendChild(style);
    sheetsMap.set(id, style);
  }
  style.textContent = content;
}
export function removeStyle(id) {
  const style = sheetsMap.get(id);
  if (style) {
    document.head.removeChild(style);
    sheetsMap.delete(id);
  }
}
export function createHotContext() {
  return {
    accept() {},
    acceptDeps() {},
    acceptExports() {},
    dispose() {},
    prune() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
    data: {}
  };
}
export function injectQuery(url) { return url; }
export class ErrorOverlay extends HTMLElement {}
`);
    });

    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT || 3000);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

createApp();
