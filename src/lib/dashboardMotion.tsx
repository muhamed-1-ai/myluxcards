"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

/**
 * Hook to detect user preference for reduced motion.
 * Safely defaults to false during SSR.
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const listener = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", listener);
      return () => mediaQuery.removeEventListener("change", listener);
    } else if (typeof (mediaQuery as any).addListener === "function") {
      (mediaQuery as any).addListener(listener);
      return () => (mediaQuery as any).removeListener(listener);
    }
  }, []);

  return prefersReducedMotion;
}

/**
 * Calculates a capped stagger delay for dashboard cards.
 * Follows visual reading order: index 0, 1, 2, ...
 * Desktop stagger: 60ms, capped at 240ms total delay.
 * Mobile stagger: 35ms, capped at 140ms total delay.
 * Also supports custom (index, staggerMs, maxDelayMs).
 */
export function getCardEntranceDelay(
  index: number,
  staggerMsOrIsMobile: number | boolean = 60,
  maxDelayMs: number = 240
): number {
  if (typeof staggerMsOrIsMobile === "boolean") {
    return staggerMsOrIsMobile
      ? Math.min(index * 35, 140)
      : Math.min(index * 60, 240);
  }
  return Math.min(index * staggerMsOrIsMobile, maxDelayMs);
}

export interface UseAnimatedNumberOptions {
  duration?: number;
  decimals?: number;
  formatter?: (val: number) => string;
  enabled?: boolean;
  isLoaded?: boolean;
}

/**
 * Smoothly animates a numeric value once authoritative data is available.
 * - Distinguishes genuine zero results from loading placeholders.
 * - On first load with real data, animates up to target.
 * - On background refresh, retains previous value and transitions smoothly without resetting to zero.
 * - Uses cubic-bezier out easing: power3.out (1 - (1 - t)^3).
 * - When reduced motion is preferred, immediately reflects final target.
 */
export function useAnimatedNumber(
  targetValue?: number | null,
  options: UseAnimatedNumberOptions = {}
): {
  displayValue: string;
  finalValue: string;
  isAnimating: boolean;
  isReady: boolean;
} {
  const {
    duration = 800,
    decimals = 0,
    formatter,
    enabled = true,
    isLoaded: passedIsLoaded,
  } = options;

  const reducedMotion = usePrefersReducedMotion();
  const formatFn = useCallback(
    (n: number) => {
      if (formatter) return formatter(n);
      if (decimals > 0) return n.toFixed(decimals);
      return Math.round(n).toLocaleString();
    },
    [formatter, decimals]
  );

  const hasLoadedData = passedIsLoaded !== undefined
    ? passedIsLoaded && targetValue !== null && targetValue !== undefined
    : targetValue !== null && targetValue !== undefined;

  const hasInitialLoadedRef = useRef<boolean>(false);
  const previousTargetRef = useRef<number>(0);
  const [currentValue, setCurrentValue] = useState<number>(0);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [isReady, setIsReady] = useState<boolean>(false);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    // If data is not yet authoritative, remain unready (or retain previous value if already loaded once)
    if (!hasLoadedData) {
      if (!hasInitialLoadedRef.current) {
        setIsReady(false);
      }
      return;
    }

    const numericEnd = typeof targetValue === "number" ? targetValue : 0;
    setIsReady(true);

    // If first authoritative load: start from 0 to numericEnd
    const isFirstLoad = !hasInitialLoadedRef.current;
    if (isFirstLoad) {
      hasInitialLoadedRef.current = true;
    }

    const startValue = isFirstLoad ? 0 : previousTargetRef.current;
    const endValue = numericEnd;
    previousTargetRef.current = endValue;

    // If animations disabled, reduced motion, or values identical, set immediately
    if (!enabled || reducedMotion || duration <= 0 || startValue === endValue) {
      setCurrentValue(endValue);
      setIsAnimating(false);
      return;
    }

    const startTime = performance.now();
    setIsAnimating(true);

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing: cubic-bezier power3.out: 1 - Math.pow(1 - progress, 3)
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextValue = startValue + (endValue - startValue) * eased;

      if (progress < 1) {
        setCurrentValue(nextValue);
        rafIdRef.current = requestAnimationFrame(tick);
      } else {
        setCurrentValue(endValue);
        setIsAnimating(false);
        rafIdRef.current = null;
      }
    };

    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }
    rafIdRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [targetValue, hasLoadedData, duration, enabled, reducedMotion]);

  const displayValue = isReady ? formatFn(currentValue) : "…";
  const finalValue = isReady ? formatFn(typeof targetValue === "number" ? targetValue : 0) : "Loading…";

  return { displayValue, finalValue, isAnimating, isReady };
}

export interface AnimatedNumberProps {
  value?: number | null;
  isLoaded?: boolean;
  duration?: number;
  decimals?: number;
  formatter?: (val: number) => string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Drop-in accessible animated number component.
 * - Renders skeleton placeholder while loading without flashing fabricated zeros.
 * - Intermediate counting values are aria-hidden, while container has authoritative aria-label
 *   with exact final value to prevent screen-reader spam.
 */
export function AnimatedNumber({
  value,
  isLoaded,
  duration = 800,
  decimals = 0,
  formatter,
  className = "",
  style,
}: AnimatedNumberProps) {
  const { displayValue, finalValue, isAnimating, isReady } = useAnimatedNumber(value, {
    duration,
    decimals,
    formatter,
    isLoaded,
  });

  if (!isReady) {
    return (
      <span
        className={`dash-animated-num is-loading ${className}`}
        style={style}
        aria-label="Loading..."
      >
        <span className="dash-num-skeleton-dash" aria-hidden="true">…</span>
      </span>
    );
  }

  return (
    <span
      className={`dash-animated-num ${isAnimating ? "is-animating" : ""} ${className}`}
      style={style}
      aria-label={finalValue}
    >
      <span aria-hidden="true">{displayValue}</span>
    </span>
  );
}

/**
 * Hook to manage dashboard entrance animation lifecycle.
 * - Plays entrance sequence once when the dashboard view mounts.
 * - Does not retrigger during background data refreshes or filter updates.
 * - Resets only when explicitly unmounted and remounted on new view navigation.
 */
export function useDashboardEntrance(isDataLoaded: boolean = true) {
  const [hasEntered, setHasEntered] = useState<boolean>(false);
  const reducedMotion = usePrefersReducedMotion();
  const triggeredRef = useRef<boolean>(false);

  useEffect(() => {
    if (isDataLoaded && !triggeredRef.current) {
      triggeredRef.current = true;
      setHasEntered(true);
    }
  }, [isDataLoaded]);

  return {
    shouldAnimateEntrance: hasEntered && !reducedMotion,
    reducedMotion,
  };
}
