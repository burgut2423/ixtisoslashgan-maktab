import type {
  AcademicProgram,
  AppealItem,
  DriveFileEntry,
  LeadershipMember,
  MediaAsset,
  NewsItem,
  SchoolDocument,
  SchoolSetting,
  SheetTabName,
  SiteConfig,
  SiteDataset,
} from '../types/cms';
import {
  INITIAL_GENERATED_MEDIA,
  SHEET_HEADERS,
  buildSeedRows,
} from '../data/sampleSeedData';

const ROOT_FOLDER_NAME = "Qo'shko'pir Ixtisoslashtirilgan Maktab — Sayt Bazasi";
const MEDIA_FOLDER_NAME = 'Media (Rasmlar)';
const DOCS_FOLDER_NAME = 'Hujjatlar (PDF)';
const SPREADSHEET_NAME = 'Qoshkopir_Maktab_CMS_Baza';

const TAB_ORDER: SheetTabName[] = [
  'Yangiliklar',
  'Rahbariyat',
  'Yonalishlar',
  'Hujjatlar',
  'Media',
  'Sozlamalar',
  'Murojaatlar',
];

async function apiJson<T>(url: string, options: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google API xatoligi (${res.status}): ${errText}`);
  }
  if (res.status === 204) {
    return {} as T;
  }
  return (await res.json()) as T;
}

export function buildDriveMediaProxyUrl(fileId: string): string {
  return `/api/public/media/${encodeURIComponent(fileId)}`;
}

export async function makeFilePublicReadable(
  accessToken: string,
  fileId: string
): Promise<void> {
  await apiJson(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/permissions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone',
      }),
    }
  );
}

export async function createDriveFolder(
  accessToken: string,
  name: string,
  parentId?: string
): Promise<string> {
  const metadata: Record<string, unknown> = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentId) {
    metadata.parents = [parentId];
  }

  const created = await apiJson<{ id: string }>(
    'https://www.googleapis.com/drive/v3/files?fields=id,name',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadata),
    }
  );
  await makeFilePublicReadable(accessToken, created.id).catch(() => undefined);
  return created.id;
}

export async function uploadBlobToDrive(
  accessToken: string,
  blob: Blob,
  fileName: string,
  mimeType: string,
  folderId: string
): Promise<DriveFileEntry> {
  const metadata = {
    name: fileName,
    parents: [folderId],
  };

  const boundary = `qoshkopir_boundary_${Date.now()}`;
  const metadataPart =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${JSON.stringify(metadata)}\r\n`;
  const mediaHeader =
    `--${boundary}\r\n` +
    `Content-Type: ${mimeType || 'application/octet-stream'}\r\n\r\n`;
  const closing = `\r\n--${boundary}--`;

  const bodyBlob = new Blob([metadataPart, mediaHeader, blob, closing], {
    type: `multipart/related; boundary=${boundary}`,
  });

  const uploaded = await apiJson<DriveFileEntry>(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,createdTime,webViewLink,thumbnailLink,parents',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: bodyBlob,
    }
  );

  await makeFilePublicReadable(accessToken, uploaded.id).catch(() => undefined);
  return uploaded;
}

export async function listDriveFolderFiles(
  accessToken: string,
  folderId: string
): Promise<DriveFileEntry[]> {
  const q = `'${folderId}' in parents and trashed = false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    q
  )}&orderBy=createdTime desc&pageSize=100&fields=files(id,name,mimeType,size,createdTime,webViewLink,thumbnailLink,parents)`;

  const data = await apiJson<{ files?: DriveFileEntry[] }>(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data.files || [];
}

export async function deleteDriveFile(
  accessToken: string,
  fileId: string
): Promise<void> {
  await apiJson(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
}

export async function findExistingSchoolWorkspace(
  accessToken: string
): Promise<SiteConfig | null> {
  const sheetQuery = `name = '${SPREADSHEET_NAME}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`;
  const sheetRes = await apiJson<{ files?: Array<{ id: string; parents?: string[] }> }>(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      sheetQuery
    )}&fields=files(id,name,parents)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  const sheetFile = sheetRes.files?.[0];
  if (!sheetFile) return null;

  const rootFolderId = sheetFile.parents?.[0] || '';
  let mediaFolderId = '';
  let docsFolderId = '';

  if (rootFolderId) {
    const children = await listDriveFolderFiles(accessToken, rootFolderId);
    for (const child of children) {
      if (
        child.mimeType === 'application/vnd.google-apps.folder' &&
        child.name === MEDIA_FOLDER_NAME
      ) {
        mediaFolderId = child.id;
      }
      if (
        child.mimeType === 'application/vnd.google-apps.folder' &&
        child.name === DOCS_FOLDER_NAME
      ) {
        docsFolderId = child.id;
      }
    }
  }

  return {
    spreadsheetId: sheetFile.id,
    rootFolderId,
    mediaFolderId,
    docsFolderId,
    schoolTitle: "Qo'shko'pir tuman ixtisoslashtirilgan maktab",
    configuredAt: new Date().toISOString(),
  };
}

function formatBytes(bytesNum: number): string {
  if (!Number.isFinite(bytesNum) || bytesNum <= 0) return '—';
  if (bytesNum < 1024) return `${bytesNum} B`;
  if (bytesNum < 1024 * 1024) return `${Math.round(bytesNum / 1024)} KB`;
  return `${(bytesNum / (1024 * 1024)).toFixed(1)} MB`;
}

export async function provisionSchoolWorkspace(
  accessToken: string,
  userEmail: string,
  onProgress?: (stepText: string) => void
): Promise<SiteConfig> {
  onProgress?.('Google Drive-da bosh maktab papkasi yaratilmoqda...');
  const rootFolderId = await createDriveFolder(accessToken, ROOT_FOLDER_NAME);

  onProgress?.('Media va Hujjatlar ichki papkalari ochilmoqda...');
  const [mediaFolderId, docsFolderId] = await Promise.all([
    createDriveFolder(accessToken, MEDIA_FOLDER_NAME, rootFolderId),
    createDriveFolder(accessToken, DOCS_FOLDER_NAME, rootFolderId),
  ]);

  onProgress?.('Namuna rasmlar Google Drive Media papkasiga yuklanmoqda...');
  const uploadedMediaMap: Record<
    string,
    { driveFileId: string; url: string; size: string }
  > = {};

  for (const spec of INITIAL_GENERATED_MEDIA) {
    try {
      const imgRes = await fetch(spec.localPath);
      if (imgRes.ok) {
        const blob = await imgRes.blob();
        const driveFile = await uploadBlobToDrive(
          accessToken,
          blob,
          spec.fileName,
          blob.type || 'image/jpeg',
          mediaFolderId
        );
        uploadedMediaMap[spec.id] = {
          driveFileId: driveFile.id,
          url: buildDriveMediaProxyUrl(driveFile.id),
          size: formatBytes(Number(driveFile.size || blob.size)),
        };
      }
    } catch {
      // Fallback to local asset path if fetch fails
    }
  }

  onProgress?.('Google Sheets ma’lumotlar bazasi yaratilmoqda...');
  const spreadsheet = await apiJson<{
    spreadsheetId: string;
    sheets: Array<{ properties: { sheetId: number; title: string } }>;
  }>('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title: SPREADSHEET_NAME,
        locale: 'en_US',
      },
      sheets: TAB_ORDER.map((title) => ({
        properties: {
          title,
          gridProperties: { frozenRowCount: 1 },
        },
      })),
    }),
  });

  const spreadsheetId = spreadsheet.spreadsheetId;

  // Move spreadsheet inside rootFolderId
  onProgress?.('Jadval fayli Drive maktab papkasiga joylashtirilmoqda...');
  const fileMeta = await apiJson<{ parents?: string[] }>(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
      spreadsheetId
    )}?fields=parents`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const prevParents = (fileMeta.parents || []).join(',');
  await apiJson(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
      spreadsheetId
    )}?addParents=${encodeURIComponent(
      rootFolderId
    )}&removeParents=${encodeURIComponent(prevParents)}`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  await makeFilePublicReadable(accessToken, spreadsheetId).catch(() => undefined);

  onProgress?.('Barcha jadvallarga namuna ma’lumotlar yozilmoqda...');
  const seedRows = buildSeedRows(uploadedMediaMap);
  const valueRanges = TAB_ORDER.map((tab) => ({
    range: `'${tab}'!A1`,
    majorDimension: 'ROWS',
    values: [SHEET_HEADERS[tab], ...seedRows[tab]],
  }));

  await apiJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: valueRanges,
      }),
    }
  );

  // Format header rows nicely
  onProgress?.('Jadval sarlavhalari rasmiylashtirilmoqda...');
  const formatRequests = spreadsheet.sheets.map((s) => ({
    repeatCell: {
      range: {
        sheetId: s.properties.sheetId,
        startRowIndex: 0,
        endRowIndex: 1,
      },
      cell: {
        userEnteredFormat: {
          backgroundColor: { red: 0.075, green: 0.259, blue: 0.502 },
          textFormat: {
            foregroundColor: { red: 1, green: 1, blue: 1 },
            bold: true,
          },
        },
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat)',
    },
  }));

  await apiJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests: formatRequests }),
    }
  ).catch(() => undefined);

  const config: SiteConfig = {
    spreadsheetId,
    rootFolderId,
    mediaFolderId,
    docsFolderId,
    schoolTitle: "Qo'shko'pir tuman ixtisoslashtirilgan maktab",
    configuredAt: new Date().toISOString(),
    configuredByEmail: userEmail,
  };

  onProgress?.('Konfiguratsiya saqlanmoqda...');
  await fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });

  return config;
}

function rowsToObjects<T>(rows: string[][] | undefined): T[] {
  if (!rows || rows.length < 2) return [];
  const headers = rows[0].map((h) => String(h || '').trim());
  const out: T[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => String(c || '').trim() === '')) continue;
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      if (h) obj[h] = String(row[idx] ?? '');
    });
    out.push(obj as T);
  }
  return out;
}

export async function fetchAllSheetDataAuth(
  accessToken: string,
  spreadsheetId: string
): Promise<SiteDataset> {
  const rangesParam = TAB_ORDER.map((tab) => `ranges=${encodeURIComponent(`'${tab}'!A:Z`)}`).join('&');
  const res = await apiJson<{
    valueRanges?: Array<{ range: string; values?: string[][] }>;
  }>(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values:batchGet?${rangesParam}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  const vr = res.valueRanges || [];
  const news = rowsToObjects<NewsItem>(vr[0]?.values);
  const leadership = rowsToObjects<LeadershipMember>(vr[1]?.values);
  const programs = rowsToObjects<AcademicProgram>(vr[2]?.values);
  const documents = rowsToObjects<SchoolDocument>(vr[3]?.values);
  const media = rowsToObjects<MediaAsset>(vr[4]?.values);
  const settingsRows = rowsToObjects<SchoolSetting>(vr[5]?.values);
  const appeals = rowsToObjects<AppealItem>(vr[6]?.values);

  const settings: Record<string, string> = {};
  for (const s of settingsRows) {
    if (s.key) settings[s.key] = s.value || '';
  }

  return {
    news,
    leadership,
    programs,
    documents,
    media,
    settings,
    settingsRows,
    appeals,
  };
}

export async function appendSheetRow(
  accessToken: string,
  spreadsheetId: string,
  tabName: SheetTabName,
  rowValues: string[]
): Promise<void> {
  await apiJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values/${encodeURIComponent(`'${tabName}'!A1`)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        majorDimension: 'ROWS',
        values: [rowValues],
      }),
    }
  );
}

export async function updateSheetRowById(
  accessToken: string,
  spreadsheetId: string,
  tabName: SheetTabName,
  idColumnValue: string,
  rowValues: string[]
): Promise<void> {
  const getRes = await apiJson<{ values?: string[][] }>(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values/${encodeURIComponent(`'${tabName}'!A:Z`)}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  const rows = getRes.values || [];
  const rowIndex = rows.findIndex((r, idx) => idx > 0 && r[0] === idColumnValue);
  if (rowIndex === -1) {
    await appendSheetRow(accessToken, spreadsheetId, tabName, rowValues);
    return;
  }

  const sheetRowNumber = rowIndex + 1;
  await apiJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values/${encodeURIComponent(
      `'${tabName}'!A${sheetRowNumber}`
    )}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        majorDimension: 'ROWS',
        values: [rowValues],
      }),
    }
  );
}

export async function deleteSheetRowById(
  accessToken: string,
  spreadsheetId: string,
  tabName: SheetTabName,
  idColumnValue: string
): Promise<void> {
  const [metaRes, valuesRes] = await Promise.all([
    apiJson<{
      sheets: Array<{ properties: { sheetId: number; title: string } }>;
    }>(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}?fields=sheets.properties`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    ),
    apiJson<{ values?: string[][] }>(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}/values/${encodeURIComponent(`'${tabName}'!A:A`)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    ),
  ]);

  const targetSheet = metaRes.sheets.find((s) => s.properties.title === tabName);
  if (!targetSheet) throw new Error(`"${tabName}" varag‘i topilmadi`);

  const rows = valuesRes.values || [];
  const rowIndex = rows.findIndex((r, idx) => idx > 0 && r[0] === idColumnValue);
  if (rowIndex === -1) return;

  await apiJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: targetSheet.properties.sheetId,
                dimension: 'ROWS',
                startIndex: rowIndex,
                endIndex: rowIndex + 1,
              },
            },
          },
        ],
      }),
    }
  );
}

export async function reseedSampleDataInSheet(
  accessToken: string,
  spreadsheetId: string,
  mediaFolderId: string
): Promise<void> {
  const uploadedMediaMap: Record<
    string,
    { driveFileId: string; url: string; size: string }
  > = {};

  if (mediaFolderId) {
    const existingFiles = await listDriveFolderFiles(accessToken, mediaFolderId).catch(
      () => []
    );
    for (const spec of INITIAL_GENERATED_MEDIA) {
      const match = existingFiles.find((f) => f.name === spec.fileName);
      if (match) {
        uploadedMediaMap[spec.id] = {
          driveFileId: match.id,
          url: buildDriveMediaProxyUrl(match.id),
          size: formatBytes(Number(match.size || 0)),
        };
      } else {
        try {
          const imgRes = await fetch(spec.localPath);
          if (imgRes.ok) {
            const blob = await imgRes.blob();
            const driveFile = await uploadBlobToDrive(
              accessToken,
              blob,
              spec.fileName,
              blob.type || 'image/jpeg',
              mediaFolderId
            );
            uploadedMediaMap[spec.id] = {
              driveFileId: driveFile.id,
              url: buildDriveMediaProxyUrl(driveFile.id),
              size: formatBytes(Number(driveFile.size || blob.size)),
            };
          }
        } catch {
          // ignore
        }
      }
    }
  }

  const seedRows = buildSeedRows(uploadedMediaMap);

  await apiJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values:batchClear`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ranges: TAB_ORDER.map((tab) => `'${tab}'!A1:Z1000`),
      }),
    }
  );

  await apiJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: TAB_ORDER.map((tab) => ({
          range: `'${tab}'!A1`,
          majorDimension: 'ROWS',
          values: [SHEET_HEADERS[tab], ...seedRows[tab]],
        })),
      }),
    }
  );
}

export async function syncDatasetToGoogleSheet(
  accessToken: string,
  spreadsheetId: string,
  dataset: SiteDataset
): Promise<void> {
  const tabRows: Record<SheetTabName, string[][]> = {
    Yangiliklar: dataset.news.map((n) => [
      n.id,
      n.title,
      n.category,
      n.date,
      n.summary,
      n.content,
      n.imageUrl,
      n.driveFileId,
      n.featured,
      n.status,
    ]),
    Rahbariyat: dataset.leadership.map((l) => [
      l.id,
      l.fullName,
      l.role,
      l.department,
      l.receptionHours,
      l.phone,
      l.email,
      l.bio,
      l.imageUrl,
      l.driveFileId,
      l.order,
    ]),
    Yonalishlar: dataset.programs.map((p) => [
      p.id,
      p.title,
      p.code,
      p.gradeRange,
      p.subjects,
      p.quota,
      p.description,
      p.imageUrl,
      p.driveFileId,
    ]),
    Hujjatlar: dataset.documents.map((d) => [
      d.id,
      d.title,
      d.docNumber,
      d.category,
      d.date,
      d.summary,
      d.fileUrl,
      d.driveFileId,
    ]),
    Media: dataset.media.map((m) => [
      m.id,
      m.title,
      m.category,
      m.mimeType,
      m.driveFileId,
      m.url,
      m.createdAt,
      m.size,
    ]),
    Sozlamalar: dataset.settingsRows.map((s) => [
      s.key,
      s.value,
      s.label,
      s.section,
    ]),
    Murojaatlar: dataset.appeals.map((a) => [
      a.id,
      a.fullName,
      a.phone,
      a.topic,
      a.message,
      a.date,
      a.status,
    ]),
  };

  await apiJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values:batchClear`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ranges: TAB_ORDER.map((tab) => `'${tab}'!A1:Z1000`),
      }),
    }
  );

  await apiJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: TAB_ORDER.map((tab) => ({
          range: `'${tab}'!A1`,
          majorDimension: 'ROWS',
          values: [SHEET_HEADERS[tab], ...tabRows[tab]],
        })),
      }),
    }
  );
}
