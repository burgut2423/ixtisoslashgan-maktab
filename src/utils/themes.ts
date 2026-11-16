export type ThemeId =
  | 'lapis'
  | 'emerald'
  | 'khorezm'
  | 'midnight'
  | 'minimal'
  | 'bronze';

export interface PortalTheme {
  id: ThemeId;
  name: string;
  swatch: string;
  isDark: boolean;
  bgCanvas: string;
  bgSurface: string;
  bgSurfaceAlt: string;
  borderSubtle: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentHover: string;
  accentGlow: string;
  accentGlowShadow: string;
  accentSoft: string;
  ribbonBg: string;
  ribbonText: string;
  footerBg: string;
  footerText: string;
}

export const PORTAL_THEMES: PortalTheme[] = [
  {
    id: 'lapis',
    name: 'Davlat Ko‘k',
    swatch: '#134280',
    isDark: false,
    bgCanvas: '#F8FAFC',
    bgSurface: '#FFFFFF',
    bgSurfaceAlt: '#F1F5F9',
    borderSubtle: '#E2E8F0',
    textPrimary: '#0F172A',
    textSecondary: '#334155',
    textMuted: '#64748B',
    accent: '#134280',
    accentHover: '#1D4ED8',
    accentGlow: '#3B82F6',
    accentGlowShadow: 'rgba(37, 99, 235, 0.48)',
    accentSoft: 'rgba(19, 66, 128, 0.08)',
    ribbonBg: '#0F2D59',
    ribbonText: '#E2E8F0',
    footerBg: '#0F172A',
    footerText: '#CBD5E1',
  },
  {
    id: 'emerald',
    name: 'Zumrad Akademik',
    swatch: '#065F46',
    isDark: false,
    bgCanvas: '#F5F9F7',
    bgSurface: '#FFFFFF',
    bgSurfaceAlt: '#ECF3EF',
    borderSubtle: '#D6E4DD',
    textPrimary: '#0F241B',
    textSecondary: '#2C4A3E',
    textMuted: '#587568',
    accent: '#065F46',
    accentHover: '#059669',
    accentGlow: '#10B981',
    accentGlowShadow: 'rgba(16, 185, 129, 0.46)',
    accentSoft: 'rgba(6, 95, 70, 0.08)',
    ribbonBg: '#064E3B',
    ribbonText: '#ECFDF5',
    footerBg: '#052E23',
    footerText: '#D1FAE5',
  },
  {
    id: 'khorezm',
    name: 'Qadimiy Xorazm',
    swatch: '#9A3412',
    isDark: false,
    bgCanvas: '#FBF9F5',
    bgSurface: '#FFFFFF',
    bgSurfaceAlt: '#F4EFE6',
    borderSubtle: '#E4DACB',
    textPrimary: '#1C1917',
    textSecondary: '#44403C',
    textMuted: '#78716C',
    accent: '#9A3412',
    accentHover: '#EA580C',
    accentGlow: '#F97316',
    accentGlowShadow: 'rgba(234, 88, 12, 0.46)',
    accentSoft: 'rgba(154, 52, 18, 0.08)',
    ribbonBg: '#431407',
    ribbonText: '#FFEDD5',
    footerBg: '#292524',
    footerText: '#E7E5E4',
  },
  {
    id: 'midnight',
    name: 'Tungi Akademiya',
    swatch: '#0F172A',
    isDark: true,
    bgCanvas: '#0B1120',
    bgSurface: '#111827',
    bgSurfaceAlt: '#1E293B',
    borderSubtle: '#263244',
    textPrimary: '#F8FAFC',
    textSecondary: '#CBD5E1',
    textMuted: '#94A3B8',
    accent: '#2563EB',
    accentHover: '#3B82F6',
    accentGlow: '#60A5FA',
    accentGlowShadow: 'rgba(96, 165, 250, 0.55)',
    accentSoft: 'rgba(56, 189, 248, 0.14)',
    ribbonBg: '#060A14',
    ribbonText: '#CBD5E1',
    footerBg: '#050811',
    footerText: '#94A3B8',
  },
  {
    id: 'minimal',
    name: 'Safir Minimal',
    swatch: '#18181B',
    isDark: false,
    bgCanvas: '#FAFAFA',
    bgSurface: '#FFFFFF',
    bgSurfaceAlt: '#F4F4F5',
    borderSubtle: '#E4E4E7',
    textPrimary: '#09090B',
    textSecondary: '#3F3F46',
    textMuted: '#71717A',
    accent: '#1D4ED8',
    accentHover: '#2563EB',
    accentGlow: '#38BDF8',
    accentGlowShadow: 'rgba(37, 99, 235, 0.45)',
    accentSoft: 'rgba(29, 78, 216, 0.08)',
    ribbonBg: '#18181B',
    ribbonText: '#F4F4F5',
    footerBg: '#09090B',
    footerText: '#D4D4D8',
  },
  {
    id: 'bronze',
    name: 'Kuzgi Bronza',
    swatch: '#B45309',
    isDark: false,
    bgCanvas: '#FAF7F2',
    bgSurface: '#FFFFFF',
    bgSurfaceAlt: '#F3ECE1',
    borderSubtle: '#E5D9C8',
    textPrimary: '#292524',
    textSecondary: '#57534E',
    textMuted: '#78716C',
    accent: '#B45309',
    accentHover: '#D97706',
    accentGlow: '#F59E0B',
    accentGlowShadow: 'rgba(245, 158, 11, 0.48)',
    accentSoft: 'rgba(180, 83, 9, 0.09)',
    ribbonBg: '#292524',
    ribbonText: '#FEF3C7',
    footerBg: '#1C1917',
    footerText: '#D6D3D1',
  },
];

export function getThemeById(id: string | null | undefined): PortalTheme {
  return PORTAL_THEMES.find((t) => t.id === id) || PORTAL_THEMES[0];
}
