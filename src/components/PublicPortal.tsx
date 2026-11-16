import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  ArrowRight,
  Award,
  BookOpen,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Database,
  ExternalLink,
  FileText,
  GraduationCap,
  Images,
  Landmark,
  Languages,
  Mail,
  MapPin,
  Menu,
  MessageSquare,
  Newspaper,
  Palette,
  Phone,
  Search,
  Send,
  TrendingUp,
  UserCheck,
  Users,
  X,
  ZoomIn,
} from 'lucide-react';
import type {
  MediaAsset,
  NewsItem,
  SiteConfig,
  SiteDataset,
} from '../types/cms';
import { MediaImage } from './MediaImage';
import { fetchApiOrFallback, upsertStaticRow } from '../services/staticFallback';
import {
  convertUzbekAlphabet,
  type AlphabetMode,
} from '../utils/uzbekAlphabet';
import {
  getThemeById,
  PORTAL_THEMES,
  type ThemeId,
} from '../utils/themes';

interface PublicPortalProps {
  configured: boolean;
  loading: boolean;
  error: string | null;
  config: SiteConfig | null;
  dataset: SiteDataset | null;
  themeId: ThemeId;
  onChangeTheme: (id: ThemeId) => void;
  alphabetMode: AlphabetMode;
  onToggleAlphabet: () => void;
  onOpenAdmin: () => void;
  onRefresh: () => void;
}

const NEWS_PAGE_SIZE = 10;

export function PublicPortal({
  configured,
  loading,
  error,
  config,
  dataset,
  themeId,
  onChangeTheme,
  alphabetMode,
  onToggleAlphabet,
  onOpenAdmin,
  onRefresh,
}: PublicPortalProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [newsCategory, setNewsCategory] = useState<string>('Barchasi');
  const [newsSearch, setNewsSearch] = useState('');
  const [newsPage, setNewsPage] = useState(1);
  const [activeArticle, setActiveArticle] = useState<NewsItem | null>(null);
  const [docCategory, setDocCategory] = useState<string>('Barchasi');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [customLightbox, setCustomLightbox] = useState<{
    url: string;
    title: string;
    subtitle?: string;
  } | null>(null);

  // Appeal form state
  const [appealName, setAppealName] = useState('');
  const [appealPhone, setAppealPhone] = useState('');
  const [appealTopic, setAppealTopic] = useState('Qabul 2026 masalasi');
  const [appealMessage, setAppealMessage] = useState('');
  const [appealSubmitting, setAppealSubmitting] = useState(false);
  const [appealSuccess, setAppealSuccess] = useState<string | null>(null);
  const [appealError, setAppealError] = useState<string | null>(null);

  const theme = useMemo(() => getThemeById(themeId), [themeId]);
  const tr = (text: string | undefined | null) =>
    convertUzbekAlphabet(text, alphabetMode);

  const settings = dataset?.settings || {};
  const schoolName =
    settings.school_name || "Qo‘shko‘pir tuman ixtisoslashtirilgan maktab";

  const publishedNews = useMemo(() => {
    const items = dataset?.news || [];
    return items.filter(
      (item) =>
        !item.status ||
        item.status.toLowerCase().includes('nashr') ||
        item.status.toLowerCase() === 'active'
    );
  }, [dataset?.news]);

  const newsCategories = useMemo(() => {
    const cats = new Set<string>(['Barchasi']);
    for (const n of publishedNews) {
      if (n.category) cats.add(n.category);
    }
    return Array.from(cats);
  }, [publishedNews]);

  const filteredNews = useMemo(() => {
    const q = newsSearch.trim().toLowerCase();
    return publishedNews.filter((item) => {
      const catMatch =
        newsCategory === 'Barchasi' || item.category === newsCategory;
      const textMatch =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q) ||
        convertUzbekAlphabet(item.title, 'updated').toLowerCase().includes(q);
      return catMatch && textMatch;
    });
  }, [publishedNews, newsCategory, newsSearch]);

  // Reset page to 1 when filter/search changes
  useEffect(() => {
    setNewsPage(1);
  }, [newsCategory, newsSearch]);

  const totalNewsPages = Math.max(
    1,
    Math.ceil(filteredNews.length / NEWS_PAGE_SIZE)
  );
  const safeNewsPage = Math.min(newsPage, totalNewsPages);

  const paginatedNews = useMemo(() => {
    const start = (safeNewsPage - 1) * NEWS_PAGE_SIZE;
    return filteredNews.slice(start, start + NEWS_PAGE_SIZE);
  }, [filteredNews, safeNewsPage]);

  const leadStory = useMemo(() => {
    if (safeNewsPage !== 1 || paginatedNews.length === 0) return null;
    return (
      paginatedNews.find((n) => n.featured?.toLowerCase() === 'ha') ||
      paginatedNews[0]
    );
  }, [paginatedNews, safeNewsPage]);

  const secondaryStories = useMemo(() => {
    if (!leadStory) return paginatedNews;
    return paginatedNews.filter((n) => n.id !== leadStory.id);
  }, [paginatedNews, leadStory]);

  const docCategories = useMemo(() => {
    const cats = new Set<string>(['Barchasi']);
    for (const d of dataset?.documents || []) {
      if (d.category) cats.add(d.category);
    }
    return Array.from(cats);
  }, [dataset?.documents]);

  const filteredDocuments = useMemo(() => {
    const docs = dataset?.documents || [];
    if (docCategory === 'Barchasi') return docs;
    return docs.filter((d) => d.category === docCategory);
  }, [dataset?.documents, docCategory]);

  const sortedLeadership = useMemo(() => {
    const list = [...(dataset?.leadership || [])];
    list.sort((a, b) => Number(a.order || 99) - Number(b.order || 99));
    return list;
  }, [dataset?.leadership]);

  const mediaList: MediaAsset[] = dataset?.media || [];
  const activeLightboxMedia =
    lightboxIndex !== null && mediaList[lightboxIndex]
      ? mediaList[lightboxIndex]
      : null;

  // Keyboard navigation for modals
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveArticle(null);
        setLightboxIndex(null);
        setCustomLightbox(null);
        setThemeMenuOpen(false);
      } else if (lightboxIndex !== null && mediaList.length > 0) {
        if (e.key === 'ArrowRight') {
          setLightboxIndex((prev) =>
            prev === null ? 0 : (prev + 1) % mediaList.length
          );
        } else if (e.key === 'ArrowLeft') {
          setLightboxIndex((prev) =>
            prev === null
              ? 0
              : (prev - 1 + mediaList.length) % mediaList.length
          );
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightboxIndex, mediaList.length]);

  const handleNewsPageChange = (nextPage: number) => {
    setNewsPage(nextPage);
    document
      .getElementById('yangiliklar')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSubmitAppeal = async (e: FormEvent) => {
    e.preventDefault();
    setAppealError(null);
    setAppealSuccess(null);

    if (!appealName.trim() || !appealPhone.trim() || !appealMessage.trim()) {
      setAppealError(
        tr('Iltimos, barcha majburiy maydonlarni to‘ldiring.')
      );
      return;
    }

    setAppealSubmitting(true);
    try {
      const apiRes = await fetchApiOrFallback<{
        item?: { id: string };
        error?: string;
      }>('/api/public/appeal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: appealName.trim(),
          phone: appealPhone.trim(),
          topic: appealTopic,
          message: appealMessage.trim(),
        }),
      });

      let createdId = '';
      if (apiRes.isBackendAvailable) {
        if (!apiRes.response?.ok || !apiRes.data?.item) {
          throw new Error(apiRes.data?.error || 'Murojaat yuborishda xatolik');
        }
        createdId = apiRes.data.item.id;
      } else {
        createdId = `MR-${Date.now().toString().slice(-6)}`;
        upsertStaticRow('Murojaatlar', {
          id: createdId,
          fullName: appealName.trim(),
          phone: appealPhone.trim(),
          topic: appealTopic,
          message: appealMessage.trim(),
          date: new Date().toISOString().slice(0, 10),
          status: 'Yangi',
        });
      }

      setAppealSuccess(
        tr(
          `Murojaatingiz qabul qilindi (${createdId}). Maktab ma’muriyati tez orada bog‘lanadi.`
        )
      );
      setAppealName('');
      setAppealPhone('');
      setAppealMessage('');
    } catch (err) {
      setAppealError(
        err instanceof Error ? err.message : tr('Xatolik yuz berdi')
      );
    } finally {
      setAppealSubmitting(false);
    }
  };

  const startIdx =
    filteredNews.length === 0 ? 0 : (safeNewsPage - 1) * NEWS_PAGE_SIZE + 1;
  const endIdx = Math.min(safeNewsPage * NEWS_PAGE_SIZE, filteredNews.length);

  return (
    <div
      className="min-h-screen transition-colors duration-300"
      style={{
        backgroundColor: theme.bgCanvas,
        color: theme.textPrimary,
      }}
    >
      {/* Top 3-Zone Institutional Header */}
      <header
        className="sticky top-0 z-40 border-b backdrop-blur-sm transition-colors duration-300"
        style={{
          backgroundColor: theme.isDark
            ? 'rgba(17, 24, 39, 0.94)'
            : 'rgba(255, 255, 255, 0.95)',
          borderColor: theme.borderSubtle,
        }}
      >
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-8 px-6 py-4">
          <a
            href="#top"
            className="inline-flex items-center gap-2.5 text-base font-bold tracking-tight whitespace-nowrap shrink-0"
            style={{ color: theme.isDark ? theme.textPrimary : theme.accent }}
          >
            <Landmark className="h-5 w-5 shrink-0" />
            <span>{tr('Qo‘shko‘pir Ixtisoslashtirilgan Maktab')}</span>
          </a>

          <nav
            aria-label="Asosiy navigatsiya"
            className="hidden lg:flex items-center gap-6 text-sm font-medium"
            style={{ color: theme.textSecondary }}
          >
            <a
              href="#yangiliklar"
              className="inline-flex items-center gap-1.5 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              <Newspaper className="h-3.5 w-3.5 opacity-75" />
              {tr('Yangiliklar')}
            </a>
            <a
              href="#yonalishlar"
              className="inline-flex items-center gap-1.5 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              <GraduationCap className="h-3.5 w-3.5 opacity-75" />
              {tr('Yo‘nalishlar')}
            </a>
            <a
              href="#rahbariyat"
              className="inline-flex items-center gap-1.5 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              <Users className="h-3.5 w-3.5 opacity-75" />
              {tr('Rahbariyat')}
            </a>
            <a
              href="#hujjatlar"
              className="inline-flex items-center gap-1.5 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              <FileText className="h-3.5 w-3.5 opacity-75" />
              {tr('Hujjatlar')}
            </a>
            <a
              href="#boglanish"
              className="inline-flex items-center gap-1.5 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              <Phone className="h-3.5 w-3.5 opacity-75" />
              {tr('Bog‘lanish')}
            </a>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onOpenAdmin}
              className="rounded-md px-4 py-2 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
              style={{ backgroundColor: theme.accent }}
            >
              {tr('Admin panel')}
            </button>
            <button
              type="button"
              onClick={() => setMobileNavOpen((prev) => !prev)}
              className="rounded-md border p-2 lg:hidden"
              style={{
                borderColor: theme.borderSubtle,
                color: theme.textPrimary,
              }}
              aria-label="Menyu"
            >
              {mobileNavOpen ? (
                <X className="h-4 w-4" />
              ) : (
                <Menu className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {mobileNavOpen && (
          <div
            className="w3-animate-top border-t px-6 py-4 lg:hidden"
            style={{
              backgroundColor: theme.bgSurface,
              borderColor: theme.borderSubtle,
              color: theme.textSecondary,
            }}
          >
            <div className="flex flex-col gap-3 text-sm font-medium">
              <a href="#yangiliklar" onClick={() => setMobileNavOpen(false)}>
                {tr('Yangiliklar')}
              </a>
              <a href="#yonalishlar" onClick={() => setMobileNavOpen(false)}>
                {tr('Yo‘nalishlar')}
              </a>
              <a href="#rahbariyat" onClick={() => setMobileNavOpen(false)}>
                {tr('Rahbariyat')}
              </a>
              <a href="#hujjatlar" onClick={() => setMobileNavOpen(false)}>
                {tr('Hujjatlar')}
              </a>
              <a href="#boglanish" onClick={() => setMobileNavOpen(false)}>
                {tr('Bog‘lanish')}
              </a>
            </div>
          </div>
        )}
      </header>

      {/* Operational Utility Ribbon (Ministry Info + Theme Picker + New Alphabet Toggle) */}
      <div
        className="border-b transition-colors duration-300"
        style={{
          backgroundColor: theme.ribbonBg,
          borderColor: theme.borderSubtle,
          color: theme.ribbonText,
        }}
      >
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 opacity-80" />
              {tr(
                settings.ministry_label ||
                  "Ixtisoslashtirilgan ta’lim muassasalari agentligi tizimi · Xorazm viloyati"
              )}
            </span>
            <span className="hidden items-center gap-1.5 font-mono-tabular opacity-85 sm:inline-flex">
              <Clock className="h-3.5 w-3.5" />
              {tr(settings.work_hours || 'Dushanba – Shanba, 08:00 – 17:00')}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Updated Alphabet Switcher (O‘, G‘, Sh, Ch <-> Ö, Ğ, Ş, Ç) */}
            <button
              type="button"
              onClick={onToggleAlphabet}
              title="Alifboni almashtirish (O‘·G‘·Sh·Ch / Ö·Ğ·Ş·Ç)"
              className="inline-flex items-center gap-1.5 rounded border border-white/25 bg-white/10 px-2.5 py-1 text-xs font-medium text-white hover:bg-white/20 transition-colors whitespace-nowrap"
            >
              <Languages className="h-3.5 w-3.5" />
              <span>
                {alphabetMode === 'updated'
                  ? 'Yangi alifbo: Ö · Ğ · Ş · Ç'
                  : 'Alifbo: Ö · Ğ · Ş · Ç'}
              </span>
            </button>

            {/* 6-Theme Switcher */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setThemeMenuOpen((prev) => !prev)}
                className="inline-flex items-center gap-1.5 rounded border border-white/25 bg-white/10 px-2.5 py-1 text-xs font-medium text-white hover:bg-white/20 transition-colors whitespace-nowrap"
              >
                <Palette className="h-3.5 w-3.5" />
                <span>{tr(theme.name)}</span>
              </button>

              {themeMenuOpen && (
                <div
                  className="w3-animate-top absolute right-0 z-50 mt-2 w-60 rounded-lg border p-2 shadow-xl"
                  style={{
                    backgroundColor: theme.bgSurface,
                    borderColor: theme.borderSubtle,
                    color: theme.textPrimary,
                  }}
                >
                  <p
                    className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider"
                    style={{ color: theme.textMuted }}
                  >
                    {tr('Sayt mavzusini tanlang')}
                  </p>
                  <div className="mt-1 space-y-1">
                    {PORTAL_THEMES.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          onChangeTheme(item.id);
                          setThemeMenuOpen(false);
                        }}
                        className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs font-medium transition-colors"
                        style={{
                          backgroundColor:
                            item.id === theme.id
                              ? theme.accentSoft
                              : 'transparent',
                          color:
                            item.id === theme.id
                              ? theme.isDark
                                ? '#93C5FD'
                                : theme.accent
                              : theme.textPrimary,
                        }}
                      >
                        <span className="flex items-center gap-2.5">
                          <span
                            className="h-3.5 w-3.5 rounded-sm border border-black/15"
                            style={{ backgroundColor: item.swatch }}
                          />
                          <span>{tr(item.name)}</span>
                        </span>
                        {item.id === theme.id && (
                          <Check className="h-3.5 w-3.5" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Drive / Sheets Connection Notice Banner (non-blocking) */}
      {!loading && !configured && (
        <div
          className="border-b"
          style={{
            backgroundColor: theme.isDark ? '#1E293B' : '#FFFBEB',
            borderColor: theme.isDark ? '#334155' : '#FDE68A',
            color: theme.isDark ? '#FDE68A' : '#78350F',
          }}
        >
          <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-3 px-6 py-2.5 text-xs">
            <span>
              {tr(
                'Hozircha Google Drive va Google Sheets ulanmagan — ma’lumotlar boshlang‘ich bazadan ko‘rsatilmoqda. Google Drive papka va Sheets bazasini ulash uchun Admin panelga kiring.'
              )}
            </span>
            <button
              type="button"
              onClick={onOpenAdmin}
              className="inline-flex items-center gap-1.5 rounded px-3 py-1 font-semibold text-white"
              style={{ backgroundColor: theme.accent }}
            >
              <Database className="h-3.5 w-3.5" />
              {tr('Drive va Sheets ulash')}
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main id="top">
        {loading && !dataset && (
          <section className="mx-auto max-w-[1280px] px-6 py-16">
            <div className="grid gap-8 lg:grid-cols-12">
              <div className="space-y-4 lg:col-span-7">
                <div className="h-4 w-48 animate-pulse rounded bg-slate-200" />
                <div className="h-12 w-full animate-pulse rounded bg-slate-200" />
                <div className="h-20 w-4/5 animate-pulse rounded bg-slate-200" />
              </div>
              <div className="h-80 animate-pulse rounded-lg bg-slate-200 lg:col-span-5" />
            </div>
          </section>
        )}

        {!loading && error && !dataset && (
          <section className="mx-auto max-w-[1280px] px-6 py-14">
            <div
              className="rounded-lg border p-8"
              style={{
                backgroundColor: theme.bgSurface,
                borderColor: theme.borderSubtle,
              }}
            >
              <h2 className="text-lg font-semibold text-red-600">
                {tr('Ma’lumotlarni yuklashda xatolik')}
              </h2>
              <p className="mt-2 text-sm" style={{ color: theme.textSecondary }}>
                {error}
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={onRefresh}
                  className="rounded-md px-4 py-2 text-sm font-medium text-white"
                  style={{ backgroundColor: theme.accent }}
                >
                  {tr('Qayta urinish')}
                </button>
                <button
                  type="button"
                  onClick={onOpenAdmin}
                  className="rounded-md border px-4 py-2 text-sm font-medium"
                  style={{ borderColor: theme.borderSubtle }}
                >
                  {tr('Admin panel')}
                </button>
              </div>
            </div>
          </section>
        )}

        {dataset && (
          <>
            {/* Hero Section */}
            <section
              className="border-b transition-colors duration-300"
              style={{
                backgroundColor: theme.bgSurface,
                borderColor: theme.borderSubtle,
              }}
            >
              <div className="mx-auto max-w-[1280px] px-6 py-12 lg:py-14">
                <div className="grid items-stretch gap-10 lg:grid-cols-12">
                  <div className="flex flex-col justify-between gap-6 lg:col-span-7">
                    <div className="space-y-4">
                      <p
                        className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest"
                        style={{
                          color: theme.isDark ? '#60A5FA' : theme.accent,
                        }}
                      >
                        <Landmark className="h-3.5 w-3.5" />
                        {tr('Rasmiy axborot portali · Qo‘shko‘pir tumani')}
                      </p>
                      <h1 className="font-serif-editorial text-3xl font-bold leading-[1.15] sm:text-4xl lg:text-[42px]">
                        {tr(settings.hero_title || schoolName)}
                      </h1>
                      <p
                        className="max-w-2xl text-base leading-relaxed"
                        style={{ color: theme.textSecondary }}
                      >
                        {tr(settings.hero_subtitle)}
                      </p>
                    </div>

                    {settings.director_quote && (
                      <blockquote
                        className="border-y py-4 font-serif-editorial text-base italic leading-relaxed"
                        style={{
                          borderColor: theme.borderSubtle,
                          color: theme.textSecondary,
                        }}
                      >
                        “{tr(settings.director_quote)}”
                      </blockquote>
                    )}

                    <div className="flex flex-wrap items-center gap-4">
                      <a
                        href="#yonalishlar"
                        className="inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold text-white transition-colors whitespace-nowrap"
                        style={{ backgroundColor: theme.accent }}
                      >
                        <GraduationCap className="h-4 w-4" />
                        {tr('Ta’lim yo‘nalishlari')}
                        <ArrowRight className="h-4 w-4" />
                      </a>
                      <a
                        href="#boglanish"
                        className="inline-flex items-center gap-2 rounded-md border px-5 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap"
                        style={{
                          borderColor: theme.borderSubtle,
                          backgroundColor: theme.bgSurfaceAlt,
                          color: theme.textPrimary,
                        }}
                      >
                        <MessageSquare className="h-4 w-4" />
                        {tr('Elektron murojaat')}
                      </a>
                      {config?.spreadsheetId && (
                        <a
                          href={`https://docs.google.com/spreadsheets/d/${config.spreadsheetId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-medium hover:underline"
                          style={{ color: theme.textMuted }}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          {tr('Sheets bazasi')}
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Hero Image with W3 Hover Zoom & Click-to-Modal */}
                  <div className="flex flex-col lg:col-span-5">
                    <button
                      type="button"
                      onClick={() =>
                        setCustomLightbox({
                          url: settings.hero_image_url || '',
                          title: schoolName,
                          subtitle: 'Bosh o‘quv binosi',
                        })
                      }
                      className="group relative h-72 w-full overflow-hidden rounded-lg border text-left lg:h-full lg:min-h-[340px]"
                      style={{
                        borderColor: theme.borderSubtle,
                        backgroundColor: theme.bgSurfaceAlt,
                      }}
                    >
                      <MediaImage
                        src={settings.hero_image_url}
                        alt={tr(schoolName)}
                        className="w3-img-hover h-full w-full object-cover"
                        fallbackTitle={tr(schoolName)}
                      />
                      <div className="pointer-events-none absolute inset-0 flex items-end justify-between bg-gradient-to-t from-black/60 via-transparent to-transparent p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                        <span className="text-xs font-medium text-white">
                          {tr('Kattalashtirib ko‘rish')}
                        </span>
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow">
                          <ZoomIn className="h-4 w-4" />
                        </span>
                      </div>
                    </button>
                    <p
                      className="mt-2 font-serif-editorial text-xs italic"
                      style={{ color: theme.textMuted }}
                    >
                      {tr(`1-rasm — ${schoolName} bosh o‘quv binosi`)}
                    </p>
                  </div>
                </div>

                {/* Quick Services Strip (gov.uz interactive tiles with icons) */}
                <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <a
                    href="#yonalishlar"
                    className="w3-card-elevate flex items-start gap-3.5 rounded-lg border p-4"
                    style={{
                      backgroundColor: theme.bgSurfaceAlt,
                      borderColor: theme.borderSubtle,
                    }}
                  >
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
                      style={{
                        backgroundColor: theme.accentSoft,
                        color: theme.isDark ? '#60A5FA' : theme.accent,
                      }}
                    >
                      <GraduationCap className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">
                        {tr('Qabul va yo‘nalishlar')}
                      </p>
                      <p
                        className="mt-0.5 text-xs"
                        style={{ color: theme.textMuted }}
                      >
                        {tr('Sinov fanlari va qabul kvotalari')}
                      </p>
                    </div>
                  </a>
                  <a
                    href="#hujjatlar"
                    className="w3-card-elevate flex items-start gap-3.5 rounded-lg border p-4"
                    style={{
                      backgroundColor: theme.bgSurfaceAlt,
                      borderColor: theme.borderSubtle,
                    }}
                  >
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
                      style={{
                        backgroundColor: theme.accentSoft,
                        color: theme.isDark ? '#60A5FA' : theme.accent,
                      }}
                    >
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">
                        {tr('Me’yoriy hujjatlar')}
                      </p>
                      <p
                        className="mt-0.5 text-xs"
                        style={{ color: theme.textMuted }}
                      >
                        {tr('Ustav, reglament va ochiq hisobotlar')}
                      </p>
                    </div>
                  </a>
                  <a
                    href="#rahbariyat"
                    className="w3-card-elevate flex items-start gap-3.5 rounded-lg border p-4"
                    style={{
                      backgroundColor: theme.bgSurfaceAlt,
                      borderColor: theme.borderSubtle,
                    }}
                  >
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
                      style={{
                        backgroundColor: theme.accentSoft,
                        color: theme.isDark ? '#60A5FA' : theme.accent,
                      }}
                    >
                      <UserCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">
                        {tr('Rahbariyat qabuli')}
                      </p>
                      <p
                        className="mt-0.5 text-xs"
                        style={{ color: theme.textMuted }}
                      >
                        {tr('Qabul kunlari va aloqa raqamlari')}
                      </p>
                    </div>
                  </a>
                  <a
                    href="#boglanish"
                    className="w3-card-elevate flex items-start gap-3.5 rounded-lg border p-4"
                    style={{
                      backgroundColor: theme.bgSurfaceAlt,
                      borderColor: theme.borderSubtle,
                    }}
                  >
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
                      style={{
                        backgroundColor: theme.accentSoft,
                        color: theme.isDark ? '#60A5FA' : theme.accent,
                      }}
                    >
                      <MessageSquare className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">
                        {tr('Elektron murojaat')}
                      </p>
                      <p
                        className="mt-0.5 text-xs"
                        style={{ color: theme.textMuted }}
                      >
                        {tr('Ota-onalar va fuqarolar murojaatxonasi')}
                      </p>
                    </div>
                  </a>
                </div>

                {/* 4-Column Full-Width Tabular Metrics Strip with Icons */}
                <div
                  className="mt-8 grid grid-cols-2 divide-y rounded-lg border sm:grid-cols-4 sm:divide-x sm:divide-y-0"
                  style={{
                    backgroundColor: theme.bgSurfaceAlt,
                    borderColor: theme.borderSubtle,
                  }}
                >
                  <div
                    className="px-6 py-5"
                    style={{ borderColor: theme.borderSubtle }}
                  >
                    <div
                      className="flex items-center gap-2 text-xs font-medium"
                      style={{ color: theme.textMuted }}
                    >
                      <Users className="h-4 w-4" />
                      <span>{tr('O‘quvchilar soni')}</span>
                    </div>
                    <p className="mt-2 font-mono-tabular text-2xl font-semibold lg:text-3xl">
                      {settings.students_count || '—'}
                    </p>
                  </div>
                  <div
                    className="px-6 py-5"
                    style={{ borderColor: theme.borderSubtle }}
                  >
                    <div
                      className="flex items-center gap-2 text-xs font-medium"
                      style={{ color: theme.textMuted }}
                    >
                      <UserCheck className="h-4 w-4" />
                      <span>{tr('Pedagoglar tarkibi')}</span>
                    </div>
                    <p className="mt-2 font-mono-tabular text-2xl font-semibold lg:text-3xl">
                      {settings.teachers_count || '—'}
                    </p>
                  </div>
                  <div
                    className="px-6 py-5"
                    style={{ borderColor: theme.borderSubtle }}
                  >
                    <div
                      className="flex items-center gap-2 text-xs font-medium"
                      style={{ color: theme.textMuted }}
                    >
                      <Award className="h-4 w-4" />
                      <span>{tr('Olimpiada g‘oliblari')}</span>
                    </div>
                    <p className="mt-2 font-mono-tabular text-2xl font-semibold lg:text-3xl">
                      {settings.olympiad_winners || '—'}
                    </p>
                  </div>
                  <div
                    className="px-6 py-5"
                    style={{ borderColor: theme.borderSubtle }}
                  >
                    <div
                      className="flex items-center gap-2 text-xs font-medium"
                      style={{ color: theme.textMuted }}
                    >
                      <TrendingUp className="h-4 w-4" />
                      <span>{tr('OTMga kirish ko‘rsatkichi')}</span>
                    </div>
                    <p
                      className="mt-2 font-mono-tabular text-2xl font-semibold lg:text-3xl"
                      style={{ color: theme.isDark ? '#60A5FA' : theme.accent }}
                    >
                      {settings.university_rate || '—'}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Yangiliklar va E'lonlar (10-per-page Pagination + Hover Animations) */}
            <section id="yangiliklar" className="mx-auto max-w-[1280px] px-6 py-14">
              <div
                className="flex flex-col justify-between gap-4 border-b pb-6 md:flex-row md:items-end"
                style={{ borderColor: theme.borderSubtle }}
              >
                <div>
                  <p
                    className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest"
                    style={{ color: theme.isDark ? '#60A5FA' : theme.accent }}
                  >
                    <Newspaper className="h-3.5 w-3.5" />
                    {tr('Matbuot xizmati')}
                  </p>
                  <h2 className="mt-1 font-serif-editorial text-2xl font-bold lg:text-3xl">
                    {tr('Yangiliklar va e’lonlar')}
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                      style={{ color: theme.textMuted }}
                    />
                    <input
                      type="search"
                      value={newsSearch}
                      onChange={(e) => setNewsSearch(e.target.value)}
                      placeholder={tr('Yangilik qidirish...')}
                      className="w-56 rounded-md border py-2 pl-9 pr-3 text-sm focus:outline-none"
                      style={{
                        backgroundColor: theme.bgSurface,
                        borderColor: theme.borderSubtle,
                        color: theme.textPrimary,
                      }}
                    />
                  </div>
                  <div
                    className="flex flex-wrap items-center gap-1 rounded-md p-1"
                    style={{ backgroundColor: theme.bgSurfaceAlt }}
                  >
                    {newsCategories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setNewsCategory(cat)}
                        className="rounded px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
                        style={{
                          backgroundColor:
                            newsCategory === cat
                              ? theme.bgSurface
                              : 'transparent',
                          color:
                            newsCategory === cat
                              ? theme.textPrimary
                              : theme.textMuted,
                        }}
                      >
                        {tr(cat)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {filteredNews.length === 0 ? (
                <div
                  className="mt-8 rounded-lg border p-10 text-center"
                  style={{
                    backgroundColor: theme.bgSurface,
                    borderColor: theme.borderSubtle,
                  }}
                >
                  <p className="text-sm" style={{ color: theme.textSecondary }}>
                    {tr(
                      'Yangiliklar topilmadi. Admin panel orqali yangi ma’lumot qo‘shishingiz mumkin.'
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={onOpenAdmin}
                    className="mt-4 rounded-md px-4 py-2 text-xs font-semibold text-white"
                    style={{ backgroundColor: theme.accent }}
                  >
                    {tr('Admin paneldan qo‘shish')}
                  </button>
                </div>
              ) : (
                <div className="mt-8 space-y-10">
                  {leadStory && (
                    <article
                      onClick={() => setActiveArticle(leadStory)}
                      className="w3-card-elevate group grid cursor-pointer items-stretch overflow-hidden rounded-lg border lg:grid-cols-12"
                      style={{
                        backgroundColor: theme.bgSurface,
                        borderColor: theme.borderSubtle,
                      }}
                    >
                      <div
                        className="relative h-64 overflow-hidden lg:col-span-6 lg:h-auto lg:min-h-[300px]"
                        style={{ backgroundColor: theme.bgSurfaceAlt }}
                      >
                        <MediaImage
                          src={leadStory.imageUrl}
                          alt={tr(leadStory.title)}
                          className="w3-img-hover h-full w-full object-cover"
                          fallbackTitle={tr(leadStory.title)}
                        />
                        <span className="pointer-events-none absolute right-3 bottom-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                          <ZoomIn className="h-4 w-4" />
                        </span>
                      </div>
                      <div className="flex flex-col justify-between p-6 lg:col-span-6 lg:p-8">
                        <div>
                          <div
                            className="flex items-center gap-2 text-xs"
                            style={{ color: theme.textMuted }}
                          >
                            <span
                              className="font-semibold"
                              style={{
                                color: theme.isDark ? '#60A5FA' : theme.accent,
                              }}
                            >
                              {tr(leadStory.category)}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1 font-mono-tabular">
                              <Calendar className="h-3 w-3" />
                              {leadStory.date}
                            </span>
                          </div>
                          <h3 className="mt-3 font-serif-editorial text-2xl font-bold leading-snug">
                            {tr(leadStory.title)}
                          </h3>
                          <p
                            className="mt-3 text-sm leading-relaxed line-clamp-4"
                            style={{ color: theme.textSecondary }}
                          >
                            {tr(leadStory.summary)}
                          </p>
                        </div>
                        <div
                          className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold"
                          style={{
                            color: theme.isDark ? '#60A5FA' : theme.accent,
                          }}
                        >
                          {tr('Batafsil o‘qish')}
                          <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                        </div>
                      </div>
                    </article>
                  )}

                  {secondaryStories.length > 0 && (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                      {secondaryStories.map((item) => (
                        <article
                          key={item.id}
                          onClick={() => setActiveArticle(item)}
                          className="w3-card-elevate group flex cursor-pointer flex-col overflow-hidden rounded-lg border"
                          style={{
                            backgroundColor: theme.bgSurface,
                            borderColor: theme.borderSubtle,
                          }}
                        >
                          <div
                            className="relative aspect-[4/3] w-full overflow-hidden"
                            style={{ backgroundColor: theme.bgSurfaceAlt }}
                          >
                            <MediaImage
                              src={item.imageUrl}
                              alt={tr(item.title)}
                              className="w3-img-hover h-full w-full object-cover"
                              fallbackTitle={tr(item.title)}
                            />
                            <span className="pointer-events-none absolute right-3 bottom-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                              <ZoomIn className="h-4 w-4" />
                            </span>
                          </div>
                          <div className="flex flex-1 flex-col justify-between p-5">
                            <div>
                              <div
                                className="flex items-center gap-2 text-xs"
                                style={{ color: theme.textMuted }}
                              >
                                <span
                                  className="font-semibold"
                                  style={{
                                    color: theme.isDark
                                      ? '#60A5FA'
                                      : theme.accent,
                                  }}
                                >
                                  {tr(item.category)}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span className="inline-flex items-center gap-1 font-mono-tabular">
                                  <Calendar className="h-3 w-3" />
                                  {item.date}
                                </span>
                              </div>
                              <h3 className="mt-2.5 text-base font-semibold leading-snug">
                                {tr(item.title)}
                              </h3>
                              <p
                                className="mt-2 text-sm leading-relaxed line-clamp-3"
                                style={{ color: theme.textSecondary }}
                              >
                                {tr(item.summary)}
                              </p>
                            </div>
                            <div
                              className="mt-4 inline-flex items-center gap-1 text-xs font-semibold"
                              style={{
                                color: theme.isDark ? '#60A5FA' : theme.accent,
                              }}
                            >
                              {tr('O‘qish')}
                              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}

                  {/* 10-per-page Pagination Controls */}
                  <div
                    className="flex flex-wrap items-center justify-between gap-4 border-t pt-6"
                    style={{ borderColor: theme.borderSubtle }}
                  >
                    <p
                      className="font-mono-tabular text-xs"
                      style={{ color: theme.textMuted }}
                    >
                      {tr(
                        `Ko‘rsatilmoqda: ${startIdx}–${endIdx} / ${filteredNews.length} ta yangilik (sahifada 10 tadan)`
                      )}
                    </p>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={safeNewsPage <= 1}
                        onClick={() => handleNewsPageChange(safeNewsPage - 1)}
                        className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium disabled:opacity-40"
                        style={{
                          backgroundColor: theme.bgSurface,
                          borderColor: theme.borderSubtle,
                          color: theme.textPrimary,
                        }}
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        {tr('Oldingi')}
                      </button>

                      {Array.from(
                        { length: totalNewsPages },
                        (_, idx) => idx + 1
                      ).map((pageNum) => (
                        <button
                          key={pageNum}
                          type="button"
                          onClick={() => handleNewsPageChange(pageNum)}
                          className="h-8 min-w-[32px] rounded-md border px-2 font-mono-tabular text-xs font-semibold transition-colors"
                          style={{
                            backgroundColor:
                              pageNum === safeNewsPage
                                ? theme.accent
                                : theme.bgSurface,
                            borderColor:
                              pageNum === safeNewsPage
                                ? theme.accent
                                : theme.borderSubtle,
                            color:
                              pageNum === safeNewsPage
                                ? '#FFFFFF'
                                : theme.textPrimary,
                          }}
                        >
                          {pageNum}
                        </button>
                      ))}

                      <button
                        type="button"
                        disabled={safeNewsPage >= totalNewsPages}
                        onClick={() => handleNewsPageChange(safeNewsPage + 1)}
                        className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium disabled:opacity-40"
                        style={{
                          backgroundColor: theme.bgSurface,
                          borderColor: theme.borderSubtle,
                          color: theme.textPrimary,
                        }}
                      >
                        {tr('Keyingi')}
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Ta'lim Yo'nalishlari */}
            <section
              id="yonalishlar"
              className="border-y py-14 transition-colors duration-300"
              style={{
                backgroundColor: theme.bgSurface,
                borderColor: theme.borderSubtle,
              }}
            >
              <div className="mx-auto max-w-[1280px] px-6">
                <div className="max-w-2xl">
                  <p
                    className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest"
                    style={{ color: theme.isDark ? '#60A5FA' : theme.accent }}
                  >
                    <GraduationCap className="h-3.5 w-3.5" />
                    {tr('O‘quv dasturlari va qabul kvotalari')}
                  </p>
                  <h2 className="mt-1 font-serif-editorial text-2xl font-bold lg:text-3xl">
                    {tr('Ixtisoslashtirilgan ta’lim yo‘nalishlari')}
                  </h2>
                </div>

                {(dataset.programs || []).length === 0 ? (
                  <div
                    className="mt-8 rounded-lg border p-8 text-center text-sm"
                    style={{
                      backgroundColor: theme.bgSurfaceAlt,
                      borderColor: theme.borderSubtle,
                      color: theme.textMuted,
                    }}
                  >
                    {tr(
                      'Yo‘nalishlar ro‘yxati bo‘sh. Admin paneldan yo‘nalish qo‘shing.'
                    )}
                  </div>
                ) : (
                  <div className="mt-8 grid gap-6 md:grid-cols-2">
                    {dataset.programs.map((prog) => (
                      <div
                        key={prog.id}
                        className="w3-card-elevate flex flex-col justify-between rounded-lg border p-6"
                        style={{
                          backgroundColor: theme.bgSurfaceAlt,
                          borderColor: theme.borderSubtle,
                        }}
                      >
                        <div>
                          <div
                            className="flex items-center justify-between gap-4 border-b pb-3 text-xs"
                            style={{
                              borderColor: theme.borderSubtle,
                              color: theme.textMuted,
                            }}
                          >
                            <span
                              className="font-mono-tabular font-semibold"
                              style={{
                                color: theme.isDark ? '#60A5FA' : theme.accent,
                              }}
                            >
                              {prog.code} · {tr(prog.gradeRange)}
                            </span>
                            <span className="font-mono-tabular font-medium">
                              {tr(`Kvota: ${prog.quota}`)}
                            </span>
                          </div>
                          <h3 className="mt-4 text-lg font-semibold">
                            {tr(prog.title)}
                          </h3>
                          <p
                            className="mt-2 text-sm leading-relaxed"
                            style={{ color: theme.textSecondary }}
                          >
                            {tr(prog.description)}
                          </p>
                        </div>
                        <div
                          className="mt-5 flex items-center gap-2 border-t pt-3 text-xs"
                          style={{
                            borderColor: theme.borderSubtle,
                            color: theme.textSecondary,
                          }}
                        >
                          <BookOpen
                            className="h-4 w-4 shrink-0"
                            style={{
                              color: theme.isDark ? '#60A5FA' : theme.accent,
                            }}
                          />
                          <span>
                            {tr(`Chuqurlashtirilgan fanlar: ${prog.subjects}`)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Rahbariyat */}
            <section id="rahbariyat" className="mx-auto max-w-[1280px] px-6 py-14">
              <div>
                <p
                  className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest"
                  style={{ color: theme.isDark ? '#60A5FA' : theme.accent }}
                >
                  <Users className="h-3.5 w-3.5" />
                  {tr('Tashkilot tuzilmasi')}
                </p>
                <h2 className="mt-1 font-serif-editorial text-2xl font-bold lg:text-3xl">
                  {tr('Maktab rahbariyati')}
                </h2>
              </div>

              {sortedLeadership.length === 0 ? (
                <div
                  className="mt-8 rounded-lg border p-8 text-center text-sm"
                  style={{
                    backgroundColor: theme.bgSurface,
                    borderColor: theme.borderSubtle,
                    color: theme.textMuted,
                  }}
                >
                  {tr('Rahbariyat tarkibi bo‘sh. Admin paneldan qo‘shing.')}
                </div>
              ) : (
                <div className="mt-8 grid gap-6 md:grid-cols-3">
                  {sortedLeadership.map((member) => (
                    <div
                      key={member.id}
                      className="w3-card-elevate group flex flex-col overflow-hidden rounded-lg border"
                      style={{
                        backgroundColor: theme.bgSurface,
                        borderColor: theme.borderSubtle,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setCustomLightbox({
                            url: member.imageUrl,
                            title: member.fullName,
                            subtitle: member.role,
                          })
                        }
                        className="relative aspect-[4/3] w-full overflow-hidden text-left"
                        style={{ backgroundColor: theme.bgSurfaceAlt }}
                      >
                        <MediaImage
                          src={member.imageUrl}
                          alt={tr(member.fullName)}
                          className="w3-img-hover h-full w-full object-cover object-top"
                          fallbackTitle={tr(member.fullName)}
                        />
                        <span className="pointer-events-none absolute right-3 bottom-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                          <ZoomIn className="h-4 w-4" />
                        </span>
                      </button>
                      <div className="flex flex-1 flex-col justify-between p-5">
                        <div>
                          <p
                            className="text-xs font-medium"
                            style={{
                              color: theme.isDark ? '#60A5FA' : theme.accent,
                            }}
                          >
                            {tr(member.role)}
                          </p>
                          <h3 className="mt-1 text-base font-semibold">
                            {tr(member.fullName)}
                          </h3>
                          <p
                            className="mt-2.5 text-sm leading-relaxed"
                            style={{ color: theme.textSecondary }}
                          >
                            {tr(member.bio)}
                          </p>
                        </div>
                        <dl
                          className="mt-5 space-y-1.5 border-t pt-3 text-xs"
                          style={{
                            borderColor: theme.borderSubtle,
                            color: theme.textSecondary,
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <Calendar
                              className="h-3.5 w-3.5 shrink-0"
                              style={{ color: theme.textMuted }}
                            />
                            <span>
                              {tr(`Qabul: ${member.receptionHours}`)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 font-mono-tabular">
                            <Phone
                              className="h-3.5 w-3.5 shrink-0"
                              style={{ color: theme.textMuted }}
                            />
                            <span>{member.phone}</span>
                          </div>
                          {member.email && (
                            <div className="flex items-center gap-2">
                              <Mail
                                className="h-3.5 w-3.5 shrink-0"
                                style={{ color: theme.textMuted }}
                              />
                              <span>{member.email}</span>
                            </div>
                          )}
                        </dl>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Me'yoriy Hujjatlar */}
            <section
              id="hujjatlar"
              className="border-y py-14 transition-colors duration-300"
              style={{
                backgroundColor: theme.bgSurface,
                borderColor: theme.borderSubtle,
              }}
            >
              <div className="mx-auto max-w-[1280px] px-6">
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                  <div>
                    <p
                      className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest"
                      style={{ color: theme.isDark ? '#60A5FA' : theme.accent }}
                    >
                      <FileText className="h-3.5 w-3.5" />
                      {tr('Ochiq ma’lumotlar reestri')}
                    </p>
                    <h2 className="mt-1 font-serif-editorial text-2xl font-bold lg:text-3xl">
                      {tr('Me’yoriy hujjatlar va qabul tartibi')}
                    </h2>
                  </div>

                  <div
                    className="flex flex-wrap items-center gap-1 rounded-md p-1"
                    style={{ backgroundColor: theme.bgSurfaceAlt }}
                  >
                    {docCategories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setDocCategory(cat)}
                        className="rounded px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
                        style={{
                          backgroundColor:
                            docCategory === cat
                              ? theme.bgSurface
                              : 'transparent',
                          color:
                            docCategory === cat
                              ? theme.textPrimary
                              : theme.textMuted,
                        }}
                      >
                        {tr(cat)}
                      </button>
                    ))}
                  </div>
                </div>

                <div
                  className="mt-8 overflow-x-auto rounded-lg border"
                  style={{ borderColor: theme.borderSubtle }}
                >
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr
                        className="border-b text-xs font-semibold"
                        style={{
                          backgroundColor: theme.bgSurfaceAlt,
                          borderColor: theme.borderSubtle,
                          color: theme.textSecondary,
                        }}
                      >
                        <th className="px-4 py-3">{tr('Raqam')}</th>
                        <th className="px-4 py-3">{tr('Hujjat nomi')}</th>
                        <th className="px-4 py-3">{tr('Bo‘lim')}</th>
                        <th className="px-4 py-3">{tr('Sana')}</th>
                        <th className="px-4 py-3 text-right">{tr('Fayl')}</th>
                      </tr>
                    </thead>
                    <tbody
                      className="divide-y"
                      style={{
                        backgroundColor: theme.bgSurface,
                        borderColor: theme.borderSubtle,
                      }}
                    >
                      {filteredDocuments.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-4 py-8 text-center text-sm"
                            style={{ color: theme.textMuted }}
                          >
                            {tr('Hujjatlar topilmadi.')}
                          </td>
                        </tr>
                      ) : (
                        filteredDocuments.map((doc) => (
                          <tr key={doc.id}>
                            <td className="px-4 py-3.5 font-mono-tabular text-xs font-medium whitespace-nowrap">
                              {doc.docNumber}
                            </td>
                            <td className="px-4 py-3.5">
                              <p className="font-medium">{tr(doc.title)}</p>
                              {doc.summary && (
                                <p
                                  className="mt-0.5 text-xs"
                                  style={{ color: theme.textMuted }}
                                >
                                  {tr(doc.summary)}
                                </p>
                              )}
                            </td>
                            <td
                              className="px-4 py-3.5 text-xs whitespace-nowrap"
                              style={{ color: theme.textSecondary }}
                            >
                              {tr(doc.category)}
                            </td>
                            <td
                              className="px-4 py-3.5 font-mono-tabular text-xs whitespace-nowrap"
                              style={{ color: theme.textSecondary }}
                            >
                              {doc.date}
                            </td>
                            <td className="px-4 py-3.5 text-right whitespace-nowrap">
                              {doc.fileUrl ? (
                                <a
                                  href={doc.fileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1.5 text-xs font-semibold hover:underline"
                                  style={{
                                    color: theme.isDark
                                      ? '#60A5FA'
                                      : theme.accent,
                                  }}
                                >
                                  <FileText className="h-3.5 w-3.5" />
                                  {tr('Ochish')}
                                </a>
                              ) : (
                                <span
                                  className="text-xs"
                                  style={{ color: theme.textMuted }}
                                >
                                  {tr('Reestrda')}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {/* Media Galereya (W3 Hover Zoom + Lightbox Slider) */}
            {mediaList.length > 0 && (
              <section className="mx-auto max-w-[1280px] px-6 py-14">
                <div>
                  <p
                    className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest"
                    style={{ color: theme.isDark ? '#60A5FA' : theme.accent }}
                  >
                    <Images className="h-3.5 w-3.5" />
                    {tr('Media Arxiv')}
                  </p>
                  <h2 className="mt-1 font-serif-editorial text-2xl font-bold lg:text-3xl">
                    {tr('Maktab hayotidan fotolavhalar')}
                  </h2>
                </div>

                <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                  {mediaList.map((item, idx) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setLightboxIndex(idx)}
                      className="w3-card-elevate group flex flex-col overflow-hidden rounded-lg border text-left"
                      style={{
                        backgroundColor: theme.bgSurface,
                        borderColor: theme.borderSubtle,
                      }}
                    >
                      <div
                        className="relative aspect-[4/3] w-full overflow-hidden"
                        style={{ backgroundColor: theme.bgSurfaceAlt }}
                      >
                        <MediaImage
                          src={item.url}
                          alt={tr(item.title)}
                          className="w3-img-hover h-full w-full object-cover"
                          fallbackTitle={tr(item.title)}
                        />
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-slate-900 shadow-lg transition-transform duration-300 group-hover:scale-110">
                            <ZoomIn className="h-5 w-5" />
                          </span>
                        </div>
                      </div>
                      <div className="p-3.5">
                        <p
                          className="text-xs"
                          style={{ color: theme.textMuted }}
                        >
                          {tr(item.category)} ·{' '}
                          <span className="font-mono-tabular">
                            {item.createdAt}
                          </span>
                        </p>
                        <p className="mt-1 text-sm font-medium line-clamp-1">
                          {tr(item.title)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Bog'lanish va Elektron Murojaat */}
            <section
              id="boglanish"
              className="border-t py-14 transition-colors duration-300"
              style={{
                backgroundColor: theme.bgSurface,
                borderColor: theme.borderSubtle,
              }}
            >
              <div className="mx-auto max-w-[1280px] px-6">
                <div className="grid gap-10 lg:grid-cols-12">
                  <div className="space-y-6 lg:col-span-5">
                    <div>
                      <p
                        className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest"
                        style={{ color: theme.isDark ? '#60A5FA' : theme.accent }}
                      >
                        <Phone className="h-3.5 w-3.5" />
                        {tr('Qayta aloqa va qabulxona')}
                      </p>
                      <h2 className="mt-1 font-serif-editorial text-2xl font-bold lg:text-3xl">
                        {tr('Maktab bilan bog‘lanish')}
                      </h2>
                      <p
                        className="mt-2 text-sm leading-relaxed"
                        style={{ color: theme.textSecondary }}
                      >
                        {tr(
                          'Ota-onalar, o‘quvchilar va fuqarolarning savol hamda takliflari elektron tarzda qabul qilinadi.'
                        )}
                      </p>
                    </div>

                    <dl
                      className="divide-y border-y text-sm"
                      style={{ borderColor: theme.borderSubtle }}
                    >
                      <div className="flex items-start gap-3 py-3.5">
                        <MapPin
                          className="mt-0.5 h-4 w-4 shrink-0"
                          style={{
                            color: theme.isDark ? '#60A5FA' : theme.accent,
                          }}
                        />
                        <div>
                          <dt
                            className="text-xs"
                            style={{ color: theme.textMuted }}
                          >
                            {tr('Manzil')}
                          </dt>
                          <dd className="font-medium">
                            {tr(settings.address)}
                          </dd>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 py-3.5">
                        <Phone
                          className="mt-0.5 h-4 w-4 shrink-0"
                          style={{
                            color: theme.isDark ? '#60A5FA' : theme.accent,
                          }}
                        />
                        <div>
                          <dt
                            className="text-xs"
                            style={{ color: theme.textMuted }}
                          >
                            {tr('Ishonch telefoni')}
                          </dt>
                          <dd className="font-mono-tabular font-medium">
                            {settings.phone}
                          </dd>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 py-3.5">
                        <Mail
                          className="mt-0.5 h-4 w-4 shrink-0"
                          style={{
                            color: theme.isDark ? '#60A5FA' : theme.accent,
                          }}
                        />
                        <div>
                          <dt
                            className="text-xs"
                            style={{ color: theme.textMuted }}
                          >
                            {tr('Elektron pochta')}
                          </dt>
                          <dd className="font-medium">{settings.email}</dd>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 py-3.5">
                        <UserCheck
                          className="mt-0.5 h-4 w-4 shrink-0"
                          style={{
                            color: theme.isDark ? '#60A5FA' : theme.accent,
                          }}
                        />
                        <div>
                          <dt
                            className="text-xs"
                            style={{ color: theme.textMuted }}
                          >
                            {tr('Ish vaqti')}
                          </dt>
                          <dd className="font-medium">
                            {tr(settings.work_hours)}
                          </dd>
                        </div>
                      </div>
                    </dl>
                  </div>

                  <div
                    className="rounded-lg border p-6 lg:col-span-7 lg:p-8"
                    style={{
                      backgroundColor: theme.bgSurfaceAlt,
                      borderColor: theme.borderSubtle,
                    }}
                  >
                    <h3 className="text-lg font-semibold">
                      {tr('Elektron murojaat yuborish')}
                    </h3>
                    <form onSubmit={handleSubmitAppeal} className="mt-5 space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label
                            className="block text-xs font-medium"
                            style={{ color: theme.textSecondary }}
                          >
                            {tr('F.I.Sh. *')}
                          </label>
                          <input
                            type="text"
                            required
                            value={appealName}
                            onChange={(e) => setAppealName(e.target.value)}
                            placeholder={tr('Masalan: Karimov Sardor')}
                            className="mt-1.5 w-full rounded-md border px-3.5 py-2.5 text-sm focus:outline-none"
                            style={{
                              backgroundColor: theme.bgSurface,
                              borderColor: theme.borderSubtle,
                              color: theme.textPrimary,
                            }}
                          />
                        </div>
                        <div>
                          <label
                            className="block text-xs font-medium"
                            style={{ color: theme.textSecondary }}
                          >
                            {tr('Telefon raqami *')}
                          </label>
                          <input
                            type="tel"
                            required
                            value={appealPhone}
                            onChange={(e) => setAppealPhone(e.target.value)}
                            placeholder="+998 90 123-45-67"
                            className="mt-1.5 w-full rounded-md border px-3.5 py-2.5 text-sm focus:outline-none"
                            style={{
                              backgroundColor: theme.bgSurface,
                              borderColor: theme.borderSubtle,
                              color: theme.textPrimary,
                            }}
                          />
                        </div>
                      </div>

                      <div>
                        <label
                          className="block text-xs font-medium"
                          style={{ color: theme.textSecondary }}
                        >
                          {tr('Murojaat mavzusi')}
                        </label>
                        <select
                          value={appealTopic}
                          onChange={(e) => setAppealTopic(e.target.value)}
                          className="mt-1.5 w-full rounded-md border px-3.5 py-2.5 text-sm focus:outline-none"
                          style={{
                            backgroundColor: theme.bgSurface,
                            borderColor: theme.borderSubtle,
                            color: theme.textPrimary,
                          }}
                        >
                          <option value="Qabul 2026 masalasi">
                            {tr('Qabul 2026 masalasi')}
                          </option>
                          <option value="O‘quv jarayoni va dasturlar">
                            {tr('O‘quv jarayoni va dasturlar')}
                          </option>
                          <option value="Direktor qabuliga yozilish">
                            {tr('Direktor qabuliga yozilish')}
                          </option>
                          <option value="Taklif va mulohazalar">
                            {tr('Taklif va mulohazalar')}
                          </option>
                        </select>
                      </div>

                      <div>
                        <label
                          className="block text-xs font-medium"
                          style={{ color: theme.textSecondary }}
                        >
                          {tr('Murojaat matni *')}
                        </label>
                        <textarea
                          rows={4}
                          required
                          value={appealMessage}
                          onChange={(e) => setAppealMessage(e.target.value)}
                          placeholder={tr(
                            'Savolingiz yoki taklifingizni batafsil yozing...'
                          )}
                          className="mt-1.5 w-full rounded-md border px-3.5 py-2.5 text-sm focus:outline-none"
                          style={{
                            backgroundColor: theme.bgSurface,
                            borderColor: theme.borderSubtle,
                            color: theme.textPrimary,
                          }}
                        />
                      </div>

                      {appealSuccess && (
                        <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>{appealSuccess}</span>
                        </div>
                      )}
                      {appealError && (
                        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                          {appealError}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={appealSubmitting}
                        className="inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                        style={{ backgroundColor: theme.accent }}
                      >
                        <Send className="h-4 w-4" />
                        {appealSubmitting
                          ? tr('Yuborilmoqda...')
                          : tr('Murojaatni yuborish')}
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      {/* Institutional Footer */}
      <footer
        className="transition-colors duration-300"
        style={{
          backgroundColor: theme.footerBg,
          color: theme.footerText,
        }}
      >
        <div className="mx-auto flex max-w-[1280px] flex-col justify-between gap-6 px-6 py-10 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-semibold text-white">
              {tr(schoolName)}
            </p>
            <p className="mt-1 text-xs opacity-75">
              {tr(settings.address || "Xorazm viloyati, Qo'shko'pir tumani")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-xs opacity-80">
            <a href="#yangiliklar" className="hover:text-white">
              {tr('Yangiliklar')}
            </a>
            <a href="#yonalishlar" className="hover:text-white">
              {tr('Yo‘nalishlar')}
            </a>
            <a href="#hujjatlar" className="hover:text-white">
              {tr('Hujjatlar')}
            </a>
            <button
              type="button"
              onClick={onOpenAdmin}
              className="font-medium text-white hover:underline"
            >
              {tr('Admin boshqaruv')}
            </button>
          </div>
        </div>
      </footer>

      {/* Article Reader Modal (with W3 Zoom & Fade Animation) */}
      {activeArticle && (
        <div
          className="w3-animate-opacity fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          onClick={() => setActiveArticle(null)}
        >
          <div
            className="w3-animate-zoom max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg border shadow-2xl"
            style={{
              backgroundColor: theme.bgSurface,
              borderColor: theme.borderSubtle,
              color: theme.textPrimary,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="sticky top-0 z-10 flex items-center justify-between border-b px-6 py-4"
              style={{
                backgroundColor: theme.bgSurface,
                borderColor: theme.borderSubtle,
              }}
            >
              <div
                className="flex items-center gap-2 text-xs"
                style={{ color: theme.textMuted }}
              >
                <span
                  className="font-semibold"
                  style={{ color: theme.isDark ? '#60A5FA' : theme.accent }}
                >
                  {tr(activeArticle.category)}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-tabular">{activeArticle.date}</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveArticle(null)}
                className="rounded-md p-1.5 hover:bg-black/5"
                aria-label="Yopish"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 lg:p-8">
              <h2 className="font-serif-editorial text-2xl font-bold leading-snug lg:text-3xl">
                {tr(activeArticle.title)}
              </h2>
              {activeArticle.imageUrl && (
                <div
                  className="mt-6 aspect-[16/9] w-full overflow-hidden rounded-lg border"
                  style={{
                    borderColor: theme.borderSubtle,
                    backgroundColor: theme.bgSurfaceAlt,
                  }}
                >
                  <MediaImage
                    src={activeArticle.imageUrl}
                    alt={tr(activeArticle.title)}
                  />
                </div>
              )}
              <div
                className="mx-auto mt-6 max-w-prose space-y-4 font-serif-editorial text-base leading-[1.8]"
                style={{ color: theme.textSecondary }}
              >
                {(activeArticle.content || activeArticle.summary)
                  .split('\n\n')
                  .map((para, i) => (
                    <p key={i}>{tr(para)}</p>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Gallery Image Lightbox Modal (W3 Zoom + Prev/Next Slider) */}
      {(activeLightboxMedia || customLightbox) && (
        <div
          className="w3-animate-opacity fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-[2px]"
          onClick={() => {
            setLightboxIndex(null);
            setCustomLightbox(null);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w3-animate-zoom w-full max-w-4xl overflow-hidden rounded-lg border shadow-2xl"
            style={{
              backgroundColor: theme.bgSurface,
              borderColor: theme.borderSubtle,
              color: theme.textPrimary,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between border-b px-5 py-3.5"
              style={{ borderColor: theme.borderSubtle }}
            >
              <div>
                <p className="text-sm font-semibold">
                  {tr(
                    activeLightboxMedia?.title || customLightbox?.title || ''
                  )}
                </p>
                <p className="text-xs" style={{ color: theme.textMuted }}>
                  {activeLightboxMedia
                    ? `${tr(activeLightboxMedia.category)} · ${
                        activeLightboxMedia.createdAt
                      }`
                    : tr(customLightbox?.subtitle || '')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setLightboxIndex(null);
                  setCustomLightbox(null);
                }}
                className="rounded p-1.5 hover:bg-black/5"
                aria-label="Yopish"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="relative flex max-h-[75vh] min-h-[300px] items-center justify-center overflow-hidden bg-slate-950">
              <MediaImage
                src={activeLightboxMedia?.url || customLightbox?.url}
                alt={tr(
                  activeLightboxMedia?.title || customLightbox?.title || ''
                )}
                className="mx-auto max-h-[75vh] w-auto object-contain"
              />

              {activeLightboxMedia && mediaList.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setLightboxIndex((prev) =>
                        prev === null
                          ? 0
                          : (prev - 1 + mediaList.length) % mediaList.length
                      )
                    }
                    className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2.5 text-white hover:bg-black/80"
                    aria-label="Oldingi rasm"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setLightboxIndex((prev) =>
                        prev === null ? 0 : (prev + 1) % mediaList.length
                      )
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2.5 text-white hover:bg-black/80"
                    aria-label="Keyingi rasm"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
