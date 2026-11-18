import React, { useMemo, useState } from 'react';
import { fmt, rate } from '@/lib/data-utils';
import type { DashboardDataset } from '@/types/dashboard';
import type { FilterState } from '@/lib/data-utils';
import { filterSubjectRows } from '@/lib/data-utils';

type MetricKey = 'apr' | 'des' | 'ret' | 'abn';

type RateBand = 'low' | 'medium' | 'high';

const PAGE_SIZES = [25, 50, 100];

const METRICS: Record<MetricKey, { label: string; accent: string; bands: Record<RateBand, string> }> = {
  apr: {
    label: 'Aprobados',
    accent: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    bands: {
      low: 'bg-rose-50 text-rose-800',
      medium: 'bg-amber-50 text-amber-800',
      high: 'bg-emerald-50 text-emerald-800',
    },
  },
  des: {
    label: 'Desaprobados',
    accent: 'border-rose-200 bg-rose-50 text-rose-800',
    bands: {
      low: 'bg-emerald-50 text-emerald-800',
      medium: 'bg-orange-50 text-orange-800',
      high: 'bg-rose-100 text-rose-900',
    },
  },
  ret: {
    label: 'Retiros',
    accent: 'border-amber-200 bg-amber-50 text-amber-900',
    bands: {
      low: 'bg-sky-50 text-sky-800',
      medium: 'bg-amber-50 text-amber-900',
      high: 'bg-orange-100 text-orange-900',
    },
  },
  abn: {
    label: 'Abandonos',
    accent: 'border-violet-200 bg-violet-50 text-violet-900',
    bands: {
      low: 'bg-teal-50 text-teal-800',
      medium: 'bg-violet-50 text-violet-800',
      high: 'bg-purple-100 text-purple-900',
    },
  },
};

function getRateBand(metric: MetricKey, value: number): RateBand {
  if (metric === 'apr') return value >= 80 ? 'high' : value >= 60 ? 'medium' : 'low';
  if (metric === 'des') return value <= 10 ? 'low' : value <= 25 ? 'medium' : 'high';
  if (metric === 'ret') return value <= 5 ? 'low' : value <= 15 ? 'medium' : 'high';
  return value <= 5 ? 'low' : value <= 15 ? 'medium' : 'high';
}

export default function SubjectHeatmap({
  dataset,
  filters,
  metric,
}: {
  dataset: DashboardDataset;
  filters: FilterState;
  metric: MetricKey;
}) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  const sa = useMemo(
    () => filterSubjectRows(dataset, filters.facultad, filters.escuela, filters.anio, filters.periodo),
    [dataset, filters.facultad, filters.escuela, filters.anio, filters.periodo]
  );
  const { an: AN, ac: AC, ps: P } = dataset;

  const byA = useMemo(() => {
    const result: Record<number, Record<string, { m: number; apr: number; des: number; abn: number; ret: number }>> = {};
    sa.forEach((r) => {
      const subjectIndex = r[3];
      const p = P[r[0]];
      if (!result[subjectIndex]) result[subjectIndex] = {};
      if (!result[subjectIndex][p]) result[subjectIndex][p] = { m: 0, apr: 0, des: 0, abn: 0, ret: 0 };
      result[subjectIndex][p].m += r[5];
      result[subjectIndex][p].apr += r[6];
      result[subjectIndex][p].des += r[7];
      result[subjectIndex][p].abn += r[8];
      result[subjectIndex][p].ret += r[9];
    });
    return result;
  }, [sa, P]);

  const periodList =
    filters.periodo !== 'ALL' ? [filters.periodo] : filters.anio !== 'ALL' ? P.filter((p) => p.startsWith(filters.anio)) : P;

  const aggList = useMemo(
    () =>
      Object.keys(byA)
        .map(Number)
        .map((subjectIndex) => {
          let tm = 0;
          let tv = 0;
          Object.values(byA[subjectIndex]).forEach((values) => {
            tm += values.m;
            tv += values[metric];
          });
          return { subjectIndex, rate: rate(tv, tm), t: tm };
        })
        .sort((a, b) => a.rate - b.rate || AN[a.subjectIndex].localeCompare(AN[b.subjectIndex]) || AC[a.subjectIndex].localeCompare(AC[b.subjectIndex])),
    [byA, metric, AN, AC]
  );
  const pageCount = Math.max(1, Math.ceil(aggList.length / pageSize));
  const visiblePage = Math.min(page, pageCount - 1);
  const pageRows = aggList.slice(visiblePage * pageSize, (visiblePage + 1) * pageSize);
  const firstRow = aggList.length ? visiblePage * pageSize + 1 : 0;
  const lastRow = Math.min((visiblePage + 1) * pageSize, aggList.length);

  if (!aggList.length) {
    return <p className="text-center text-slate-400 text-xs py-8">Sin datos para el filtro seleccionado</p>;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${METRICS[metric].accent}`}>
            {METRICS[metric].label}
          </span>
          <span className="text-xs text-slate-500">
            {fmt(aggList.length)} asignaturas · ordenadas por tasa global
          </span>
        </div>
        <label className="flex items-center gap-2 text-[11px] font-medium text-slate-500">
          Filas por página
          <select
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(0);
            }}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-slate-400"
          >
            {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
      </div>

      <div className="max-h-[70vh] overflow-auto">
        <table className="academic-table min-w-max text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-20 min-w-[120px] text-left">CODIGO</th>
              <th className="min-w-[240px] text-left">Asignatura</th>
              <th className="min-w-[115px] text-right">Global %</th>
              {periodList.map((p) => (
                <th key={p} className="min-w-[72px] text-right">{p}</th>
              ))}
              <th className="min-w-[90px] text-right">Matriculados</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((a, i) => {
              const globalBand = METRICS[metric].bands[getRateBand(metric, a.rate)];
              return (
                <tr key={a.subjectIndex} className={`border-t border-slate-100 transition-colors hover:bg-slate-50 ${i % 2 ? 'bg-slate-50/40' : 'bg-white'}`}>
                    <td className="sticky left-0 z-[1] bg-inherit font-mono text-[11px] text-slate-600">{AC[a.subjectIndex] || '—'}</td>
                    <td className="max-w-[360px] truncate font-medium text-slate-700" title={AN[a.subjectIndex]}>
                      {AN[a.subjectIndex]}
                    </td>
                  <td className="px-3 py-2 text-right">
                    <span className={`inline-flex min-w-[68px] justify-end rounded-md px-2 py-1 font-semibold tabular-nums ${globalBand}`}>
                      {a.rate.toFixed(1)}%
                    </span>
                  </td>
                  {periodList.map((p) => {
                    const d = byA[a.subjectIndex]?.[p];
                    if (!d) return <td key={p} className="px-3 py-2 text-right text-slate-300">—</td>;
                    const value = rate(d[metric], d.m);
                    const band = METRICS[metric].bands[getRateBand(metric, value)];
                    return (
                      <td key={p} className="px-3 py-2 text-right" title={`${fmt(d[metric])} de ${fmt(d.m)} matriculados`}>
                        <span className={`inline-flex min-w-[58px] justify-end rounded-md px-2 py-1 font-medium tabular-nums ${band}`}>
                          {value.toFixed(0)}%
                        </span>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-right font-medium tabular-nums text-slate-600">{fmt(a.t)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-[11px] text-slate-500">
          Mostrando {fmt(firstRow)}–{fmt(lastRow)} de {fmt(aggList.length)} asignaturas
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage(Math.max(0, visiblePage - 1))}
            disabled={visiblePage === 0}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="min-w-[110px] text-center text-xs tabular-nums text-slate-600">
            Página {visiblePage + 1} de {pageCount}
          </span>
          <button
            type="button"
            onClick={() => setPage(Math.min(pageCount - 1, visiblePage + 1))}
            disabled={visiblePage >= pageCount - 1}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}
