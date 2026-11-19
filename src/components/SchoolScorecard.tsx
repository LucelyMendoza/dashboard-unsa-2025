import React, { useState } from 'react';
import { fmt, hmClass, pct, riskClass, trendLabel, YEARS } from '@/lib/data-utils';
import type { ScorecardRow } from '@/types/dashboard';
import TablePagination from '@/components/TablePagination';

const HEAT_BG: Record<string, string> = {
  g6: '#b7e4c7',
  g5: '#d8edbd',
  g4: '#fff0a6',
  g3: '#ffd98a',
  g2: '#ffbd8b',
  g1: '#f2a3a0',
};

const HEAT_TEXT: Record<string, string> = {
  g6: '#174b2d',
  g5: '#31551e',
  g4: '#624800',
  g3: '#70420a',
  g2: '#73320d',
  g1: '#702321',
};

const RISK_STYLES = {
  'risk-low': { label: 'Bajo riesgo', className: 'bg-[#c6efd2] text-[#174b2d] ring-[#76c58e]' },
  'risk-mid': { label: 'Riesgo medio', className: 'bg-[#fff0a6] text-[#624800] ring-[#e0b83f]' },
  'risk-high': { label: 'Alto riesgo', className: 'bg-[#f4b2ae] text-[#702321] ring-[#d97972]' },
};

export default function SchoolScorecard({ rows }: { rows: ScorecardRow[] }) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const visibleRows = rows.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-2 border-b border-[var(--linea)] bg-[#f7f5f1] px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-slate-700">Riesgo según aprobación global</p>
          <p className="mt-0.5 text-[10px] text-slate-500">Se calcula con la tasa de aprobados de cada escuela: a mayor aprobación, menor riesgo.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-[10px] font-semibold">
          <span className="rounded-full bg-[#c6efd2] px-2.5 py-1 text-[#174b2d] ring-1 ring-inset ring-[#76c58e]">Verde · Bajo riesgo · ≥ 90%</span>
          <span className="rounded-full bg-[#fff0a6] px-2.5 py-1 text-[#624800] ring-1 ring-inset ring-[#e0b83f]">Amarillo · Riesgo medio · 85% a &lt; 90%</span>
          <span className="rounded-full bg-[#f4b2ae] px-2.5 py-1 text-[#702321] ring-1 ring-inset ring-[#d97972]">Rojo · Alto riesgo · &lt; 85%</span>
        </div>
      </div>
      <div className="academic-table-shell max-h-[70vh] rounded-none border-0">
      <table className="academic-table animated-table min-w-max text-xs whitespace-nowrap">
        <thead>
          <tr>
            <th className="school-name-heading text-left">Escuela</th>
            <th className="text-left">Facultad</th>
            <th className="text-right">Matr.</th>
            <th className="text-right">Aprob.</th>
            <th className="text-right">Desap.</th>
            <th className="text-right">Retiro</th>
            <th className="text-right">Abandono</th>
            <th className="text-right">Tendencia</th>
            {YEARS.map((y) => (
              <th key={y} className="text-right">
                {y}
              </th>
            ))}
            <th className="text-center">Riesgo académico</th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((c) => {
            const tr = trendLabel(c.sl);
            const risk = RISK_STYLES[riskClass(c.ta) as keyof typeof RISK_STYLES];
            return (
              <tr key={c.e}>
                <td className="school-name-cell font-semibold" title={c.e}>{c.e}</td>
                <td className="text-[10px] text-slate-400">{c.f}</td>
                <td className="text-right">{fmt(c.tm)}</td>
                <td className="text-right font-bold tabular-nums" style={{ background: HEAT_BG[hmClass(c.ta)], color: HEAT_TEXT[hmClass(c.ta)] }}>
                  {pct(c.ta)}
                </td>
                <td className="text-right">{pct(c.td)}</td>
                <td className="text-right">{pct(c.tr)}</td>
                <td className="text-right">{pct(c.tb)}</td>
                <td className={`text-right ${tr.cls}`}>{tr.text}</td>
                {YEARS.map((y) => {
                  const v = c.yr[String(y)];
                  return (
                    <td key={y} className="text-right tabular-nums" style={v != null ? { background: HEAT_BG[hmClass(v)], color: HEAT_TEXT[hmClass(v)] } : { color: '#ccc' }}>
                      {v != null ? v.toFixed(1) + '%' : '—'}
                    </td>
                  );
                })}
                <td className="text-center">
                  <span
                    className={`inline-flex min-w-[6.5rem] items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ring-inset ${risk.className}`}
                    aria-label={`${risk.label}, con tasa de aprobación de ${pct(c.ta)}`}
                    title={`Tasa de aprobación: ${pct(c.ta)}`}
                  >
                    <span aria-hidden="true" className="h-2 w-2 rounded-full bg-current" />
                    {risk.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!rows.length && <p className="py-12 text-center text-sm text-slate-400">Sin datos para el filtro seleccionado</p>}
      </div>
      {rows.length > 0 && (
        <TablePagination total={rows.length} page={currentPage} pageSize={pageSize} onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(0); }} itemLabel="escuelas" />
      )}
    </div>
  );
}
