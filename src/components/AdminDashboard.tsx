import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import type { User } from 'firebase/auth';
import {
  BookOpen,
  CheckCircle2,
  Copy,
  Database,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Inbox,
  KeyRound,
  LayoutDashboard,
  Lock,
  LogOut,
  Mail,
  Newspaper,
  Pencil,
  Plus,
  RefreshCw,
  Settings,
  ShieldCheck,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
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
  appendSheetRow,
  buildDriveMediaProxyUrl,
  deleteDriveFile,
  deleteSheetRowById,
  fetchAllSheetDataAuth,
  findExistingSchoolWorkspace,
  listDriveFolderFiles,
  provisionSchoolWorkspace,
  reseedSampleDataInSheet,
  syncDatasetToGoogleSheet,
  updateSheetRowById,
  uploadBlobToDrive,
} from '../services/googleWorkspace';
import { FIREBASE_AUTH_SETTINGS_URL } from '../services/firebaseAuth';
import { GoogleSignInButton } from './GoogleSignInButton';
import { ConfirmModal } from './ConfirmModal';
import { MediaImage } from './MediaImage';
import {
  deleteStaticRow,
  fetchApiOrFallback,
  getStaticDataset,
  parseAllowedEmails,
  saveStaticConfig,
  saveStaticSettingsRows,
  upsertStaticRow,
  upsertStaticSecuritySetting,
} from '../services/staticFallback';

type AdminTab =
  | 'overview'
  | 'news'
  | 'leadership'
  | 'programs'
  | 'documents'
  | 'media'
  | 'appeals'
  | 'settings';

interface AdminDashboardProps {
  adminLogin: string;
  user: User | null;
  accessToken: string | null;
  needsAuth: boolean;
  isLoggingIn: boolean;
  authError: string | null;
  config: SiteConfig | null;
  onLogin: () => void;
  onLogout: () => void;
  onAdminLogout: () => void;
  onAdminLoginChanged?: (nextLogin: string) => void;
  onBackToSite: () => void;
  onConfigUpdated: (newConfig: SiteConfig | null) => void;
  onPublicDataChanged: () => void;
}

interface ConfirmState {
  open: boolean;
  title: string;
  description: string;
  items?: string[];
  confirmLabel?: string;
  destructive?: boolean;
  action: () => Promise<void>;
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Faylni o‘qib bo‘lmadi'));
    reader.readAsDataURL(file);
  });
}

export function AdminDashboard({
  adminLogin,
  user,
  accessToken,
  needsAuth,
  isLoggingIn,
  authError,
  config,
  onLogin,
  onLogout,
  onAdminLogout,
  onAdminLoginChanged,
  onBackToSite,
  onConfigUpdated,
  onPublicDataChanged,
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [dataset, setDataset] = useState<SiteDataset | null>(null);
  const [driveMediaFiles, setDriveMediaFiles] = useState<DriveFileEntry[]>([]);
  const [pendingAppeals, setPendingAppeals] = useState<AppealItem[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [savingForm, setSavingForm] = useState(false);
  const [provisionProgress, setProvisionProgress] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const [manualSheetId, setManualSheetId] = useState('');
  const [manualMediaFolderId, setManualMediaFolderId] = useState('');

  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const [editingNews, setEditingNews] = useState<NewsItem | null>(null);
  const [editingLeader, setEditingLeader] = useState<LeadershipMember | null>(null);
  const [editingProgram, setEditingProgram] = useState<AcademicProgram | null>(null);
  const [editingDoc, setEditingDoc] = useState<SchoolDocument | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [mediaCategory, setMediaCategory] = useState('Kampus');
  const [mediaTitle, setMediaTitle] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [settingsDraft, setSettingsDraft] = useState<SchoolSetting[]>([]);

  // Admin credentials & Gmail allowlist form state
  const [newAdminLogin, setNewAdminLogin] = useState(adminLogin || 'ibragim');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [confirmAdminPassword, setConfirmAdminPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [credError, setCredError] = useState<string | null>(null);

  const [allowedEmails, setAllowedEmails] = useState<string[]>([
    'burgutsony@gmail.com',
  ]);
  const [newAllowedEmail, setNewAllowedEmail] = useState('');
  const [allowedEmailError, setAllowedEmailError] = useState<string | null>(
    null
  );

  const isGoogleConnected = Boolean(accessToken && !needsAuth && config?.spreadsheetId);

  const filterPublicSettingsRows = (rows: SchoolSetting[]) =>
    rows.filter(
      (r) =>
        r.key !== 'admin_login' &&
        r.key !== 'admin_password' &&
        r.key !== 'admin_allowed_emails'
    );

  const loadLocalCmsData = async () => {
    const apiRes = await fetchApiOrFallback<{
      adminLogin?: string;
      allowedEmails?: string[];
      data: SiteDataset;
    }>('/api/cms/data');
    if (apiRes.isBackendAvailable && apiRes.response?.ok && apiRes.data) {
      setDataset(apiRes.data.data);
      setSettingsDraft(filterPublicSettingsRows(apiRes.data.data.settingsRows || []));
      if (apiRes.data.adminLogin) {
        setNewAdminLogin(apiRes.data.adminLogin);
      }
      if (
        Array.isArray(apiRes.data.allowedEmails) &&
        apiRes.data.allowedEmails.length > 0
      ) {
        setAllowedEmails(apiRes.data.allowedEmails);
      }
      return;
    }

    // Static hosting fallback (GitHub Pages without Express)
    const staticDb = getStaticDataset();
    setDataset(staticDb);
    setSettingsDraft(filterPublicSettingsRows(staticDb.settingsRows || []));
    const loginRow = staticDb.settingsRows.find((r) => r.key === 'admin_login');
    if (loginRow?.value) setNewAdminLogin(loginRow.value);
    const allowedRow = staticDb.settingsRows.find(
      (r) => r.key === 'admin_allowed_emails'
    );
    if (allowedRow?.value) setAllowedEmails(parseAllowedEmails(allowedRow.value));
  };

  const loadPendingAppeals = async () => {
    try {
      const res = await fetch('/api/public/appeals-queue');
      if (res.ok) {
        const json = (await res.json()) as { items: AppealItem[] };
        setPendingAppeals(json.items || []);
      }
    } catch {
      // ignore
    }
  };

  const refreshAdminWorkspace = async (
    token: string | null,
    activeConfig: SiteConfig | null
  ) => {
    setLoadingData(true);
    try {
      await loadLocalCmsData();
      await loadPendingAppeals();

      if (token && !needsAuth) {
        let targetConfig = activeConfig;
        if (!targetConfig?.spreadsheetId) {
          const discovered = await findExistingSchoolWorkspace(token).catch(
            () => null
          );
          if (discovered) {
            await fetch('/api/config', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...discovered,
                configuredByEmail: user?.email || '',
              }),
            });
            targetConfig = discovered;
            onConfigUpdated(discovered);
            onPublicDataChanged();
          }
        }

        if (targetConfig?.spreadsheetId) {
          const data = await fetchAllSheetDataAuth(
            token,
            targetConfig.spreadsheetId
          );
          setDataset(data);
          setSettingsDraft(filterPublicSettingsRows(data.settingsRows));
          const sheetLogin = data.settingsRows.find(
            (r) => r.key === 'admin_login'
          )?.value;
          if (sheetLogin) {
            setNewAdminLogin(sheetLogin);
          }
          const sheetAllowed = data.settingsRows.find(
            (r) => r.key === 'admin_allowed_emails'
          )?.value;
          if (sheetAllowed) {
            setAllowedEmails(parseAllowedEmails(sheetAllowed));
          }
          await fetch('/api/cms/replace-all', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });

          if (targetConfig.mediaFolderId) {
            const files = await listDriveFolderFiles(
              token,
              targetConfig.mediaFolderId
            ).catch(() => []);
            setDriveMediaFiles(files);
          }
        }
      }
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'Ma’lumotlarni yuklashda xatolik',
      });
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    refreshAdminWorkspace(accessToken, config);
  }, [accessToken, needsAuth, config?.spreadsheetId]);

  const uploadMediaSmart = async (
    file: File,
    folderTarget: 'media' | 'docs' = 'media'
  ): Promise<{ url: string; driveFileId: string; size: string }> => {
    const sizeText = `${Math.max(1, Math.round(file.size / 1024))} KB`;

    if (accessToken && !needsAuth) {
      const folderId =
        folderTarget === 'docs'
          ? config?.docsFolderId || config?.mediaFolderId
          : config?.mediaFolderId;
      if (folderId) {
        const uploaded = await uploadBlobToDrive(
          accessToken,
          file,
          file.name,
          file.type || 'application/octet-stream',
          folderId
        );
        return {
          driveFileId: uploaded.id,
          url:
            folderTarget === 'docs'
              ? uploaded.webViewLink ||
                `https://drive.google.com/file/d/${uploaded.id}/view`
              : buildDriveMediaProxyUrl(uploaded.id),
          size: uploaded.size
            ? `${Math.max(1, Math.round(Number(uploaded.size) / 1024))} KB`
            : sizeText,
        };
      }
    }

    const base64 = await fileToBase64(file);
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: file.name, base64 }),
    });
    if (!res.ok) throw new Error('Faylni serverga yuklab bo‘lmadi');
    const json = (await res.json()) as { url: string; size: string };
    return { url: json.url, driveFileId: '', size: json.size };
  };

  const saveRowSmart = async (
    tab: SheetTabName,
    rowObj: Record<string, string>,
    rowValues: string[]
  ) => {
    const apiRes = await fetchApiOrFallback(`/api/cms/upsert/${tab}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rowObj),
    });
    if (apiRes.isBackendAvailable) {
      if (!apiRes.response?.ok) {
        throw new Error('Lokal bazaga saqlashda xatolik');
      }
    } else {
      upsertStaticRow(tab, rowObj);
    }

    if (accessToken && !needsAuth && config?.spreadsheetId) {
      const idVal = tab === 'Sozlamalar' ? rowObj.key : rowObj.id;
      await updateSheetRowById(
        accessToken,
        config.spreadsheetId,
        tab,
        idVal,
        rowValues
      );
    }
  };

  const buildDatasetWithSecurityRows = async (
    baseDataset: SiteDataset
  ): Promise<SiteDataset> => {
    const hasLogin = baseDataset.settingsRows.some(
      (r) => r.key === 'admin_login'
    );
    const hasPass = baseDataset.settingsRows.some(
      (r) => r.key === 'admin_password'
    );
    const hasAllowed = baseDataset.settingsRows.some(
      (r) => r.key === 'admin_allowed_emails'
    );
    if (hasLogin && hasPass && hasAllowed) return baseDataset;

    let securityRows: SchoolSetting[] = [];
    try {
      const secRes = await fetch('/api/admin/security-rows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: adminLogin || newAdminLogin }),
      });
      if (secRes.ok) {
        const secJson = (await secRes.json()) as { rows?: SchoolSetting[] };
        securityRows = secJson.rows || [];
      }
    } catch {
      // ignore
    }

    const mergedRows = [...filterPublicSettingsRows(baseDataset.settingsRows)];
    for (const row of securityRows) {
      mergedRows.push(row);
    }
    return {
      ...baseDataset,
      settingsRows: mergedRows,
    };
  };

  const handleProvision = async () => {
    if (!accessToken) return;
    setStatusMessage(null);
    setProvisionProgress('Tayyorlanmoqda...');
    try {
      const created = await provisionSchoolWorkspace(
        accessToken,
        user?.email || '',
        (msg) => setProvisionProgress(msg)
      );
      if (dataset) {
        setProvisionProgress('Joriy CMS ma’lumotlari Google Sheets-ga yozilmoqda...');
        const fullDataset = await buildDatasetWithSecurityRows(dataset);
        await syncDatasetToGoogleSheet(accessToken, created.spreadsheetId, fullDataset);
      }
      onConfigUpdated(created);
      onPublicDataChanged();
      await refreshAdminWorkspace(accessToken, created);
      setStatusMessage({
        type: 'success',
        text: 'Google Drive papkasi, media fayllar va Google Sheets bazasi muvaffaqiyatli yaratildi!',
      });
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'Bazani yaratishda xatolik yuz berdi',
      });
    } finally {
      setProvisionProgress(null);
    }
  };

  const handleSyncLocalToSheets = async () => {
    if (!accessToken || !config?.spreadsheetId || !dataset) return;
    setLoadingData(true);
    try {
      const fullDataset = await buildDatasetWithSecurityRows(dataset);
      await syncDatasetToGoogleSheet(accessToken, config.spreadsheetId, fullDataset);
      await refreshAdminWorkspace(accessToken, config);
      onPublicDataChanged();
      setStatusMessage({
        type: 'success',
        text: 'Barcha ma’lumotlar Google Sheets-ga muvaffaqiyatli yuklandi.',
      });
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Sinxronlashda xatolik',
      });
    } finally {
      setLoadingData(false);
    }
  };

  const handleManualConnect = async (e: FormEvent) => {
    e.preventDefault();
    if (!manualSheetId.trim()) return;
    const nextConfig: SiteConfig = {
      spreadsheetId: manualSheetId.trim(),
      rootFolderId: manualMediaFolderId.trim() || manualSheetId.trim(),
      mediaFolderId: manualMediaFolderId.trim(),
      docsFolderId: '',
      schoolTitle: "Qo'shko'pir tuman ixtisoslashtirilgan maktab",
      configuredAt: new Date().toISOString(),
      configuredByEmail: user?.email || '',
    };
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nextConfig),
    });
    onConfigUpdated(nextConfig);
    onPublicDataChanged();
    await refreshAdminWorkspace(accessToken, nextConfig);
    setStatusMessage({
      type: 'success',
      text: 'Mavjud Google Sheets jadvali muvaffaqiyatli ulandi.',
    });
  };

  const askConfirmation = (cfg: ConfirmState) => {
    setConfirmState(cfg);
  };

  const executeConfirmation = async () => {
    if (!confirmState) return;
    setConfirmBusy(true);
    try {
      await confirmState.action();
      setConfirmState(null);
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Amalni bajarishda xatolik',
      });
    } finally {
      setConfirmBusy(false);
    }
  };

  const handleUploadMediaFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingMedia(true);
    setStatusMessage(null);
    try {
      const uploaded = await uploadMediaSmart(file, 'media');
      const newMediaId = `MED-${Date.now().toString().slice(-5)}`;
      const mediaObj: MediaAsset = {
        id: newMediaId,
        title: mediaTitle.trim() || file.name,
        category: mediaCategory,
        mimeType: file.type || 'image/jpeg',
        driveFileId: uploaded.driveFileId,
        url: uploaded.url,
        createdAt: new Date().toISOString().slice(0, 10),
        size: uploaded.size,
      };

      await saveRowSmart('Media', mediaObj as unknown as Record<string, string>, [
        mediaObj.id,
        mediaObj.title,
        mediaObj.category,
        mediaObj.mimeType,
        mediaObj.driveFileId,
        mediaObj.url,
        mediaObj.createdAt,
        mediaObj.size,
      ]);

      setMediaTitle('');
      e.target.value = '';
      await refreshAdminWorkspace(accessToken, config);
      onPublicDataChanged();
      setStatusMessage({
        type: 'success',
        text: isGoogleConnected
          ? `"${file.name}" Google Drive Media papkasiga yuklandi va Sheets jadvaliga qo‘shildi.`
          : `"${file.name}" media kutubxonasiga saqlandi.`,
      });
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Fayl yuklashda xatolik',
      });
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleDeleteRow = (
    tabName: SheetTabName,
    id: string,
    label: string
  ) => {
    askConfirmation({
      open: true,
      title: 'Yozuvni o‘chirishni tasdiqlang',
      description: `"${tabName}" bo‘limidan quyidagi ma’lumot o‘chiriladi:`,
      items: [label],
      confirmLabel: 'O‘chirish',
      destructive: true,
      action: async () => {
        const apiRes = await fetchApiOrFallback(
          `/api/cms/delete/${tabName}/${encodeURIComponent(id)}`,
          { method: 'DELETE' }
        );
        if (!apiRes.isBackendAvailable) {
          deleteStaticRow(tabName, id);
        }
        if (accessToken && !needsAuth && config?.spreadsheetId) {
          await deleteSheetRowById(
            accessToken,
            config.spreadsheetId,
            tabName,
            id
          );
        }
        await refreshAdminWorkspace(accessToken, config);
        onPublicDataChanged();
        setStatusMessage({
          type: 'success',
          text: `"${label}" muvaffaqiyatli o‘chirildi.`,
        });
      },
    });
  };

  const handleDeleteMedia = (mediaItem: MediaAsset) => {
    askConfirmation({
      open: true,
      title: 'Media faylni o‘chirish',
      description:
        'Bu fayl media kutubxonasidan (hamda ulangan bo‘lsa Google Drive papkasidan) o‘chiriladi.',
      items: [mediaItem.title || mediaItem.driveFileId],
      confirmLabel: 'O‘chirish',
      destructive: true,
      action: async () => {
        if (accessToken && !needsAuth && mediaItem.driveFileId) {
          await deleteDriveFile(accessToken, mediaItem.driveFileId).catch(
            () => undefined
          );
        }
        const apiRes = await fetchApiOrFallback(
          `/api/cms/delete/Media/${encodeURIComponent(mediaItem.id)}`,
          { method: 'DELETE' }
        );
        if (!apiRes.isBackendAvailable) {
          deleteStaticRow('Media', mediaItem.id);
        }
        if (accessToken && !needsAuth && config?.spreadsheetId) {
          await deleteSheetRowById(
            accessToken,
            config.spreadsheetId,
            'Media',
            mediaItem.id
          );
        }
        await refreshAdminWorkspace(accessToken, config);
        onPublicDataChanged();
        setStatusMessage({
          type: 'success',
          text: 'Media fayl o‘chirildi.',
        });
      },
    });
  };

  const handleSyncPendingAppeals = async () => {
    if (!accessToken || !config?.spreadsheetId || pendingAppeals.length === 0)
      return;
    setLoadingData(true);
    try {
      const syncedIds: string[] = [];
      for (const item of pendingAppeals) {
        await appendSheetRow(accessToken, config.spreadsheetId, 'Murojaatlar', [
          item.id,
          item.fullName,
          item.phone,
          item.topic,
          item.message,
          item.date,
          item.status,
        ]);
        syncedIds.push(item.id);
      }
      await fetch('/api/public/appeals-queue/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: syncedIds }),
      });
      await refreshAdminWorkspace(accessToken, config);
      setStatusMessage({
        type: 'success',
        text: `${syncedIds.length} ta murojaat Google Sheets jadvaliga saqlandi.`,
      });
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Sinxronlashda xatolik',
      });
    } finally {
      setLoadingData(false);
    }
  };

  const handleSaveSettings = () => {
    askConfirmation({
      open: true,
      title: 'Maktab sozlamalarini saqlash',
      description:
        'Kiritilgan barcha sozlamalar va ko‘rsatkichlar sayt bazasida yangilanadi.',
      confirmLabel: 'Saqlash',
      destructive: false,
      action: async () => {
        const apiRes = await fetchApiOrFallback('/api/cms/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: settingsDraft }),
        });
        if (!apiRes.isBackendAvailable) {
          saveStaticSettingsRows(settingsDraft);
        }
        if (accessToken && !needsAuth && config?.spreadsheetId) {
          for (const row of settingsDraft) {
            await updateSheetRowById(
              accessToken,
              config.spreadsheetId,
              'Sozlamalar',
              row.key,
              [row.key, row.value, row.label, row.section]
            );
          }
        }
        await refreshAdminWorkspace(accessToken, config);
        onPublicDataChanged();
        setStatusMessage({
          type: 'success',
          text: 'Maktab sozlamalari muvaffaqiyatli yangilandi.',
        });
      },
    });
  };

  const handleSaveAdminCredentials = (e: FormEvent) => {
    e.preventDefault();
    setCredError(null);
    const trimmedLogin = newAdminLogin.trim();
    if (!trimmedLogin) {
      setCredError('Login bo‘sh bo‘lmasligi kerak.');
      return;
    }
    if (!newAdminPassword || newAdminPassword.length < 4) {
      setCredError('Parol kamida 4 ta belgidan iborat bo‘lishi kerak.');
      return;
    }
    if (newAdminPassword !== confirmAdminPassword) {
      setCredError('Parol va tasdiqlash paroli bir-biriga mos emas.');
      return;
    }

    askConfirmation({
      open: true,
      title: 'Admin login va parolini yangilash',
      description: isGoogleConnected
        ? 'Yangi admin kirish ma’lumotlari saqlanadi va Google Sheets “Sozlamalar” jadvaliga yoziladi.'
        : 'Yangi admin kirish ma’lumotlari saqlanadi.',
      items: [`Yangi login: ${trimmedLogin}`, 'Yangi parol: ••••••••'],
      confirmLabel: 'Saqlash',
      destructive: false,
      action: async () => {
        const apiRes = await fetchApiOrFallback<{
          ok?: boolean;
          login?: string;
          error?: string;
        }>('/api/admin/credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            login: trimmedLogin,
            password: newAdminPassword,
          }),
        });
        if (apiRes.isBackendAvailable) {
          if (!apiRes.response?.ok || !apiRes.data?.ok) {
            throw new Error(
              apiRes.data?.error || 'Admin parolni saqlashda xatolik'
            );
          }
        } else {
          upsertStaticSecuritySetting('admin_login', trimmedLogin, 'Admin login');
          upsertStaticSecuritySetting('admin_password', newAdminPassword, 'Admin parol');
        }

        if (accessToken && !needsAuth && config?.spreadsheetId) {
          await updateSheetRowById(
            accessToken,
            config.spreadsheetId,
            'Sozlamalar',
            'admin_login',
            ['admin_login', trimmedLogin, 'Admin login', 'Xavfsizlik']
          );
          await updateSheetRowById(
            accessToken,
            config.spreadsheetId,
            'Sozlamalar',
            'admin_password',
            ['admin_password', newAdminPassword, 'Admin parol', 'Xavfsizlik']
          );
        }

        setNewAdminPassword('');
        setConfirmAdminPassword('');
        onAdminLoginChanged?.(trimmedLogin);
        await refreshAdminWorkspace(accessToken, config);
        setStatusMessage({
          type: 'success',
          text: isGoogleConnected
            ? 'Admin login va paroli yangilandi hamda Google Sheets “Sozlamalar” jadvaliga saqlandi.'
            : 'Admin login va paroli muvaffaqiyatli yangilandi.',
        });
      },
    });
  };

  const handleAddAllowedEmail = () => {
    setAllowedEmailError(null);
    const candidate = newAllowedEmail.trim().toLowerCase();
    if (!candidate) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate)) {
      setAllowedEmailError('To‘g‘ri Gmail/Email manzilini kiriting.');
      return;
    }
    if (allowedEmails.includes(candidate)) {
      setAllowedEmailError('Bu email manzil ro‘yxatda allaqachon mavjud.');
      return;
    }
    setAllowedEmails((prev) => [...prev, candidate]);
    setNewAllowedEmail('');
  };

  const handleRemoveAllowedEmail = (emailToRemove: string) => {
    setAllowedEmailError(null);
    if (allowedEmails.length <= 1) {
      setAllowedEmailError(
        'Kamida bitta ruxsat etilgan Gmail manzili qolishi shart.'
      );
      return;
    }
    setAllowedEmails((prev) => prev.filter((e) => e !== emailToRemove));
  };

  const handleSaveAllowedEmails = () => {
    setAllowedEmailError(null);
    if (allowedEmails.length === 0) {
      setAllowedEmailError(
        'Kamida bitta ruxsat etilgan Gmail manzili bo‘lishi shart.'
      );
      return;
    }

    askConfirmation({
      open: true,
      title: 'Ruxsat etilgan Gmail manzillarini saqlash',
      description: isGoogleConnected
        ? 'Quyidagi Gmail manzillarga Admin panelga kirish ruxsati beriladi va Google Sheets “Sozlamalar” jadvaliga saqlanadi:'
        : 'Quyidagi Gmail manzillarga Admin panelga kirish ruxsati beriladi:',
      items: allowedEmails,
      confirmLabel: 'Saqlash',
      destructive: false,
      action: async () => {
        let joinedValue = allowedEmails.join(', ');
        const apiRes = await fetchApiOrFallback<{
          ok?: boolean;
          emails?: string[];
          value?: string;
          error?: string;
        }>('/api/admin/allowed-emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emails: allowedEmails }),
        });

        if (apiRes.isBackendAvailable) {
          if (!apiRes.response?.ok || !apiRes.data?.ok) {
            throw new Error(
              apiRes.data?.error || 'Gmail ruxsatlarini saqlashda xatolik'
            );
          }
          joinedValue = apiRes.data.value || joinedValue;
        } else {
          upsertStaticSecuritySetting(
            'admin_allowed_emails',
            joinedValue,
            'Ruxsat etilgan Gmail manzillar'
          );
        }

        if (accessToken && !needsAuth && config?.spreadsheetId) {
          await updateSheetRowById(
            accessToken,
            config.spreadsheetId,
            'Sozlamalar',
            'admin_allowed_emails',
            [
              'admin_allowed_emails',
              joinedValue,
              'Ruxsat etilgan Gmail manzillar',
              'Xavfsizlik',
            ]
          );
        }

        saveStaticConfig(config);
        await refreshAdminWorkspace(accessToken, config);
        setStatusMessage({
          type: 'success',
          text: isGoogleConnected
            ? 'Ruxsat etilgan Gmail manzillar yangilandi va Google Sheets “Sozlamalar” jadvaliga saqlandi.'
            : 'Ruxsat etilgan Gmail manzillar muvaffaqiyatli saqlandi.',
        });
      },
    });
  };

  const copyMediaUrl = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const navItems: Array<{
    id: AdminTab;
    label: string;
    icon: typeof LayoutDashboard;
    count?: number;
  }> = useMemo(
    () => [
      { id: 'overview', label: 'Drive va Sheets baza', icon: LayoutDashboard },
      {
        id: 'news',
        label: 'Yangiliklar',
        icon: Newspaper,
        count: dataset?.news.length,
      },
      {
        id: 'programs',
        label: 'Yo‘nalishlar',
        icon: BookOpen,
        count: dataset?.programs.length,
      },
      {
        id: 'leadership',
        label: 'Rahbariyat',
        icon: Users,
        count: dataset?.leadership.length,
      },
      {
        id: 'documents',
        label: 'Hujjatlar',
        icon: FileText,
        count: dataset?.documents.length,
      },
      {
        id: 'media',
        label: 'Drive Media',
        icon: ImageIcon,
        count: dataset?.media.length,
      },
      {
        id: 'appeals',
        label: 'Murojaatlar',
        icon: Inbox,
        count: dataset?.appeals.length,
      },
      { id: 'settings', label: 'Sozlamalar', icon: Settings },
    ],
    [dataset]
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 lg:flex">
      {/* Sidebar */}
      <aside className="w-full shrink-0 border-b border-slate-200 bg-white lg:w-64 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <span className="text-sm font-bold text-[#0F2D59]">
            Qo‘shko‘pir IM Admin
          </span>
          <button
            type="button"
            onClick={onBackToSite}
            className="rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Saytga o‘tish
          </button>
        </div>

        <nav className="flex gap-1 overflow-x-auto p-3 lg:flex-col">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-[#134280] text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </span>
                {typeof item.count === 'number' && (
                  <span
                    className={`font-mono-tabular text-xs ${
                      active ? 'text-slate-200' : 'text-slate-400'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="hidden border-t border-slate-200 p-4 lg:block">
          <div className="mb-3 border-b border-slate-200 pb-3">
            <p className="text-[11px] font-medium text-slate-400">
              Admin sessiyasi
            </p>
            <p className="mt-0.5 truncate text-xs font-semibold text-slate-800">
              {adminLogin}
            </p>
            <button
              type="button"
              onClick={onAdminLogout}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-red-700"
            >
              <Lock className="h-3.5 w-3.5" />
              Paneldan chiqish
            </button>
          </div>
          {user && !needsAuth ? (
            <>
              <p className="truncate text-xs font-medium text-slate-800">
                {user.displayName || 'Google Hisob'}
              </p>
              <p className="truncate text-xs text-slate-500">{user.email}</p>
              <button
                type="button"
                onClick={onLogout}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-red-700 hover:underline"
              >
                <LogOut className="h-3.5 w-3.5" />
                Google hisobdan chiqish
              </button>
            </>
          ) : (
            <p className="text-xs text-slate-500">
              Google Drive va Sheets sinxronlash uchun Google orqali kiring.
            </p>
          )}
        </div>
      </aside>

      {/* Main Workspace */}
      <div className="flex-1 min-w-0">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <p className="text-xs text-slate-500">
              Admin Panel /{' '}
              {navItems.find((i) => i.id === activeTab)?.label || ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {(!accessToken || needsAuth) && (
              <GoogleSignInButton
                onClick={onLogin}
                disabled={isLoggingIn}
                label={isLoggingIn ? 'Kirilmoqda...' : 'Sign in with Google'}
              />
            )}
            <button
              type="button"
              onClick={() => refreshAdminWorkspace(accessToken, config)}
              disabled={loadingData}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loadingData ? 'animate-spin' : ''}`}
              />
              Yangilash
            </button>
            <button
              type="button"
              onClick={onAdminLogout}
              className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
            >
              <Lock className="h-3.5 w-3.5" />
              Chiqish
            </button>
            <button
              type="button"
              onClick={onBackToSite}
              className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Ommaviy sayt
            </button>
          </div>
        </header>

        <div className="max-w-6xl space-y-6 p-6">
          {authError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-xs text-red-900">
              <p className="font-semibold">
                Google kirish xatoligi: {authError}
              </p>
              {authError.toLowerCase().includes('unauthorized-domain') && (
                <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-red-200 pt-2.5">
                  <span className="text-red-800">
                    Domen:{' '}
                    <code className="rounded bg-white px-1.5 py-0.5 font-mono-tabular font-semibold text-red-950">
                      {typeof window !== 'undefined'
                        ? window.location.hostname
                        : ''}
                    </code>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        navigator.clipboard?.writeText(
                          window.location.hostname
                        );
                        setStatusMessage({
                          type: 'success',
                          text: `Domen nusxalandi: ${window.location.hostname}`,
                        });
                      }
                    }}
                    className="inline-flex items-center gap-1 rounded border border-red-300 bg-white px-2.5 py-1 font-medium text-red-800 hover:bg-red-100"
                  >
                    <Copy className="h-3 w-3" />
                    Domenni nusxalash
                  </button>
                  <a
                    href={FIREBASE_AUTH_SETTINGS_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded bg-red-800 px-2.5 py-1 font-medium text-white hover:bg-red-900"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Firebase Authorized Domains’ni ochish
                  </a>
                </div>
              )}
            </div>
          )}

          {statusMessage && (
            <div
              className={`flex items-start justify-between gap-3 rounded-md border p-4 text-sm ${
                statusMessage.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-red-200 bg-red-50 text-red-900'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{statusMessage.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setStatusMessage(null)}
                className="text-slate-500 hover:text-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* TAB: OVERVIEW & DRIVE/SHEETS SETUP */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-slate-200 bg-white p-5">
                  <p className="text-xs text-slate-500">Yangiliklar</p>
                  <p className="mt-1 font-mono-tabular text-2xl font-semibold text-slate-900">
                    {dataset?.news.length ?? 0}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-5">
                  <p className="text-xs text-slate-500">Yo‘nalishlar</p>
                  <p className="mt-1 font-mono-tabular text-2xl font-semibold text-slate-900">
                    {dataset?.programs.length ?? 0}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-5">
                  <p className="text-xs text-slate-500">Media fayllar</p>
                  <p className="mt-1 font-mono-tabular text-2xl font-semibold text-slate-900">
                    {dataset?.media.length ?? 0}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-5">
                  <p className="text-xs text-slate-500">Murojaatlar</p>
                  <p className="mt-1 font-mono-tabular text-2xl font-semibold text-[#134280]">
                    {dataset?.appeals.length ?? 0}
                  </p>
                </div>
              </div>

              {!config?.spreadsheetId ? (
                <div className="rounded-lg border border-slate-200 bg-white p-6 lg:p-8">
                  <h2 className="text-lg font-bold text-slate-900">
                    Google Drive Papka va Google Sheets Bazasini Sozlash
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
                    Chap menyudagi barcha bo‘limlarga (Yangiliklar, Yo‘nalishlar,
                    Rahbariyat, Hujjatlar, Media) hoziroq ma’lumot qo‘shishingiz
                    mumkin. Barcha ma’lumotlar va rasmlarni Google Drive hamda
                    Google Sheets-da saqlash uchun Google hisobingiz bilan
                    kiring va quyidagi tugmani bosing.
                  </p>

                  {provisionProgress && (
                    <div className="mt-5 rounded-md border border-[#134280]/20 bg-[#134280]/5 p-4 text-sm font-medium text-[#134280]">
                      {provisionProgress}
                    </div>
                  )}

                  <div className="mt-6 flex flex-wrap items-center gap-4">
                    {!accessToken || needsAuth ? (
                      <GoogleSignInButton
                        onClick={onLogin}
                        disabled={isLoggingIn}
                        label={
                          isLoggingIn
                            ? 'Kirilmoqda...'
                            : 'Sign in with Google'
                        }
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={handleProvision}
                        disabled={Boolean(provisionProgress)}
                        className="inline-flex items-center gap-2 rounded-md bg-[#134280] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0D3162] disabled:opacity-50"
                      >
                        <Database className="h-4 w-4" />
                        {provisionProgress
                          ? 'Yaratilmoqda...'
                          : 'Drive Papka va Sheets Bazasini Yaratish'}
                      </button>
                    )}
                  </div>

                  <form
                    onSubmit={handleManualConnect}
                    className="mt-8 border-t border-slate-200 pt-6"
                  >
                    <h3 className="text-sm font-semibold text-slate-800">
                      Mavjud Google Sheets ID orqali ulash
                    </h3>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <input
                        type="text"
                        value={manualSheetId}
                        onChange={(e) => setManualSheetId(e.target.value)}
                        placeholder="Google Spreadsheet ID"
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                      />
                      <input
                        type="text"
                        value={manualMediaFolderId}
                        onChange={(e) => setManualMediaFolderId(e.target.value)}
                        placeholder="Drive Media Folder ID (ixtiyoriy)"
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                      />
                      <button
                        type="submit"
                        className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
                      >
                        Mavjud bazani ulash
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-white p-6">
                  <h2 className="text-base font-semibold text-slate-900">
                    Ulangan Google Drive va Google Sheets resurslari
                  </h2>
                  <dl className="mt-4 divide-y divide-slate-200 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2 py-3">
                      <dt className="text-slate-500">Google Sheets Baza ID</dt>
                      <dd className="flex items-center gap-3 font-mono-tabular text-xs text-slate-800">
                        <span>{config.spreadsheetId}</span>
                        <a
                          href={`https://docs.google.com/spreadsheets/d/${config.spreadsheetId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-sans font-semibold text-[#134280] hover:underline"
                        >
                          Ochish <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </dd>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 py-3">
                      <dt className="text-slate-500">Google Drive Bosh Papka</dt>
                      <dd className="flex items-center gap-3 font-mono-tabular text-xs text-slate-800">
                        <span>{config.rootFolderId || '—'}</span>
                        {config.rootFolderId && (
                          <a
                            href={`https://drive.google.com/drive/folders/${config.rootFolderId}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 font-sans font-semibold text-[#134280] hover:underline"
                          >
                            Drive-da ochish{' '}
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </dd>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 py-3">
                      <dt className="text-slate-500">Drive Media Papkasi</dt>
                      <dd className="flex items-center gap-3 font-mono-tabular text-xs text-slate-800">
                        <span>{config.mediaFolderId || '—'}</span>
                        {config.mediaFolderId && (
                          <a
                            href={`https://drive.google.com/drive/folders/${config.mediaFolderId}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 font-sans font-semibold text-[#134280] hover:underline"
                          >
                            Media papka{' '}
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-5">
                    {accessToken && !needsAuth && (
                      <>
                        <button
                          type="button"
                          onClick={handleSyncLocalToSheets}
                          className="rounded-md bg-[#134280] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0D3162]"
                        >
                          Ma’lumotlarni Sheets-ga sinxronlash
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            askConfirmation({
                              open: true,
                              title: 'Namuna ma’lumotlarni qayta yozish',
                              description:
                                'Google Sheets jadvalidagi barcha ma’lumotlar boshlang‘ich namuna ma’lumotlar bilan qayta to‘ldiriladi.',
                              confirmLabel: 'Qayta yozish',
                              destructive: true,
                              action: async () => {
                                await reseedSampleDataInSheet(
                                  accessToken,
                                  config.spreadsheetId,
                                  config.mediaFolderId
                                );
                                await fetch('/api/cms/reset-sample', {
                                  method: 'POST',
                                });
                                await refreshAdminWorkspace(accessToken, config);
                                onPublicDataChanged();
                                setStatusMessage({
                                  type: 'success',
                                  text: 'Namuna ma’lumotlar qayta yozildi.',
                                });
                              },
                            })
                          }
                          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Namuna ma’lumotlarni qayta yozish
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        askConfirmation({
                          open: true,
                          title: 'Google Sheets ulanishini uzish',
                          description:
                            'Saytdan Google Sheets ulanishi uziladi (Google Drive fayllari o‘chirilmaydi).',
                          confirmLabel: 'Ulanishni uzish',
                          destructive: true,
                          action: async () => {
                            await fetch('/api/config', { method: 'DELETE' });
                            onConfigUpdated(null);
                            onPublicDataChanged();
                          },
                        })
                      }
                      className="rounded-md border border-red-200 bg-white px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                    >
                      Ulanishni uzish
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: NEWS CRUD */}
          {activeTab === 'news' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-900">
                  Yangiliklar va e’lonlar ({dataset?.news.length || 0})
                </h2>
                <button
                  type="button"
                  onClick={() =>
                    setEditingNews({
                      id: `YNG-${Date.now().toString().slice(-4)}`,
                      title: '',
                      category: 'Yangiliklar',
                      date: new Date().toISOString().slice(0, 10),
                      summary: '',
                      content: '',
                      imageUrl: dataset?.media[0]?.url || '',
                      driveFileId: dataset?.media[0]?.driveFileId || '',
                      featured: 'yoq',
                      status: 'Nashr etilgan',
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-md bg-[#134280] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0D3162]"
                >
                  <Plus className="h-4 w-4" />
                  Yangilik qo‘shish
                </button>
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <th className="px-4 py-3">Sarlavha</th>
                      <th className="px-4 py-3">Bo‘lim</th>
                      <th className="px-4 py-3">Sana</th>
                      <th className="px-4 py-3">Holat</th>
                      <th className="px-4 py-3 text-right">Amallar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {(dataset?.news || []).map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {item.title}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          {item.category}
                        </td>
                        <td className="px-4 py-3 font-mono-tabular text-xs text-slate-600">
                          {item.date}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-700">
                          {item.status}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setEditingNews(item)}
                            className="mr-2 rounded p-1.5 text-slate-600 hover:bg-slate-100"
                            title="Tahrirlash"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleDeleteRow('Yangiliklar', item.id, item.title)
                            }
                            className="rounded p-1.5 text-red-700 hover:bg-red-50"
                            title="O‘chirish"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: PROGRAMS CRUD */}
          {activeTab === 'programs' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-900">
                  Ta’lim yo‘nalishlari ({dataset?.programs.length || 0})
                </h2>
                <button
                  type="button"
                  onClick={() =>
                    setEditingProgram({
                      id: `YON-${Date.now().toString().slice(-4)}`,
                      title: '',
                      code: 'STEM-05',
                      gradeRange: '5–11-sinflar',
                      subjects: '',
                      quota: '48 o‘rin',
                      description: '',
                      imageUrl: dataset?.media[0]?.url || '',
                      driveFileId: '',
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-md bg-[#134280] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0D3162]"
                >
                  <Plus className="h-4 w-4" />
                  Yo‘nalish qo‘shish
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {(dataset?.programs || []).map((prog) => (
                  <div
                    key={prog.id}
                    className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-5"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span className="font-mono-tabular font-semibold text-[#134280]">
                          {prog.code} · {prog.gradeRange}
                        </span>
                        <span className="font-mono-tabular">{prog.quota}</span>
                      </div>
                      <h3 className="mt-2 font-semibold text-slate-900">
                        {prog.title}
                      </h3>
                      <p className="mt-1 text-xs text-slate-600">
                        {prog.subjects}
                      </p>
                    </div>
                    <div className="mt-4 flex justify-end gap-2 border-t border-slate-200 pt-3">
                      <button
                        type="button"
                        onClick={() => setEditingProgram(prog)}
                        className="rounded px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        Tahrirlash
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleDeleteRow('Yonalishlar', prog.id, prog.title)
                        }
                        className="rounded px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                      >
                        O‘chirish
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: LEADERSHIP CRUD */}
          {activeTab === 'leadership' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-900">
                  Rahbariyat tarkibi ({dataset?.leadership.length || 0})
                </h2>
                <button
                  type="button"
                  onClick={() =>
                    setEditingLeader({
                      id: `RHB-${Date.now().toString().slice(-4)}`,
                      fullName: '',
                      role: '',
                      department: '',
                      receptionHours: 'Dushanba – Juma, 09:00 – 12:00',
                      phone: '+998 (62) 329-14-10',
                      email: '',
                      bio: '',
                      imageUrl: dataset?.media[3]?.url || '',
                      driveFileId: '',
                      order: String((dataset?.leadership.length || 0) + 1),
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-md bg-[#134280] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0D3162]"
                >
                  <Plus className="h-4 w-4" />
                  Xodim qo‘shish
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {(dataset?.leadership || []).map((member) => (
                  <div
                    key={member.id}
                    className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-5"
                  >
                    <div>
                      <div className="aspect-[4/3] w-full overflow-hidden rounded border border-slate-200 bg-slate-100">
                        <MediaImage
                          src={member.imageUrl}
                          alt={member.fullName}
                          className="h-full w-full object-cover object-top"
                        />
                      </div>
                      <p className="mt-3 text-xs font-medium text-[#134280]">
                        {member.role}
                      </p>
                      <h3 className="mt-0.5 text-sm font-semibold text-slate-900">
                        {member.fullName}
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">
                        {member.receptionHours}
                      </p>
                    </div>
                    <div className="mt-4 flex justify-end gap-2 border-t border-slate-200 pt-3">
                      <button
                        type="button"
                        onClick={() => setEditingLeader(member)}
                        className="rounded px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        Tahrirlash
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleDeleteRow(
                            'Rahbariyat',
                            member.id,
                            member.fullName
                          )
                        }
                        className="rounded px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                      >
                        O‘chirish
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: DOCUMENTS CRUD */}
          {activeTab === 'documents' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-900">
                  Me’yoriy hujjatlar ({dataset?.documents.length || 0})
                </h2>
                <button
                  type="button"
                  onClick={() =>
                    setEditingDoc({
                      id: `HUJ-${Date.now().toString().slice(-4)}`,
                      title: '',
                      docNumber: `QIM-${new Date().getFullYear()}/`,
                      category: 'Nizom va Ustav',
                      date: new Date().toISOString().slice(0, 10),
                      summary: '',
                      fileUrl: '',
                      driveFileId: '',
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-md bg-[#134280] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0D3162]"
                >
                  <Plus className="h-4 w-4" />
                  Hujjat qo‘shish
                </button>
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <th className="px-4 py-3">Raqam</th>
                      <th className="px-4 py-3">Nomi</th>
                      <th className="px-4 py-3">Bo‘lim</th>
                      <th className="px-4 py-3">Sana</th>
                      <th className="px-4 py-3 text-right">Amallar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {(dataset?.documents || []).map((doc) => (
                      <tr key={doc.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono-tabular text-xs">
                          {doc.docNumber}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {doc.title}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          {doc.category}
                        </td>
                        <td className="px-4 py-3 font-mono-tabular text-xs text-slate-600">
                          {doc.date}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setEditingDoc(doc)}
                            className="mr-2 rounded p-1.5 text-slate-600 hover:bg-slate-100"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleDeleteRow('Hujjatlar', doc.id, doc.title)
                            }
                            className="rounded p-1.5 text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: MEDIA MANAGER */}
          {activeTab === 'media' && (
            <div className="space-y-6">
              <div className="rounded-lg border border-slate-200 bg-white p-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">
                      Rasm va Media Fayl Yuklash
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      {isGoogleConnected
                        ? 'Yuklangan fayllar to‘g‘ridan-to‘g‘ri Google Drive “Media (Rasmlar)” papkasiga saqlanadi.'
                        : 'Fayllar media kutubxonasiga yuklanadi (Google ulangach Drive papkasiga ko‘chiriladi).'}
                    </p>
                  </div>
                  {config?.mediaFolderId && (
                    <a
                      href={`https://drive.google.com/drive/folders/${config.mediaFolderId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <FolderOpen className="h-3.5 w-3.5" />
                      Drive papkani ochish
                    </a>
                  )}
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <input
                    type="text"
                    value={mediaTitle}
                    onChange={(e) => setMediaTitle(e.target.value)}
                    placeholder="Rasm sarlavhasi (ixtiyoriy)"
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                  <select
                    value={mediaCategory}
                    onChange={(e) => setMediaCategory(e.target.value)}
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="Kampus">Kampus</option>
                    <option value="Laboratoriya">Laboratoriya</option>
                    <option value="O'quv jarayoni">O'quv jarayoni</option>
                    <option value="Tadbirlar">Tadbirlar</option>
                    <option value="Rahbariyat">Rahbariyat</option>
                  </select>
                  <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md bg-[#134280] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0D3162]">
                    <Upload className="h-4 w-4" />
                    {uploadingMedia ? 'Yuklanmoqda...' : 'Rasm yuklash'}
                    <input
                      type="file"
                      accept="image/*,video/*"
                      onChange={handleUploadMediaFile}
                      disabled={uploadingMedia}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {(dataset?.media || []).map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white"
                  >
                    <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100">
                      <MediaImage src={item.url} alt={item.title} />
                    </div>
                    <div className="flex flex-1 flex-col justify-between p-4">
                      <div>
                        <p className="text-xs text-slate-500">
                          {item.category} ·{' '}
                          <span className="font-mono-tabular">{item.size}</span>
                        </p>
                        <p className="mt-1 text-sm font-medium text-slate-900 line-clamp-1">
                          {item.title}
                        </p>
                      </div>
                      <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-200 pt-3">
                        <button
                          type="button"
                          onClick={() => copyMediaUrl(item.url, item.id)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-[#134280] hover:underline"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          {copiedId === item.id ? 'Nusxalandi' : 'URL nusxalash'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteMedia(item)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-red-700 hover:underline"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          O‘chirish
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {driveMediaFiles.length > 0 && (
                <div className="rounded-lg border border-slate-200 bg-white p-5">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Drive Media papkasidagi fayllar ({driveMediaFiles.length})
                  </h3>
                  <ul className="mt-3 divide-y divide-slate-200 text-xs">
                    {driveMediaFiles.map((f) => (
                      <li
                        key={f.id}
                        className="flex items-center justify-between gap-4 py-2.5"
                      >
                        <span className="truncate font-medium text-slate-800">
                          {f.name}
                        </span>
                        <span className="shrink-0 font-mono-tabular text-slate-500">
                          {f.id}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* TAB: APPEALS INBOX */}
          {activeTab === 'appeals' && (
            <div className="space-y-6">
              {pendingAppeals.length > 0 && isGoogleConnected && (
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-amber-200 bg-amber-50 p-5">
                  <div>
                    <h3 className="text-sm font-semibold text-amber-950">
                      Saytdan kelgan {pendingAppeals.length} ta yangi murojaat
                      Google Sheets-ga yozilishni kutmoqda
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={handleSyncPendingAppeals}
                    className="rounded-md bg-[#134280] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0D3162]"
                  >
                    Sheets-ga saqlash ({pendingAppeals.length})
                  </button>
                </div>
              )}

              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <th className="px-4 py-3">Kod</th>
                      <th className="px-4 py-3">Fuqaro</th>
                      <th className="px-4 py-3">Telefon</th>
                      <th className="px-4 py-3">Mavzu va matn</th>
                      <th className="px-4 py-3">Holat</th>
                      <th className="px-4 py-3 text-right">Amallar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {(dataset?.appeals || []).map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3 font-mono-tabular text-xs">
                          {item.id}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {item.fullName}
                        </td>
                        <td className="px-4 py-3 font-mono-tabular text-xs text-slate-600">
                          {item.phone}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs font-semibold text-[#134280]">
                            {item.topic}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-600">
                            {item.message}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={item.status}
                            onChange={async (e) => {
                              const nextStatus = e.target.value;
                              const updated = { ...item, status: nextStatus };
                              await saveRowSmart(
                                'Murojaatlar',
                                updated as unknown as Record<string, string>,
                                [
                                  updated.id,
                                  updated.fullName,
                                  updated.phone,
                                  updated.topic,
                                  updated.message,
                                  updated.date,
                                  updated.status,
                                ]
                              );
                              await refreshAdminWorkspace(accessToken, config);
                            }}
                            className="rounded border border-slate-300 px-2 py-1 text-xs"
                          >
                            <option value="Yangi">Yangi</option>
                            <option value="Ko'rib chiqilmoqda">
                              Ko'rib chiqilmoqda
                            </option>
                            <option value="Javob berildi">Javob berildi</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              handleDeleteRow(
                                'Murojaatlar',
                                item.id,
                                item.fullName
                              )
                            }
                            className="rounded p-1.5 text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div className="rounded-lg border border-slate-200 bg-white p-6">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">
                      Maktab portali asosiy sozlamalari va ko‘rsatkichlari
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Saqlangandan so‘ng ommaviy portalda darhol aks etadi.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveSettings}
                    className="rounded-md bg-[#134280] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0D3162]"
                  >
                    O‘zgarishlarni saqlash
                  </button>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {settingsDraft.map((row, idx) => (
                    <div key={row.key}>
                      <label className="block text-xs font-medium text-slate-700">
                        {row.label || row.key}
                      </label>
                      <input
                        type="text"
                        value={row.value}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSettingsDraft((prev) =>
                            prev.map((r, i) =>
                              i === idx ? { ...r, value: val } : r
                            )
                          );
                        }}
                        className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#134280] focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Admin Login & Password Settings */}
              <form
                onSubmit={handleSaveAdminCredentials}
                className="rounded-lg border border-slate-200 bg-white p-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#134280]/10 text-[#134280]">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-slate-900">
                        Admin panel kirish login va parolini sozlash
                      </h2>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Kirish ma’lumotlari Google Sheets “Sozlamalar” jadvalida (
                        <code className="font-mono-tabular">admin_login</code>,{' '}
                        <code className="font-mono-tabular">admin_password</code>)
                        saqlanadi.
                      </p>
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-md bg-[#134280] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0D3162]"
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    Login va parolni yangilash
                  </button>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Yangi login *
                    </label>
                    <input
                      type="text"
                      required
                      value={newAdminLogin}
                      onChange={(e) => {
                        setNewAdminLogin(e.target.value);
                        setCredError(null);
                      }}
                      placeholder="Masalan: ibragim"
                      className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#134280] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Yangi parol *
                    </label>
                    <div className="relative mt-1.5">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        required
                        value={newAdminPassword}
                        onChange={(e) => {
                          setNewAdminPassword(e.target.value);
                          setCredError(null);
                        }}
                        placeholder="Kamida 4 ta belgi"
                        className="w-full rounded-md border border-slate-300 py-2 pl-3 pr-9 text-sm text-slate-900 focus:border-[#134280] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword((prev) => !prev)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700"
                        aria-label={
                          showNewPassword ? 'Parolni yashirish' : 'Parolni ko‘rsatish'
                        }
                      >
                        {showNewPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Yangi parolni tasdiqlash *
                    </label>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      value={confirmAdminPassword}
                      onChange={(e) => {
                        setConfirmAdminPassword(e.target.value);
                        setCredError(null);
                      }}
                      placeholder="Parolni qayta kiriting"
                      className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#134280] focus:outline-none"
                    />
                  </div>
                </div>

                {credError && (
                  <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-800">
                    {credError}
                  </div>
                )}
              </form>

              {/* Allowed Gmail Accounts for Admin Access */}
              <div className="rounded-lg border border-slate-200 bg-white p-6">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                      <Mail className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-slate-900">
                        Gmail orqali Admin kirish ruxsati
                      </h2>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Faqat ushbu ro‘yxatdagi Google (Gmail) manzillari
                        “Sign in with Google” tugmasi orqali admin panelga kira
                        oladi (Google Sheets:{' '}
                        <code className="font-mono-tabular">
                          admin_allowed_emails
                        </code>
                        ).
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveAllowedEmails}
                    className="inline-flex items-center gap-1.5 rounded-md bg-[#134280] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0D3162]"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Gmail ruxsatlarini saqlash
                  </button>
                </div>

                <div className="mt-5 flex flex-wrap gap-2.5">
                  <input
                    type="email"
                    value={newAllowedEmail}
                    onChange={(e) => {
                      setNewAllowedEmail(e.target.value);
                      setAllowedEmailError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddAllowedEmail();
                      }
                    }}
                    placeholder="Yangi Gmail manzil (masalan: director@gmail.com)"
                    className="min-w-[260px] flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#134280] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddAllowedEmail}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    <UserPlus className="h-4 w-4 text-[#134280]" />
                    Ro‘yxatga qo‘shish
                  </button>
                </div>

                {allowedEmailError && (
                  <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-800">
                    {allowedEmailError}
                  </div>
                )}

                <ul className="mt-4 divide-y divide-slate-200 rounded-md border border-slate-200">
                  {allowedEmails.map((email) => (
                    <li
                      key={email}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                    >
                      <span className="inline-flex items-center gap-2 font-medium text-slate-800">
                        <Mail className="h-4 w-4 text-slate-400" />
                        {email}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAllowedEmail(email)}
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                        title="Ruxsatni olib tashlash"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        O‘chirish
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: EDIT / CREATE NEWS */}
      {editingNews && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setSavingForm(true);
              try {
                await saveRowSmart(
                  'Yangiliklar',
                  editingNews as unknown as Record<string, string>,
                  [
                    editingNews.id,
                    editingNews.title,
                    editingNews.category,
                    editingNews.date,
                    editingNews.summary,
                    editingNews.content,
                    editingNews.imageUrl,
                    editingNews.driveFileId,
                    editingNews.featured,
                    editingNews.status,
                  ]
                );
                setEditingNews(null);
                await refreshAdminWorkspace(accessToken, config);
                onPublicDataChanged();
                setStatusMessage({
                  type: 'success',
                  text: 'Yangilik muvaffaqiyatli saqlandi.',
                });
              } catch (err) {
                setStatusMessage({
                  type: 'error',
                  text:
                    err instanceof Error
                      ? err.message
                      : 'Yangilikni saqlashda xatolik',
                });
              } finally {
                setSavingForm(false);
              }
            }}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-slate-200 bg-white p-6 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-semibold text-slate-900">
                Yangilik qo‘shish / tahrirlash
              </h3>
              <button
                type="button"
                onClick={() => setEditingNews(null)}
                className="text-slate-500 hover:text-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Sarlavha *
                </label>
                <input
                  type="text"
                  required
                  value={editingNews.title}
                  onChange={(e) =>
                    setEditingNews({ ...editingNews, title: e.target.value })
                  }
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Bo‘lim
                  </label>
                  <select
                    value={editingNews.category}
                    onChange={(e) =>
                      setEditingNews({
                        ...editingNews,
                        category: e.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="Yangiliklar">Yangiliklar</option>
                    <option value="E'lonlar">E'lonlar</option>
                    <option value="Yutuqlar">Yutuqlar</option>
                    <option value="Tadbirlar">Tadbirlar</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Sana
                  </label>
                  <input
                    type="date"
                    value={editingNews.date}
                    onChange={(e) =>
                      setEditingNews({ ...editingNews, date: e.target.value })
                    }
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Asosiy xabar
                  </label>
                  <select
                    value={editingNews.featured}
                    onChange={(e) =>
                      setEditingNews({
                        ...editingNews,
                        featured: e.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="yoq">Yo‘q</option>
                    <option value="ha">Ha (Bosh xabar)</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Kutubxonadan rasm tanlash
                  </label>
                  <select
                    value={editingNews.imageUrl}
                    onChange={(e) => {
                      const selected = dataset?.media.find(
                        (m) => m.url === e.target.value
                      );
                      setEditingNews({
                        ...editingNews,
                        imageUrl: e.target.value,
                        driveFileId: selected?.driveFileId || '',
                      });
                    }}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">Rasm tanlang...</option>
                    {(dataset?.media || []).map((m) => (
                      <option key={m.id} value={m.url}>
                        {m.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Yoki yangi rasm yuklash
                  </label>
                  <label className="mt-1 flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100">
                    <Upload className="h-3.5 w-3.5" />
                    Kompyuterdan yuklash
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (ev) => {
                        const f = ev.target.files?.[0];
                        if (!f) return;
                        const up = await uploadMediaSmart(f, 'media');
                        setEditingNews({
                          ...editingNews,
                          imageUrl: up.url,
                          driveFileId: up.driveFileId,
                        });
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Qisqa tavsif *
                </label>
                <textarea
                  rows={2}
                  required
                  value={editingNews.summary}
                  onChange={(e) =>
                    setEditingNews({ ...editingNews, summary: e.target.value })
                  }
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  To‘liq matn *
                </label>
                <textarea
                  rows={5}
                  required
                  value={editingNews.content}
                  onChange={(e) =>
                    setEditingNews({ ...editingNews, content: e.target.value })
                  }
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingNews(null)}
                disabled={savingForm}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
              >
                Bekor qilish
              </button>
              <button
                type="submit"
                disabled={savingForm}
                className="rounded-md bg-[#134280] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0D3162] disabled:opacity-50"
              >
                {savingForm ? 'Saqlanmoqda...' : 'Saqlash'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: EDIT / CREATE PROGRAM */}
      {editingProgram && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setSavingForm(true);
              try {
                await saveRowSmart(
                  'Yonalishlar',
                  editingProgram as unknown as Record<string, string>,
                  [
                    editingProgram.id,
                    editingProgram.title,
                    editingProgram.code,
                    editingProgram.gradeRange,
                    editingProgram.subjects,
                    editingProgram.quota,
                    editingProgram.description,
                    editingProgram.imageUrl,
                    editingProgram.driveFileId,
                  ]
                );
                setEditingProgram(null);
                await refreshAdminWorkspace(accessToken, config);
                onPublicDataChanged();
                setStatusMessage({
                  type: 'success',
                  text: 'Ta’lim yo‘nalishi saqlandi.',
                });
              } catch (err) {
                setStatusMessage({
                  type: 'error',
                  text:
                    err instanceof Error
                      ? err.message
                      : 'Saqlashda xatolik',
                });
              } finally {
                setSavingForm(false);
              }
            }}
            className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-semibold text-slate-900">
                Ta’lim yo‘nalishi
              </h3>
              <button
                type="button"
                onClick={() => setEditingProgram(null)}
                className="text-slate-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <input
                type="text"
                required
                placeholder="Yo‘nalish nomi"
                value={editingProgram.title}
                onChange={(e) =>
                  setEditingProgram({
                    ...editingProgram,
                    title: e.target.value,
                  })
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Kod"
                  value={editingProgram.code}
                  onChange={(e) =>
                    setEditingProgram({
                      ...editingProgram,
                      code: e.target.value,
                    })
                  }
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  placeholder="Sinflar"
                  value={editingProgram.gradeRange}
                  onChange={(e) =>
                    setEditingProgram({
                      ...editingProgram,
                      gradeRange: e.target.value,
                    })
                  }
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  placeholder="Kvota"
                  value={editingProgram.quota}
                  onChange={(e) =>
                    setEditingProgram({
                      ...editingProgram,
                      quota: e.target.value,
                    })
                  }
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <input
                type="text"
                placeholder="Chuqurlashtirilgan fanlar"
                value={editingProgram.subjects}
                onChange={(e) =>
                  setEditingProgram({
                    ...editingProgram,
                    subjects: e.target.value,
                  })
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <textarea
                rows={3}
                placeholder="Tavsif"
                value={editingProgram.description}
                onChange={(e) =>
                  setEditingProgram({
                    ...editingProgram,
                    description: e.target.value,
                  })
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingProgram(null)}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm"
              >
                Bekor qilish
              </button>
              <button
                type="submit"
                disabled={savingForm}
                className="rounded-md bg-[#134280] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {savingForm ? 'Saqlanmoqda...' : 'Saqlash'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: EDIT / CREATE LEADER */}
      {editingLeader && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setSavingForm(true);
              try {
                await saveRowSmart(
                  'Rahbariyat',
                  editingLeader as unknown as Record<string, string>,
                  [
                    editingLeader.id,
                    editingLeader.fullName,
                    editingLeader.role,
                    editingLeader.department,
                    editingLeader.receptionHours,
                    editingLeader.phone,
                    editingLeader.email,
                    editingLeader.bio,
                    editingLeader.imageUrl,
                    editingLeader.driveFileId,
                    editingLeader.order,
                  ]
                );
                setEditingLeader(null);
                await refreshAdminWorkspace(accessToken, config);
                onPublicDataChanged();
                setStatusMessage({
                  type: 'success',
                  text: 'Rahbariyat a’zosi saqlandi.',
                });
              } catch (err) {
                setStatusMessage({
                  type: 'error',
                  text:
                    err instanceof Error
                      ? err.message
                      : 'Saqlashda xatolik',
                });
              } finally {
                setSavingForm(false);
              }
            }}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-slate-200 bg-white p-6 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-semibold text-slate-900">
                Rahbariyat a’zosi
              </h3>
              <button
                type="button"
                onClick={() => setEditingLeader(null)}
                className="text-slate-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <input
                type="text"
                required
                placeholder="F.I.Sh."
                value={editingLeader.fullName}
                onChange={(e) =>
                  setEditingLeader({
                    ...editingLeader,
                    fullName: e.target.value,
                  })
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="text"
                required
                placeholder="Lavozimi"
                value={editingLeader.role}
                onChange={(e) =>
                  setEditingLeader({ ...editingLeader, role: e.target.value })
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="text"
                placeholder="Qabul kunlari"
                value={editingLeader.receptionHours}
                onChange={(e) =>
                  setEditingLeader({
                    ...editingLeader,
                    receptionHours: e.target.value,
                  })
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Telefon"
                  value={editingLeader.phone}
                  onChange={(e) =>
                    setEditingLeader({
                      ...editingLeader,
                      phone: e.target.value,
                    })
                  }
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={editingLeader.email}
                  onChange={(e) =>
                    setEditingLeader({
                      ...editingLeader,
                      email: e.target.value,
                    })
                  }
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={editingLeader.imageUrl}
                  onChange={(e) =>
                    setEditingLeader({
                      ...editingLeader,
                      imageUrl: e.target.value,
                    })
                  }
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Rasm tanlash...</option>
                  {(dataset?.media || []).map((m) => (
                    <option key={m.id} value={m.url}>
                      {m.title}
                    </option>
                  ))}
                </select>
                <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100">
                  <Upload className="h-3.5 w-3.5" />
                  Portret yuklash
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (ev) => {
                      const f = ev.target.files?.[0];
                      if (!f) return;
                      const up = await uploadMediaSmart(f, 'media');
                      setEditingLeader({
                        ...editingLeader,
                        imageUrl: up.url,
                        driveFileId: up.driveFileId,
                      });
                    }}
                    className="hidden"
                  />
                </label>
              </div>
              <textarea
                rows={3}
                placeholder="Qisqacha biografiya"
                value={editingLeader.bio}
                onChange={(e) =>
                  setEditingLeader({ ...editingLeader, bio: e.target.value })
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingLeader(null)}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm"
              >
                Bekor qilish
              </button>
              <button
                type="submit"
                disabled={savingForm}
                className="rounded-md bg-[#134280] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {savingForm ? 'Saqlanmoqda...' : 'Saqlash'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: EDIT / CREATE DOCUMENT */}
      {editingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setSavingForm(true);
              try {
                await saveRowSmart(
                  'Hujjatlar',
                  editingDoc as unknown as Record<string, string>,
                  [
                    editingDoc.id,
                    editingDoc.title,
                    editingDoc.docNumber,
                    editingDoc.category,
                    editingDoc.date,
                    editingDoc.summary,
                    editingDoc.fileUrl,
                    editingDoc.driveFileId,
                  ]
                );
                setEditingDoc(null);
                await refreshAdminWorkspace(accessToken, config);
                onPublicDataChanged();
                setStatusMessage({
                  type: 'success',
                  text: 'Hujjat muvaffaqiyatli saqlandi.',
                });
              } catch (err) {
                setStatusMessage({
                  type: 'error',
                  text:
                    err instanceof Error
                      ? err.message
                      : 'Saqlashda xatolik',
                });
              } finally {
                setSavingForm(false);
              }
            }}
            className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-semibold text-slate-900">
                Me’yoriy hujjat
              </h3>
              <button
                type="button"
                onClick={() => setEditingDoc(null)}
                className="text-slate-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <input
                type="text"
                required
                placeholder="Hujjat nomi"
                value={editingDoc.title}
                onChange={(e) =>
                  setEditingDoc({ ...editingDoc, title: e.target.value })
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Raqami"
                  value={editingDoc.docNumber}
                  onChange={(e) =>
                    setEditingDoc({ ...editingDoc, docNumber: e.target.value })
                  }
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  placeholder="Bo‘lim"
                  value={editingDoc.category}
                  onChange={(e) =>
                    setEditingDoc({ ...editingDoc, category: e.target.value })
                  }
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  type="date"
                  value={editingDoc.date}
                  onChange={(e) =>
                    setEditingDoc({ ...editingDoc, date: e.target.value })
                  }
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <textarea
                rows={2}
                placeholder="Qisqa izoh"
                value={editingDoc.summary}
                onChange={(e) =>
                  setEditingDoc({ ...editingDoc, summary: e.target.value })
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-xs font-medium text-slate-700 hover:bg-slate-100">
                <Upload className="h-4 w-4" />
                {editingDoc.fileUrl
                  ? 'Hujjat fayli biriktirilgan (almashtirish)'
                  : 'PDF / Hujjat faylini yuklash'}
                <input
                  type="file"
                  onChange={async (ev) => {
                    const f = ev.target.files?.[0];
                    if (!f) return;
                    const uploaded = await uploadMediaSmart(f, 'docs');
                    setEditingDoc({
                      ...editingDoc,
                      driveFileId: uploaded.driveFileId,
                      fileUrl: uploaded.url,
                    });
                  }}
                  className="hidden"
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingDoc(null)}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm"
              >
                Bekor qilish
              </button>
              <button
                type="submit"
                disabled={savingForm}
                className="rounded-md bg-[#134280] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {savingForm ? 'Saqlanmoqda...' : 'Saqlash'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MANDATORY CONFIRMATION DIALOG */}
      <ConfirmModal
        open={Boolean(confirmState?.open)}
        title={confirmState?.title || ''}
        description={confirmState?.description || ''}
        items={confirmState?.items}
        confirmLabel={confirmState?.confirmLabel}
        destructive={confirmState?.destructive}
        busy={confirmBusy}
        onConfirm={executeConfirmation}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  );
}
