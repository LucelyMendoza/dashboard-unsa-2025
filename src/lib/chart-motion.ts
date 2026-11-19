export function getChartAnimationDuration(): number {
  if (typeof window === 'undefined') return 850;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 850;
}
