import { useState } from 'react';
import type { FormEvent } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  MailCheck,
  ShieldCheck,
  User,
} from 'lucide-react';
import {
  FIREBASE_AUTH_SETTINGS_URL,
  googleSignIn,
  logout,
} from '../services/firebaseAuth';
import {
  fetchApiOrFallback,
  getStaticDataset,
  parseAllowedEmails,
} from '../services/staticFallback';
import { GoogleSignInButton } from './GoogleSignInButton';

interface AdminLoginGateProps {
  onSuccess: (
    login: string,
    gmailAuth?: { user: FirebaseUser; accessToken: string }
  ) => void;
  onBackToSite: () => void;
}

export function AdminLoginGate({
  onSuccess,
  onBackToSite,
}: AdminLoginGateProps) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [gmailLoading, setGmailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedDomain, setCopiedDomain] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!login.trim() || !password) {
      setError('Login va parolni kiriting.');
      return;
    }

    setLoading(true);
    try {
      const apiRes = await fetchApiOrFallback<{
        ok?: boolean;
        login?: string;
        error?: string;
      }>('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: login.trim(), password }),
      });

      if (apiRes.isBackendAvailable) {
        if (!apiRes.response?.ok || !apiRes.data?.ok) {
          throw new Error(apiRes.data?.error || 'Login yoki parol noto‘g‘ri');
        }
        onSuccess(apiRes.data.login || login.trim());
        return;
      }

      // Static hosting fallback (e.g. GitHub Pages without Express server)
      const staticDb = getStaticDataset();
      const expectedLogin =
        staticDb.settingsRows.find((r) => r.key === 'admin_login')?.value ||
        'ibragim';
      const expectedPass =
        staticDb.settingsRows.find((r) => r.key === 'admin_password')?.value ||
        '!ibragim@';
      if (login.trim() !== expectedLogin || password !== expectedPass) {
        throw new Error('Login yoki parol noto‘g‘ri');
      }
      onSuccess(expectedLogin);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Kirishda xatolik yuz berdi'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGmailLogin = async () => {
    setError(null);
    setGmailLoading(true);
    try {
      const authResult = await googleSignIn();
      if (!authResult?.user) {
        throw new Error('Google hisob tanlanmadi.');
      }

      const idToken = await authResult.user.getIdToken();
      const apiRes = await fetchApiOrFallback<{
        ok?: boolean;
        email?: string;
        login?: string;
        error?: string;
      }>('/api/admin/gmail-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      if (apiRes.isBackendAvailable) {
        if (!apiRes.response?.ok || !apiRes.data?.ok) {
          await logout().catch(() => undefined);
          throw new Error(
            apiRes.data?.error ||
              'Ushbu Gmail manziliga admin panelga kirish ruxsati berilmagan.'
          );
        }
        onSuccess(apiRes.data.email || apiRes.data.login || authResult.user.email || 'admin', {
          user: authResult.user,
          accessToken: authResult.accessToken,
        });
        return;
      }

      // Static hosting fallback (GitHub Pages)
      const userEmail = (authResult.user.email || '').trim().toLowerCase();
      const staticDb = getStaticDataset();
      const allowedRaw = staticDb.settingsRows.find(
        (r) => r.key === 'admin_allowed_emails'
      )?.value;
      const allowedList = parseAllowedEmails(allowedRaw);
      if (!userEmail || !allowedList.includes(userEmail)) {
        await logout().catch(() => undefined);
        throw new Error(
          `Kechirasiz, "${userEmail || 'noma’lum'}" manziliga admin panelga kirish ruxsati berilmagan.`
        );
      }

      onSuccess(userEmail, {
        user: authResult.user,
        accessToken: authResult.accessToken,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Google (Gmail) orqali kirishda xatolik yuz berdi'
      );
    } finally {
      setGmailLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="inline-flex items-center gap-2 text-base font-bold text-[#0F2D59]">
            <ShieldCheck className="h-5 w-5" />
            Qo‘shko‘pir IM — Admin Boshqaruvi
          </span>
          <button
            type="button"
            onClick={onBackToSite}
            className="btn-glow-outline inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Saytga qaytish
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-md px-6 py-14">
        <div className="w3-animate-zoom rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#134280]/10 text-[#134280]">
            <Lock className="h-5 w-5" />
          </div>
          <h1 className="mt-4 font-serif-editorial text-2xl font-bold text-slate-900">
            Admin panelga kirish
          </h1>
          <p className="mt-1.5 text-sm text-slate-600">
            Login va parol yoki ruxsat etilgan Gmail hisobingiz orqali tizimga
            kiring.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Login
              </label>
              <div className="relative mt-1.5">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  autoComplete="username"
                  required
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  placeholder="Login kiriting"
                  className="w-full rounded-md border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 focus:border-[#134280] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">
                Parol
              </label>
              <div className="relative mt-1.5">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Parol kiriting"
                  className="w-full rounded-md border border-slate-300 bg-white py-2.5 pl-9 pr-10 text-sm text-slate-900 focus:border-[#134280] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700"
                  aria-label={
                    showPassword ? 'Parolni yashirish' : 'Parolni ko‘rsatish'
                  }
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-800">
                <p>{error}</p>
                {error.toLowerCase().includes('unauthorized-domain') && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-red-200 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof window !== 'undefined') {
                          navigator.clipboard?.writeText(
                            window.location.hostname
                          );
                          setCopiedDomain(true);
                          setTimeout(() => setCopiedDomain(false), 2000);
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded border border-red-300 bg-white px-2 py-1 text-[11px] font-semibold text-red-800 hover:bg-red-100"
                    >
                      {copiedDomain ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                      {copiedDomain
                        ? 'Nusxalandi'
                        : `Nusxalash: ${
                            typeof window !== 'undefined'
                              ? window.location.hostname
                              : ''
                          }`}
                    </button>
                    <a
                      href={FIREBASE_AUTH_SETTINGS_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded bg-red-800 px-2 py-1 text-[11px] font-semibold text-white hover:bg-red-900"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Firebase Console
                    </a>
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || gmailLoading}
              className="btn-glow-primary w-full rounded-md px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? 'Tekshirilmoqda...' : 'Login orqali kirish'}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
              yoki Gmail bilan
            </span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="flex flex-col items-center gap-2.5 rounded-md border border-slate-200 bg-slate-50/70 p-4 text-center">
            <p className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
              <MailCheck className="h-4 w-4 text-[#134280]" />
              Ruxsat berilgan Gmail hisobi orqali kirish
            </p>
            <GoogleSignInButton
              onClick={handleGmailLogin}
              disabled={loading || gmailLoading}
              label={
                gmailLoading ? 'Tekshirilmoqda...' : 'Sign in with Google'
              }
            />
          </div>
        </div>
      </main>
    </div>
  );
}
