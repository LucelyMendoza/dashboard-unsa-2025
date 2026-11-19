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
  facultad: string[]; // Vacío = todas las facultades
  escuela: string[]; // Vacío = todas las escuelas disponibles
  programa: string;
  anio: string[]; // Vacío = todos los años
  periodo: string[]; // Vacío = todos los semestres de los años elegidos
  agrupacion: 'sem' | 'anio';
  indicador: 'apr' | 'des' | 'ret' | 'abn' | 'all';
}

export const matchesSelection = (selected: string[], value: string) =>
  selected.length === 0 || selected.includes(value);

export const DEFAULT_FILTERS: FilterState = {
  facultad: [],
  escuela: [],
  programa: 'ALL',
  anio: [],
  periodo: [],
  agrupacion: 'sem',
  indicador: 'apr',
};

/** Filtra las filas agregadas (ag) según facultad/escuela/año/periodo */
export function filterAgg(
  ag: AggregatedRow[],
  { facultad, escuela, anio, periodo }: Pick<FilterState, 'facultad' | 'escuela' | 'anio' | 'periodo'>
): AggregatedRow[] {
  return ag.filter((r) => {
    if (!matchesSelection(facultad, r.FACULTAD)) return false;
    if (!matchesSelection(escuela, r.ESCUELA)) return false;
    if (!matchesSelection(anio, String(r.AÑO))) return false;
    if (!matchesSelection(periodo, r.PERIODO)) return false;
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

/** Construye el scorecard desde las filas agregadas ya filtradas por periodo y alcance */
export function buildScorecard(ag: AggregatedRow[]): ScorecardRow[] {
  const bySchool = new Map<string, AggregatedRow[]>();
  ag.forEach((row) => {
    const key = `${row.FACULTAD}\u0000${row.ESCUELA}`;
    const rows = bySchool.get(key) ?? [];
    rows.push(row);
    bySchool.set(key, rows);
  });

  return Array.from(bySchool.values(), (rows) => {
    const matriculados = rows.reduce((sum, row) => sum + row.m, 0);
    const aprobados = rows.reduce((sum, row) => sum + row.a, 0);
    const desaprobados = rows.reduce((sum, row) => sum + row.d, 0);
    const abandonos = rows.reduce((sum, row) => sum + row.b, 0);
    const retiros = rows.reduce((sum, row) => sum + row.r, 0);
    const years = [...new Set(rows.map((row) => row.AÑO))].sort((a, b) => a - b);
    const yr: Record<string, number> = {};

    years.forEach((year) => {
      const yearRows = rows.filter((row) => row.AÑO === year);
      const yearMatriculados = yearRows.reduce((sum, row) => sum + row.m, 0);
      const yearAprobados = yearRows.reduce((sum, row) => sum + row.a, 0);
      if (yearMatriculados > 0) yr[String(year)] = rate(yearAprobados, yearMatriculados);
    });

    const yearlyRates = Object.values(yr);
    const count = yearlyRates.length;
    const sumX = (count * (count - 1)) / 2;
    const sumY = yearlyRates.reduce((sum, value) => sum + value, 0);
    const sumXY = yearlyRates.reduce((sum, value, index) => sum + index * value, 0);
    const sumX2 = yearlyRates.reduce((sum, _, index) => sum + index * index, 0);
    const denominator = count * sumX2 - sumX * sumX;
    const slope = count >= 2 && denominator !== 0
      ? (count * sumXY - sumX * sumY) / denominator
      : 0;

    return {
      e: rows[0].ESCUELA,
      f: rows[0].FACULTAD,
      tm: matriculados,
      ta: rate(aprobados, matriculados),
      td: rate(desaprobados, matriculados),
      tr: rate(retiros, matriculados),
      tb: rate(abandonos, matriculados),
      tn: rate(retiros + abandonos, matriculados),
      sl: slope,
      yr,
    };
  });
}

/** Filtra filas crudas por asignatura (sa) usando los catálogos del dataset */
export function filterSubjectRows(
  dataset: DashboardDataset,
  facultad: string[],
  escuela: string[],
  anio: string[],
  periodo: string[]
): SubjectRow[] {
  const { fs: F, es: E, ps: P } = dataset;
  return dataset.sa.filter((r) => {
    if (!matchesSelection(facultad, F[r[1]])) return false;
    if (!matchesSelection(escuela, E[r[2]])) return false;
    if (!matchesSelection(anio, P[r[0]].slice(0, 4))) return false;
    if (!matchesSelection(periodo, P[r[0]])) return false;
    return true;
  });
}

/** Filtra filas crudas por docente (dc) usando los catálogos del dataset */
export function filterTeacherRows(dataset: DashboardDataset, f: FilterState): TeacherRow[] {
  const { fs: F, es: E } = dataset;
  return dataset.dc.filter((r) => {
    if (!matchesSelection(f.facultad, F[r[2]])) return false;
    if (!matchesSelection(f.escuela, E[r[3]])) return false;
    return true;
  });
}

export const YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025];
