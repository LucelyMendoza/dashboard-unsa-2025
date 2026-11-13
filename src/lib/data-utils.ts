import { AggregatedRow, DashboardDataset, ScorecardRow, SubjectRow, TeacherRow } from '@/types/dashboard';

// ── Funciones puras portadas del dashboard v4 (misma semántica, sin cambios) ──

export const rate = (n: number, d: number) => (d ? +((n / d) * 100).toFixed(2) : 0);
export const fmt = (n: number) => n.toLocaleString('es-PE');
export const pct = (n?: number | null) => `${Number.isFinite(n as number) ? (n as number).toFixed(2) : '0.00'}%`;
export const dlt = (a: number, b: number) => {
  const d = a - b;
  return (d >= 0 ? '+' : '') + d.toFixed(2) + 'pp';
};

/** Clase de color de semáforo según tasa de aprobación (heatmap) */
export const hmClass = (v: number) =>
  v >= 90 ? 'g6' : v >= 80 ? 'g5' : v >= 70 ? 'g4' : v >= 60 ? 'g3' : v >= 50 ? 'g2' : 'g1';

/** Nivel de riesgo institucional (usado en scorecard de escuelas) */
export const riskClass = (v: number) => (v >= 90 ? 'risk-low' : v >= 85 ? 'risk-mid' : 'risk-high');
export const riskEmoji = (v: number) => (v >= 90 ? '🟢' : v >= 85 ? '🟡' : '🔴');

export const trendLabel = (s: number) =>
  s > 0.3
    ? { text: `▲ +${s.toFixed(1)}pp/año`, cls: 'text-emerald-600' }
    : s < -0.3
    ? { text: `▼ ${s.toFixed(1)}pp/año`, cls: 'text-red-600' }
    : { text: `● ${s.toFixed(1)}pp/año`, cls: 'text-slate-400' };

export interface FilterState {
  facultad: string; // 'ALL' o nombre exacto
  escuela: string;
  programa: string;
  anio: string; // 'ALL' o año como string
  periodo: string;
  agrupacion: 'sem' | 'anio';
  indicador: 'apr' | 'des' | 'ret' | 'abn' | 'all';
}

export const DEFAULT_FILTERS: FilterState = {
  facultad: 'ALL',
  escuela: 'ALL',
  programa: 'ALL',
  anio: 'ALL',
  periodo: 'ALL',
  agrupacion: 'sem',
  indicador: 'apr',
};

/** Filtra las filas agregadas (ag) según facultad/escuela/año/periodo */
export function filterAgg(
  ag: AggregatedRow[],
  { facultad, escuela, anio, periodo }: Pick<FilterState, 'facultad' | 'escuela' | 'anio' | 'periodo'>
): AggregatedRow[] {
  return ag.filter((r) => {
    if (facultad !== 'ALL' && r.FACULTAD !== facultad) return false;
    if (escuela !== 'ALL' && r.ESCUELA !== escuela) return false;
    if (anio !== 'ALL' && String(r.AÑO) !== anio) return false;
    if (periodo !== 'ALL' && r.PERIODO !== periodo) return false;
    return true;
  });
}

export interface GroupedTotals {
  k: string; // etiqueta (periodo o año)
  m: number;
  a: number;
  d: number;
  b: number;
  r: number;
  n: number;
}

/** Agrupa filas agregadas por periodo o por año */
export function groupBy(data: AggregatedRow[], keyFn: (r: AggregatedRow) => string): GroupedTotals[] {
  const map: Record<string, GroupedTotals> = {};
  data.forEach((r) => {
    const k = keyFn(r);
    if (!map[k]) map[k] = { k, m: 0, a: 0, d: 0, b: 0, r: 0, n: 0 };
    map[k].m += r.m;
    map[k].a += r.a;
    map[k].d += r.d;
    map[k].b += r.b;
    map[k].r += r.r;
    map[k].n += r.n;
  });
  return Object.values(map).sort((x, y) => x.k.localeCompare(y.k));
}

/** Filtra el scorecard de escuelas (sc) según facultad/escuela seleccionadas */
export function filterScorecard(sc: ScorecardRow[], facultad: string, escuela: string): ScorecardRow[] {
  let out = sc;
  if (facultad !== 'ALL') out = out.filter((c) => c.f === facultad);
  if (escuela !== 'ALL') out = out.filter((c) => c.e === escuela);
  return out;
}

/** Filtra filas crudas por asignatura (sa) usando los catálogos del dataset */
export function filterSubjectRows(
  dataset: DashboardDataset,
  facultad: string,
  escuela: string,
  anio: string,
  periodo: string
): SubjectRow[] {
  const { fs: F, es: E, ps: P } = dataset;
  return dataset.sa.filter((r) => {
    if (facultad !== 'ALL' && F[r[1]] !== facultad) return false;
    if (escuela !== 'ALL' && E[r[2]] !== escuela) return false;
    if (anio !== 'ALL' && !P[r[0]].startsWith(anio)) return false;
    if (periodo !== 'ALL' && P[r[0]] !== periodo) return false;
    return true;
  });
}

/** Filtra filas crudas por docente (dc) usando los catálogos del dataset */
export function filterTeacherRows(dataset: DashboardDataset, f: FilterState): TeacherRow[] {
  const { fs: F, es: E } = dataset;
  return dataset.dc.filter((r) => {
    if (f.facultad !== 'ALL' && F[r[2]] !== f.facultad) return false;
    if (f.escuela !== 'ALL' && E[r[3]] !== f.escuela) return false;
    return true;
  });
}

export const YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025];
