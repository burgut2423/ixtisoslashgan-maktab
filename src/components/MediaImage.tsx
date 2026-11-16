import { useEffect, useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';

interface MediaImageProps {
  src?: string;
  alt: string;
  className?: string;
  fallbackTitle?: string;
}

function resolveAssetSrc(rawSrc?: string): string {
  if (!rawSrc) return '';
  if (rawSrc.startsWith('/src/assets/')) {
    const base = import.meta.env.BASE_URL || '/';
    return `${base}${rawSrc.slice(1)}`;
  }
  return rawSrc;
}

export function MediaImage({
  src,
  alt,
  className = 'h-full w-full object-cover',
  fallbackTitle,
}: MediaImageProps) {
  const [resolvedSrc, setResolvedSrc] = useState(() => resolveAssetSrc(src));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setResolvedSrc(resolveAssetSrc(src));
    setFailed(false);
  }, [src]);

  const handleImgError = () => {
    // If running on static GitHub Pages where /api/public/media/:id doesn't exist,
    // automatically fall back to direct Google Drive thumbnail endpoint.
    if (resolvedSrc.startsWith('/api/public/media/')) {
      const fileId = decodeURIComponent(
        resolvedSrc.replace('/api/public/media/', '')
      );
      if (fileId) {
        setResolvedSrc(`https://lh3.googleusercontent.com/d/${fileId}=w1600`);
        return;
      }
    }
    setFailed(true);
  };

  if (!resolvedSrc || failed) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200 p-4 text-center text-slate-500">
        <ImageIcon className="mb-2 h-7 w-7 text-slate-400" />
        <span className="max-w-[200px] text-xs font-medium text-slate-500 line-clamp-2">
          {fallbackTitle || alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={handleImgError}
      className={className}
    />
  );
}
