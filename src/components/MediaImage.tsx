import { useEffect, useMemo, useState } from 'react';
import type { SyntheticEvent } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { getPrimaryMediaUrl } from '../utils/mediaHelpers';

interface MediaImageProps {
  src?: string;
  alt: string;
  className?: string;
  fallbackTitle?: string;
  /**
   * When true, vertical/portrait photos placed inside horizontal frames
   * automatically show 100% of the image uncropped (object-contain)
   * over a soft ambient blurred backdrop instead of cropping top/bottom edges.
   */
  smartPortrait?: boolean;
}

function extractDriveFileId(url: string): string | null {
  if (url.startsWith('/api/public/media/')) {
    const id = decodeURIComponent(
      url.replace('/api/public/media/', '').split('?')[0]
    );
    return /^[a-zA-Z0-9_-]+$/.test(id) ? id : null;
  }
  const fileMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch?.[1]) return fileMatch[1];

  const idParamMatch = url.match(
    /drive\.google\.com\/(?:open|uc|thumbnail)\?[^#]*\bid=([a-zA-Z0-9_-]+)/
  );
  if (idParamMatch?.[1]) return idParamMatch[1];

  const lh3Match = url.match(/lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/);
  if (lh3Match?.[1]) return lh3Match[1];

  return null;
}

function buildSourceCandidates(rawSrc?: string): string[] {
  const primary = getPrimaryMediaUrl(rawSrc).trim();
  if (!primary) return [];

  const base = import.meta.env.BASE_URL || '/';
  let normalized = primary;

  if (normalized.startsWith('/src/assets/')) {
    normalized = `${base}${normalized.slice(1)}`;
  } else if (normalized.startsWith('./src/assets/')) {
    normalized = `${base}${normalized.slice(2)}`;
  } else if (normalized.startsWith('src/assets/')) {
    normalized = `${base}${normalized}`;
  }

  const driveId = extractDriveFileId(normalized);
  if (!driveId) {
    return [normalized];
  }

  const candidates: string[] = [];
  const isStaticMode = import.meta.env.VITE_STATIC_MODE === 'true';

  if (!isStaticMode && normalized.startsWith('/api/public/media/')) {
    candidates.push(normalized);
  }
  candidates.push(`https://lh3.googleusercontent.com/d/${driveId}=w1600`);
  candidates.push(`https://drive.google.com/thumbnail?id=${driveId}&sz=w1600`);
  candidates.push(`https://drive.google.com/uc?export=view&id=${driveId}`);

  if (!candidates.includes(normalized)) {
    candidates.unshift(normalized);
  }

  return Array.from(new Set(candidates));
}

export function MediaImage({
  src,
  alt,
  className = 'h-full w-full object-cover',
  fallbackTitle,
  smartPortrait = false,
}: MediaImageProps) {
  const candidates = useMemo(() => buildSourceCandidates(src), [src]);
  const [attemptIdx, setAttemptIdx] = useState(0);
  const [isPortrait, setIsPortrait] = useState(false);

  useEffect(() => {
    setAttemptIdx(0);
    setIsPortrait(false);
  }, [src]);

  const activeSrc = candidates[attemptIdx] || '';

  const handleImgError = () => {
    if (attemptIdx + 1 < candidates.length) {
      setAttemptIdx((prev) => prev + 1);
    } else {
      setAttemptIdx(candidates.length);
    }
  };

  const handleImgLoad = (e: SyntheticEvent<HTMLImageElement>) => {
    if (!smartPortrait) return;
    const { naturalWidth, naturalHeight } = e.currentTarget;
    if (naturalWidth > 0 && naturalHeight > naturalWidth * 1.05) {
      setIsPortrait(true);
    } else {
      setIsPortrait(false);
    }
  };

  if (!activeSrc || attemptIdx >= candidates.length) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200 p-4 text-center text-slate-500">
        <ImageIcon className="mb-2 h-7 w-7 text-slate-400" />
        <span className="max-w-[200px] text-xs font-medium text-slate-500 line-clamp-2">
          {fallbackTitle || alt}
        </span>
      </div>
    );
  }

  if (smartPortrait && isPortrait) {
    const containClass = className
      .replace(/\bobject-cover\b/g, 'object-contain')
      .replace(/\bobject-top\b/g, 'object-center');
    return (
      <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-slate-100/80">
        <img
          src={activeSrc}
          alt=""
          aria-hidden="true"
          referrerPolicy="no-referrer"
          className="pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover opacity-35 blur-lg"
        />
        <img
          src={activeSrc}
          alt={alt}
          referrerPolicy="no-referrer"
          onLoad={handleImgLoad}
          onError={handleImgError}
          className={`relative z-10 ${containClass}`}
        />
      </div>
    );
  }

  return (
    <img
      src={activeSrc}
      alt={alt}
      referrerPolicy="no-referrer"
      onLoad={handleImgLoad}
      onError={handleImgError}
      className={className}
    />
  );
}
