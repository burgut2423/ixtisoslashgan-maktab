import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
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
  FileText,
  GraduationCap,
  Images,
  Landmark,
  Languages,
  Mail,
  MapPin,
  Maximize2,
  Menu,
  MessageSquare,
  Minimize2,
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
  NewsItem,
  SiteConfig,
  SiteDataset,
} from '../types/cms';
import { MediaImage } from './MediaImage';
import { AnimatedCounter, RevealOnScroll } from './AnimatedCounter';
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
import { getPrimaryMediaUrl, parseMediaUrls } from '../utils/mediaHelpers';

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
  const [customLightbox, setCustomLightbox] = useState<{
    url: string;
    title: string;
    subtitle?: string;
    isPortrait?: boolean;
  } | null>(null);
  const [articleLightbox, setArticleLightbox] = useState<{
    images: string[];
    index: number;
    title: string;
    subtitle?: string;
  } | null>(null);
  const [lightboxFitMode, setLightboxFitMode] = useState<'fill' | 'fit'>('fill');
  const [scrollProgress, setScrollProgress] = useState(0);

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

  // Keyboard navigation for modals
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (articleLightbox) {
          setArticleLightbox(null);
          return;
        }
        if (customLightbox) {
          setCustomLightbox(null);
          return;
        }
        setActiveArticle(null);
        setThemeMenuOpen(false);
      } else if (articleLightbox && articleLightbox.images.length > 1) {
        if (e.key === 'ArrowRight') {
          setArticleLightbox((prev) =>
            prev
              ? { ...prev, index: (prev.index + 1) % prev.images.length }
              : null
          );
        } else if (e.key === 'ArrowLeft') {
          setArticleLightbox((prev) =>
            prev
              ? {
                  ...prev,
                  index:
                    (prev.index - 1 + prev.images.length) % prev.images.length,
                }
              : null
          );
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [articleLightbox, customLightbox]);

  // Smooth slim top progress bar tracking scroll depth
  useEffect(() => {
    let rafId = 0;
    const updateProgress = () => {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      const next = scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0;
      setScrollProgress(next);
    };
    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateProgress);
    };
    updateProgress();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

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

  const themeVars = {
    backgroundColor: theme.bgCanvas,
    color: theme.textPrimary,
    '--portal-accent': theme.accent,
    '--portal-accent-hover': theme.accentHover,
    '--portal-accent-glow': theme.accentGlow,
    '--portal-glow-shadow': theme.accentGlowShadow,
    '--portal-accent-soft': theme.accentSoft,
  } as CSSProperties;

  return (
    <div
      className="min-h-screen transition-colors duration-300"
      style={themeVars}
    >
      {/* Slim Top Scroll Progress Bar */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed top-0 right-0 left-0 z-50 h-[3px] bg-transparent"
      >
        <div
          className="h-full w-full origin-left will-change-transform"
          style={{
            transform: `scaleX(${scrollProgress})`,
            background: `linear-gradient(90deg, ${theme.accent}, ${theme.accentGlow})`,
            boxShadow: scrollProgress > 0.01 ? `0 0 10px ${theme.accentGlowShadow}` : 'none',
          }}
        />
      </div>
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
              className="nav-link-glow inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <Newspaper className="h-3.5 w-3.5 opacity-75" />
              {tr('Yangiliklar')}
            </a>
            <a
              href="#yonalishlar"
              className="nav-link-glow inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <GraduationCap className="h-3.5 w-3.5 opacity-75" />
              {tr('Yo‘nalishlar')}
            </a>
            <a
              href="#rahbariyat"
              className="nav-link-glow inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <Users className="h-3.5 w-3.5 opacity-75" />
              {tr('Rahbariyat')}
            </a>
            <a
              href="#hujjatlar"
              className="nav-link-glow inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <FileText className="h-3.5 w-3.5 opacity-75" />
              {tr('Hujjatlar')}
            </a>
            <a
              href="#boglanish"
              className="nav-link-glow inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <Phone className="h-3.5 w-3.5 opacity-75" />
              {tr('Bog‘lanish')}
            </a>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onOpenAdmin}
              className="btn-glow-primary rounded-md px-4 py-2 text-xs font-semibold text-white whitespace-nowrap shrink-0"
            >
              {tr('Admin panel')}
            </button>
            <button
              type="button"
              onClick={() => setMobileNavOpen((prev) => !prev)}
              className="btn-glow-outline rounded-md border p-2 lg:hidden"
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
              className="btn-glow-ribbon inline-flex items-center gap-1.5 rounded border border-white/25 bg-white/10 px-2.5 py-1 text-xs font-medium text-white whitespace-nowrap"
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
                className="btn-glow-ribbon inline-flex items-center gap-1.5 rounded border border-white/25 bg-white/10 px-2.5 py-1 text-xs font-medium text-white whitespace-nowrap"
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
                  className="btn-glow-primary rounded-md px-4 py-2 text-sm font-medium text-white"
                >
                  {tr('Qayta urinish')}
                </button>
                <button
                  type="button"
                  onClick={onOpenAdmin}
                  className="btn-glow-outline rounded-md border px-4 py-2 text-sm font-medium"
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
                        className="btn-glow-primary inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold text-white whitespace-nowrap"
                      >
                        <GraduationCap className="h-4 w-4" />
                        {tr('Ta’lim yo‘nalishlari')}
                        <ArrowRight className="h-4 w-4" />
                      </a>
                      <a
                        href="#boglanish"
                        className="btn-glow-outline inline-flex items-center gap-2 rounded-md border px-5 py-2.5 text-sm font-semibold whitespace-nowrap"
                        style={{
                          borderColor: theme.borderSubtle,
                          backgroundColor: theme.bgSurfaceAlt,
                          color: theme.textPrimary,
                        }}
                      >
                        <MessageSquare className="h-4 w-4" />
                        {tr('Elektron murojaat')}
                      </a>
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
                      className="group relative block h-72 w-full overflow-hidden rounded-lg border text-left lg:h-full lg:min-h-[340px]"
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
                <RevealOnScroll delayMs={60}>
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
                </RevealOnScroll>

                {/* 4-Column Full-Width Tabular Metrics Strip with Animated Number Writing */}
                <RevealOnScroll delayMs={140}>
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
                        <AnimatedCounter value={settings.students_count} />
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
                        <AnimatedCounter value={settings.teachers_count} durationMs={1000} />
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
                        <AnimatedCounter value={settings.olympiad_winners} durationMs={1100} />
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
                        <AnimatedCounter value={settings.university_rate} durationMs={1250} />
                      </p>
                    </div>
                  </div>
                </RevealOnScroll>
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
                        className="btn-glow-outline rounded border border-transparent px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0"
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
                    className="btn-glow-primary mt-4 rounded-md px-4 py-2 text-xs font-semibold text-white"
                  >
                    {tr('Admin paneldan qo‘shish')}
                  </button>
                </div>
              ) : (
                <div className="mt-8 space-y-10">
                  {leadStory && (
                    <RevealOnScroll delayMs={40}>
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
                            src={getPrimaryMediaUrl(leadStory.imageUrl)}
                            alt={tr(leadStory.title)}
                            className="w3-img-hover h-full w-full object-cover"
                            fallbackTitle={tr(leadStory.title)}
                            smartPortrait
                          />
                          {parseMediaUrls(leadStory.imageUrl).length > 1 && (
                            <span className="pointer-events-none absolute left-3 bottom-3 inline-flex items-center gap-1.5 rounded bg-black/70 px-2.5 py-1 text-[11px] font-medium text-white">
                              <Images className="h-3.5 w-3.5" />
                              {parseMediaUrls(leadStory.imageUrl).length}{' '}
                              {tr('ta rasm')}
                            </span>
                          )}
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
                    </RevealOnScroll>
                  )}

                  {secondaryStories.length > 0 && (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                      {secondaryStories.map((item, idx) => (
                        <RevealOnScroll
                          key={item.id}
                          delayMs={Math.min(idx * 65, 260)}
                          className="flex"
                        >
                          <article
                            onClick={() => setActiveArticle(item)}
                            className="w3-card-elevate group flex w-full cursor-pointer flex-col overflow-hidden rounded-lg border"
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
                              src={getPrimaryMediaUrl(item.imageUrl)}
                              alt={tr(item.title)}
                              className="w3-img-hover h-full w-full object-cover"
                              fallbackTitle={tr(item.title)}
                              smartPortrait
                            />
                            {parseMediaUrls(item.imageUrl).length > 1 && (
                              <span className="pointer-events-none absolute left-3 bottom-3 inline-flex items-center gap-1 rounded bg-black/70 px-2 py-0.5 text-[11px] font-medium text-white">
                                <Images className="h-3 w-3" />
                                {parseMediaUrls(item.imageUrl).length}
                              </span>
                            )}
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
                        </RevealOnScroll>
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
                        className="btn-glow-outline inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium disabled:opacity-40"
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
                          className={`h-8 min-w-[32px] rounded-md border px-2 font-mono-tabular text-xs font-semibold ${
                            pageNum === safeNewsPage
                              ? 'btn-glow-primary'
                              : 'btn-glow-outline'
                          }`}
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
                        className="btn-glow-outline inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium disabled:opacity-40"
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
                    {dataset.programs.map((prog, idx) => (
                      <RevealOnScroll
                        key={prog.id}
                        delayMs={Math.min(idx * 75, 250)}
                        className="flex"
                      >
                        <div
                          className="w3-card-elevate flex w-full flex-col justify-between rounded-lg border p-6"
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
                                {tr('Kvota:')}{' '}
                                <AnimatedCounter
                                  value={tr(prog.quota)}
                                  durationMs={950}
                                />
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
                      </RevealOnScroll>
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
                  {sortedLeadership.map((member, idx) => (
                    <RevealOnScroll
                      key={member.id}
                      delayMs={Math.min(idx * 80, 260)}
                      className="flex"
                    >
                      <div
                        className="w3-card-elevate group flex w-full flex-col overflow-hidden rounded-lg border"
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
                              isPortrait: true,
                            })
                          }
                          className="relative block aspect-[4/3] w-full shrink-0 overflow-hidden text-left"
                          style={{ backgroundColor: theme.bgSurfaceAlt }}
                        >
                          <MediaImage
                            src={member.imageUrl}
                            alt={tr(member.fullName)}
                            className="w3-img-hover h-full w-full object-cover object-top"
                            fallbackTitle={tr(member.fullName)}
                            smartPortrait
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
                    </RevealOnScroll>
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
                        className="btn-glow-outline rounded border border-transparent px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0"
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

                <RevealOnScroll delayMs={60}>
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
                </RevealOnScroll>
              </div>
            </section>

            {/* Bog'lanish va Elektron Murojaat */}
            <section
              id="boglanish"
              className="py-14 transition-colors duration-300"
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
                        className="btn-glow-primary inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
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
              {(() => {
                const articleImages = parseMediaUrls(activeArticle.imageUrl);
                if (articleImages.length === 0) return null;
                return (
                  <div className="mt-6 space-y-3">
                    <button
                      type="button"
                      onClick={() =>
                        setArticleLightbox({
                          images: articleImages,
                          index: 0,
                          title: activeArticle.title,
                          subtitle: `${activeArticle.category} · ${activeArticle.date}`,
                        })
                      }
                      className="group relative block aspect-[16/9] w-full overflow-hidden rounded-lg border text-left"
                      style={{
                        borderColor: theme.borderSubtle,
                        backgroundColor: theme.bgSurfaceAlt,
                      }}
                    >
                      <MediaImage
                        src={articleImages[0]}
                        alt={tr(activeArticle.title)}
                        className="w3-img-hover h-full w-full object-cover"
                        smartPortrait
                      />
                      <span className="pointer-events-none absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-md bg-black/70 px-2.5 py-1 text-xs font-medium text-white opacity-90 transition-opacity group-hover:opacity-100">
                        <ZoomIn className="h-3.5 w-3.5" />
                        {articleImages.length > 1
                          ? tr(`Galereyani ochish (${articleImages.length})`)
                          : tr('Kattalashtirish')}
                      </span>
                    </button>

                    {articleImages.length > 1 && (
                      <div>
                        <p
                          className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold"
                          style={{ color: theme.textMuted }}
                        >
                          <Images className="h-3.5 w-3.5" />
                          {tr(
                            `Yangilik fotogalereyasi (${articleImages.length} ta rasm)`
                          )}
                        </p>
                        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                          {articleImages.map((imgUrl, idx) => (
                            <button
                              key={`${imgUrl}-${idx}`}
                              type="button"
                              onClick={() =>
                                setArticleLightbox({
                                  images: articleImages,
                                  index: idx,
                                  title: activeArticle.title,
                                  subtitle: `${activeArticle.category} · ${activeArticle.date}`,
                                })
                              }
                              className="group relative aspect-[4/3] overflow-hidden rounded-md border"
                              style={{
                                borderColor: theme.borderSubtle,
                                backgroundColor: theme.bgSurfaceAlt,
                              }}
                            >
                              <MediaImage
                                src={imgUrl}
                                alt={`${tr(activeArticle.title)} — ${idx + 1}`}
                                className="w3-img-hover h-full w-full object-cover"
                                smartPortrait
                              />
                              <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
                                <ZoomIn className="h-5 w-5 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
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

      {/* Image Lightbox Modal (Hero, Leadership & News Gallery Slider) */}
      {(customLightbox || articleLightbox) && (
        <div
          className="w3-animate-opacity fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-[2px]"
          onClick={() => {
            setCustomLightbox(null);
            setArticleLightbox(null);
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
              className="flex items-center justify-between gap-4 border-b px-5 py-3.5"
              style={{ borderColor: theme.borderSubtle }}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {tr(articleLightbox?.title || customLightbox?.title || '')}
                </p>
                <p className="text-xs" style={{ color: theme.textMuted }}>
                  {articleLightbox
                    ? `${tr(articleLightbox.subtitle || '')} · ${
                        articleLightbox.index + 1
                      } / ${articleLightbox.images.length}`
                    : tr(customLightbox?.subtitle || '')}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setLightboxFitMode((prev) =>
                      prev === 'fill' ? 'fit' : 'fill'
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-medium hover:bg-black/5"
                  style={{ borderColor: theme.borderSubtle }}
                  title={
                    lightboxFitMode === 'fill'
                      ? tr('Asl o‘lchamda ko‘rish')
                      : tr('Ekranni to‘ldirish (Fill)')
                  }
                >
                  {lightboxFitMode === 'fill' ? (
                    <>
                      <Minimize2 className="h-3.5 w-3.5" />
                      <span>{tr('Fill')}</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="h-3.5 w-3.5" />
                      <span>{tr('Fit')}</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCustomLightbox(null);
                    setArticleLightbox(null);
                  }}
                  className="shrink-0 rounded p-1.5 hover:bg-black/5"
                  aria-label="Yopish"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="relative h-[62vh] w-full overflow-hidden bg-slate-950 sm:h-[72vh]">
              <MediaImage
                src={
                  articleLightbox
                    ? articleLightbox.images[articleLightbox.index]
                    : customLightbox?.url
                }
                alt={tr(articleLightbox?.title || customLightbox?.title || '')}
                smartPortrait={lightboxFitMode === 'fill'}
                className={
                  lightboxFitMode === 'fill'
                    ? `h-full w-full object-cover ${
                        customLightbox?.isPortrait
                          ? 'object-top'
                          : 'object-center'
                      }`
                    : 'h-full w-full object-contain'
                }
              />

              {articleLightbox && articleLightbox.images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setArticleLightbox((prev) =>
                        prev
                          ? {
                              ...prev,
                              index:
                                (prev.index - 1 + prev.images.length) %
                                prev.images.length,
                            }
                          : null
                      )
                    }
                    className="btn-glow-ribbon absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-white/25 bg-black/60 p-2.5 text-white"
                    aria-label="Oldingi rasm"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setArticleLightbox((prev) =>
                        prev
                          ? {
                              ...prev,
                              index: (prev.index + 1) % prev.images.length,
                            }
                          : null
                      )
                    }
                    className="btn-glow-ribbon absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-white/25 bg-black/60 p-2.5 text-white"
                    aria-label="Keyingi rasm"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>

            {articleLightbox && articleLightbox.images.length > 1 && (
              <div
                className="flex gap-2 overflow-x-auto border-t px-4 py-3"
                style={{ borderColor: theme.borderSubtle }}
              >
                {articleLightbox.images.map((thumbUrl, thumbIdx) => {
                  const isCurrent = thumbIdx === articleLightbox.index;
                  return (
                    <button
                      key={`${thumbUrl}-${thumbIdx}`}
                      type="button"
                      onClick={() =>
                        setArticleLightbox((prev) =>
                          prev ? { ...prev, index: thumbIdx } : null
                        )
                      }
                      className={`h-14 w-20 shrink-0 overflow-hidden rounded border-2 transition ${
                        isCurrent
                          ? 'border-[#134280] ring-2 ring-[#134280]/40'
                          : 'border-transparent opacity-65 hover:opacity-100'
                      }`}
                    >
                      <MediaImage
                        src={thumbUrl}
                        alt={`${thumbIdx + 1}`}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
