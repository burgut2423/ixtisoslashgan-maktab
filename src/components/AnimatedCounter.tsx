import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

interface AnimatedCounterProps {
  value: string | undefined | null;
  durationMs?: number;
  className?: string;
}

interface ParsedMetric {
  prefix: string;
  target: number;
  decimals: number;
  suffix: string;
  hadSpaces: boolean;
}

function parseMetricValue(raw: string): ParsedMetric | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^([^\d\-+]*)(\d[\d\s.,]*)(.*)$/);
  if (!match) return null;

  const prefix = match[1] || '';
  const numPart = match[2] || '';
  const suffix = match[3] || '';
  const hadSpaces = /\s/.test(numPart);

  // Normalize decimal separator (last dot or comma if followed by 1-2 digits)
  let normalized = numPart.replace(/\s+/g, '');
  let decimals = 0;
  const decMatch = normalized.match(/[.,](\d{1,2})$/);
  if (decMatch) {
    decimals = decMatch[1].length;
    normalized = normalized.replace(/[.,](\d{1,2})$/, '.$1');
    normalized = normalized.replace(/,/g, '');
  } else {
    normalized = normalized.replace(/[.,]/g, '');
  }

  const target = Number(normalized);
  if (!Number.isFinite(target)) return null;

  return { prefix, target, decimals, suffix, hadSpaces };
}

function formatMetricNumber(
  val: number,
  decimals: number,
  hadSpaces: boolean
): string {
  const fixed = decimals > 0 ? val.toFixed(decimals) : Math.round(val).toString();
  if (!hadSpaces) return fixed;
  const [intPart, decPart] = fixed.split('.');
  const spacedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return decPart !== undefined ? `${spacedInt}.${decPart}` : spacedInt;
}

export function AnimatedCounter({
  value,
  durationMs = 1150,
  className = '',
}: AnimatedCounterProps) {
  const raw = value || '—';
  const parsed = parseMetricValue(raw);
  const elRef = useRef<HTMLSpanElement | null>(null);
  const [displayText, setDisplayText] = useState<string>(raw);

  useEffect(() => {
    if (!parsed) {
      setDisplayText(raw);
      return;
    }

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setDisplayText(raw);
      return;
    }

    let frameId = 0;
    let started = false;
    let observer: IntersectionObserver | null = null;

    const runAnimation = () => {
      if (started) return;
      started = true;
      const startTime = performance.now();

      const step = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / durationMs);
        // Smooth ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = parsed.target * eased;
        const formatted = formatMetricNumber(
          current,
          parsed.decimals,
          parsed.hadSpaces
        );
        setDisplayText(`${parsed.prefix}${formatted}${parsed.suffix}`);

        if (progress < 1) {
          frameId = requestAnimationFrame(step);
        } else {
          setDisplayText(raw);
        }
      };

      frameId = requestAnimationFrame(step);
    };

    const node = elRef.current;
    if (node && typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            runAnimation();
            observer?.disconnect();
          }
        },
        { threshold: 0.2 }
      );
      observer.observe(node);
    }

    // Fallback in case element is already visible or observer doesn't fire
    const fallbackTimer = window.setTimeout(() => {
      if (!started) {
        runAnimation();
      }
    }, 280);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(fallbackTimer);
      observer?.disconnect();
    };
  }, [raw, durationMs]);

  return (
    <span
      ref={elRef}
      className={`font-mono-tabular inline-block ${className}`}
    >
      {displayText}
    </span>
  );
}

interface RevealOnScrollProps {
  children: ReactNode;
  delayMs?: number;
  className?: string;
}

export function RevealOnScroll({
  children,
  delayMs = 0,
  className = '',
}: RevealOnScrollProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setVisible(true);
      return;
    }

    const node = ref.current;
    let observer: IntersectionObserver | null = null;
    if (node && typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            setVisible(true);
            observer?.disconnect();
          }
        },
        { threshold: 0.08, rootMargin: '0px 0px -24px 0px' }
      );
      observer.observe(node);
    }

    const fallbackTimer = window.setTimeout(() => {
      setVisible(true);
    }, 650);

    return () => {
      clearTimeout(fallbackTimer);
      observer?.disconnect();
    };
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal-block ${visible ? 'is-visible' : ''} ${className}`}
      style={{ transitionDelay: `${delayMs}ms` }}
    >
      {children}
    </div>
  );
}
