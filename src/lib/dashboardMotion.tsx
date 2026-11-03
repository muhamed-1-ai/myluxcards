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
 * Desktop stagger: 55ms, capped at 320ms.
 * Mobile stagger: 35ms, capped at 220ms.
 * Also supports custom (index, staggerMs, maxDelayMs).
 */
export function getCardEntranceDelay(
  index: number,
  staggerMsOrIsMobile: number | boolean = 55,
  maxDelayMs: number = 320
): number {
  if (typeof staggerMsOrIsMobile === "boolean") {
    return staggerMsOrIsMobile
      ? Math.min(index * 35, 220)
      : Math.min(index * 55, 320);
  }
  return Math.min(index * staggerMsOrIsMobile, maxDelayMs);
}

export interface UseAnimatedNumberOptions {
  duration?: number;
  decimals?: number;
  formatter?: (val: number) => string;
  enabled?: boolean;
}

/**
 * Smoothly animates a numeric value from its previous value (or 0) to target.
 * Uses cubic-bezier out easing: power3.out (1 - (1 - t)^3).
 * Cancels outdated animations when new targets arrive.
 * When reduced motion is preferred, immediately reflects final target.
 */
export function useAnimatedNumber(
  targetValue: number,
  options: UseAnimatedNumberOptions = {}
): {
  displayValue: string;
  finalValue: string;
  isAnimating: boolean;
} {
  const {
    duration = 850,
    decimals = 0,
    formatter,
    enabled = true,
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

  const [currentValue, setCurrentValue] = useState<number>(() => targetValue);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const previousTargetRef = useRef<number>(targetValue);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    // If animations disabled, reduced motion, or value unchanged, jump immediately
    if (!enabled || reducedMotion || duration <= 0) {
      setCurrentValue(targetValue);
      previousTargetRef.current = targetValue;
      setIsAnimating(false);
      return;
    }

    const startValue = previousTargetRef.current;
    const endValue = targetValue;
    previousTargetRef.current = targetValue;

    if (startValue === endValue) {
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

    rafIdRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [targetValue, duration, enabled, reducedMotion]);

  const displayValue = formatFn(currentValue);
  const finalValue = formatFn(targetValue);

  return { displayValue, finalValue, isAnimating };
}

export interface AnimatedNumberProps {
  value: number;
  duration?: number;
  decimals?: number;
  formatter?: (val: number) => string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Drop-in accessible animated number component.
 * Intermediate values are aria-hidden, while the container has an authoritative aria-label
 * with the final accurate value to prevent screen-reader spam.
 */
export function AnimatedNumber({
  value,
  duration = 850,
  decimals = 0,
  formatter,
  className = "",
  style,
}: AnimatedNumberProps) {
  const { displayValue, finalValue, isAnimating } = useAnimatedNumber(value, {
    duration,
    decimals,
    formatter,
  });

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

  useEffect(() => {
    if (isDataLoaded && !hasEntered) {
      setHasEntered(true);
    }
  }, [isDataLoaded, hasEntered]);

  return {
    shouldAnimateEntrance: hasEntered && !reducedMotion,
    reducedMotion,
  };
}
