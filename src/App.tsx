import { useCallback, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  getAccessToken,
  googleSignIn,
  initAuth,
  logout,
} from './services/firebaseAuth';
import type { SiteConfig, SiteDataset } from './types/cms';
import { PublicPortal } from './components/PublicPortal';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminLoginGate } from './components/AdminLoginGate';
import {
  fetchApiOrFallback,
  getStaticConfig,
  getStaticDataset,
  stripSensitiveRows,
} from './services/staticFallback';
import type { AlphabetMode } from './utils/uzbekAlphabet';
import type { ThemeId } from './utils/themes';

const THEME_STORAGE_KEY = 'qoshkopir_theme_id';
const ALPHABET_STORAGE_KEY = 'qoshkopir_alphabet_mode';
const ADMIN_SESSION_KEY = 'qoshkopir_admin_session';

export default function App() {
  const [viewMode, setViewMode] = useState<'portal' | 'admin'>('portal');
  const [adminLoginSession, setAdminLoginSession] = useState<string | null>(
    () => sessionStorage.getItem(ADMIN_SESSION_KEY)
  );

  const [themeId, setThemeId] = useState<ThemeId>(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return (saved as ThemeId) || 'lapis';
  });

  const [alphabetMode, setAlphabetMode] = useState<AlphabetMode>(() => {
    const saved = localStorage.getItem(ALPHABET_STORAGE_KEY);
    return saved === 'updated' ? 'updated' : 'classic';
  });

  // Firebase Auth & In-Memory OAuth Token state
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Dynamic Google Sheets + Drive Site Data
  const [configured, setConfigured] = useState(false);
  const [loadingPublic, setLoadingPublic] = useState(true);
  const [publicError, setPublicError] = useState<string | null>(null);
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [dataset, setDataset] = useState<SiteDataset | null>(null);

  useEffect(() => {
    const unsubscribe = initAuth(
      (authUser, token) => {
        setUser(authUser);
        setAccessToken(token);
        setNeedsAuth(false);
      },
      (authUser) => {
        setUser(authUser);
        setAccessToken(getAccessToken());
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  const fetchPublicSiteData = useCallback(async () => {
    setLoadingPublic(true);
    setPublicError(null);
    try {
      const apiRes = await fetchApiOrFallback<{
        configured: boolean;
        config: SiteConfig | null;
        data: SiteDataset | null;
        error?: string;
      }>('/api/public/site-data');

      if (apiRes.isBackendAvailable && apiRes.data) {
        setConfigured(apiRes.data.configured);
        setConfig(apiRes.data.config);
        setDataset(apiRes.data.data);
        if (apiRes.data.error) {
          setPublicError(apiRes.data.error);
        }
        return;
      }

      // Static hosting fallback (GitHub Pages without Express backend)
      const staticCfg = getStaticConfig();
      const staticDb = getStaticDataset();
      const safeRows = stripSensitiveRows(staticDb.settingsRows);
      const safeSettings: Record<string, string> = {};
      for (const row of safeRows) {
        if (row.key) safeSettings[row.key] = row.value || '';
      }
      setConfigured(Boolean(staticCfg?.spreadsheetId));
      setConfig(staticCfg);
      setDataset({
        ...staticDb,
        settingsRows: safeRows,
        settings: safeSettings,
        appeals: [],
      });
    } catch (err) {
      setPublicError(
        err instanceof Error ? err.message : 'Sayt ma’lumotlarini yuklab bo‘lmadi'
      );
    } finally {
      setLoadingPublic(false);
    }
  }, []);

  useEffect(() => {
    fetchPublicSiteData();
  }, [fetchPublicSiteData]);

  const handleChangeTheme = (id: ThemeId) => {
    setThemeId(id);
    localStorage.setItem(THEME_STORAGE_KEY, id);
  };

  const handleToggleAlphabet = () => {
    setAlphabetMode((prev) => {
      const next = prev === 'classic' ? 'updated' : 'classic';
      localStorage.setItem(ALPHABET_STORAGE_KEY, next);
      return next;
    });
  };

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setAccessToken(result.accessToken);
        setNeedsAuth(false);
      }
    } catch (err) {
      setAuthError(
        err instanceof Error
          ? err.message
          : 'Google orqali kirishda xatolik yuz berdi'
      );
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setAccessToken(null);
    setNeedsAuth(true);
  };

  const handleAdminLoginSuccess = (
    login: string,
    gmailAuth?: { user: User; accessToken: string }
  ) => {
    sessionStorage.setItem(ADMIN_SESSION_KEY, login);
    setAdminLoginSession(login);
    if (gmailAuth) {
      setUser(gmailAuth.user);
      setAccessToken(gmailAuth.accessToken || null);
      setNeedsAuth(!gmailAuth.accessToken);
    }
  };

  const handleAdminLogout = () => {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    setAdminLoginSession(null);
  };

  if (viewMode === 'admin') {
    if (!adminLoginSession) {
      return (
        <AdminLoginGate
          onSuccess={handleAdminLoginSuccess}
          onBackToSite={() => setViewMode('portal')}
        />
      );
    }

    return (
      <AdminDashboard
        adminLogin={adminLoginSession}
        user={user}
        accessToken={accessToken}
        needsAuth={needsAuth}
        isLoggingIn={isLoggingIn}
        authError={authError}
        config={config}
        onLogin={handleLogin}
        onLogout={handleLogout}
        onAdminLogout={handleAdminLogout}
        onAdminLoginChanged={(nextLogin) => handleAdminLoginSuccess(nextLogin)}
        onBackToSite={() => setViewMode('portal')}
        onConfigUpdated={(next) => {
          setConfig(next);
          setConfigured(Boolean(next?.spreadsheetId));
        }}
        onPublicDataChanged={fetchPublicSiteData}
      />
    );
  }

  return (
    <PublicPortal
      configured={configured}
      loading={loadingPublic}
      error={publicError}
      config={config}
      dataset={dataset}
      themeId={themeId}
      onChangeTheme={handleChangeTheme}
      alphabetMode={alphabetMode}
      onToggleAlphabet={handleToggleAlphabet}
      onOpenAdmin={() => setViewMode('admin')}
      onRefresh={fetchPublicSiteData}
    />
  );
}
