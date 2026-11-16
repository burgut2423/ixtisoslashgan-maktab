export function parseMediaUrls(raw: string | undefined | null): string[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => (typeof item === 'string' ? item.trim() : ''))
          .filter(Boolean);
      }
    } catch {
      // fall through
    }
  }

  if (trimmed.includes('||')) {
    return trimmed
      .split('||')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return [trimmed];
}

export function serializeMediaUrls(urls: string[]): string {
  const cleaned = Array.from(
    new Set(urls.map((u) => u.trim()).filter(Boolean))
  );
  if (cleaned.length === 0) return '';
  if (cleaned.length === 1) return cleaned[0];
  return JSON.stringify(cleaned);
}

export function getPrimaryMediaUrl(raw: string | undefined | null): string {
  return parseMediaUrls(raw)[0] || '';
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Faylni o‘qib bo‘lmadi'));
      }
    };
    reader.onerror = () => reject(new Error('Faylni o‘qishda xatolik'));
    reader.readAsDataURL(file);
  });
}

/**
 * Compresses image files for lightweight local/static storage fallback (e.g. GitHub Pages)
 * while keeping crisp visual quality up to maxDimension px.
 */
export async function optimizeImageForStaticStorage(
  file: File,
  maxDimension = 1280,
  quality = 0.8
): Promise<{ dataUrl: string; sizeText: string }> {
  const rawDataUrl = await readFileAsDataUrl(file);
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    const kb = Math.max(1, Math.round(file.size / 1024));
    return { dataUrl: rawDataUrl, sizeText: `${kb} KB` };
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          const ratio = Math.min(maxDimension / width, maxDimension / height);
          width = Math.max(1, Math.round(width * ratio));
          height = Math.max(1, Math.round(height * ratio));
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          const kb = Math.max(1, Math.round(file.size / 1024));
          resolve({ dataUrl: rawDataUrl, sizeText: `${kb} KB` });
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', quality);
        const finalUrl =
          compressed.length < rawDataUrl.length ? compressed : rawDataUrl;
        const approxBytes = Math.round((finalUrl.length * 3) / 4);
        const kb = Math.max(1, Math.round(approxBytes / 1024));
        resolve({ dataUrl: finalUrl, sizeText: `${kb} KB` });
      } catch {
        const kb = Math.max(1, Math.round(file.size / 1024));
        resolve({ dataUrl: rawDataUrl, sizeText: `${kb} KB` });
      }
    };
    img.onerror = () => {
      const kb = Math.max(1, Math.round(file.size / 1024));
      resolve({ dataUrl: rawDataUrl, sizeText: `${kb} KB` });
    };
    img.src = rawDataUrl;
  });
}
