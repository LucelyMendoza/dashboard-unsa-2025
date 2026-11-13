import React from 'react';
import { fmt, hmClass, pct, riskEmoji, trendLabel, YEARS } from '@/lib/data-utils';
import type { ScorecardRow } from '@/types/dashboard';

const HEAT_BG: Record<string, string> = {
  g6: '#dcfce7',
  g5: '#f0fdf4',
  g4: '#fefce8',
  g3: '#fef3c7',
  g2: '#fee2e2',
  g1: '#fecaca',
};

export default function SchoolScorecard({ rows }: { rows: ScorecardRow[] }) {
  return (
    <div className="academic-table-shell">
      <table className="academic-table text-[11px] whitespace-nowrap">
        <thead>
          <tr>
            <th className="text-left">Escuela</th>
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
          {rows.map((c) => {
            const tr = trendLabel(c.sl);
            return (
              <tr key={c.e}>
                <td className="font-semibold">{c.e}</td>
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
      {!rows.length && <p className="text-center text-slate-400 text-xs py-8">Sin datos para el filtro seleccionado</p>}
    </div>
  );
}
