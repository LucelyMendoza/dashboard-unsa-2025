import React, { useState } from 'react';
import { fmt, hmClass, pct, riskEmoji, trendLabel, YEARS } from '@/lib/data-utils';
import type { ScorecardRow } from '@/types/dashboard';
import TablePagination from '@/components/TablePagination';

const HEAT_BG: Record<string, string> = {
  g6: '#e4ece7',
  g5: '#edf1ec',
  g4: '#f2f0e5',
  g3: '#efe6d5',
  g2: '#f0e2dd',
  g1: '#ead5d1',
};

export default function SchoolScorecard({ rows }: { rows: ScorecardRow[] }) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const visibleRows = rows.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="academic-table-shell max-h-[70vh] rounded-none border-0">
      <table className="academic-table min-w-max text-xs whitespace-nowrap">
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
            <th className="text-center">Riesgo</th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((c) => {
            const tr = trendLabel(c.sl);
            return (
              <tr key={c.e}>
                <td className="school-name-cell font-semibold" title={c.e}>{c.e}</td>
                <td className="text-[10px] text-slate-400">{c.f}</td>
                <td className="text-right">{fmt(c.tm)}</td>
                <td className="text-right font-semibold" style={{ background: HEAT_BG[hmClass(c.ta)] }}>
                  {pct(c.ta)}
                </td>
                <td className="text-right">{pct(c.td)}</td>
                <td className="text-right">{pct(c.tr)}</td>
                <td className="text-right">{pct(c.tb)}</td>
                <td className={`text-right ${tr.cls}`}>{tr.text}</td>
                {YEARS.map((y) => {
                  const v = c.yr[String(y)];
                  return (
                    <td key={y} className="text-right" style={v != null ? { background: HEAT_BG[hmClass(v)] } : { color: '#ccc' }}>
                      {v != null ? v.toFixed(1) + '%' : '—'}
                    </td>
                  );
                })}
                <td className="text-center">{riskEmoji(c.ta)}</td>
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
