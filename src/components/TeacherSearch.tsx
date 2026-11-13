'use client';

import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { fmt, hmClass, pct, rate } from '@/lib/data-utils';
import type { DashboardDataset } from '@/types/dashboard';
import type { FilterState } from '@/lib/data-utils';

const HEAT_TEXT: Record<string, string> = {
  g6: 'text-emerald-700',
  g5: 'text-emerald-600',
  g4: 'text-amber-600',
  g3: 'text-amber-700',
  g2: 'text-red-600',
  g1: 'text-red-700',
};

export default function TeacherSearch({ dataset, filters }: { dataset: DashboardDataset; filters: FilterState }) {
  const [q, setQ] = useState('');
  const { fs: F, es: E, an: AN, dn: DN, ps: P } = dataset;

  const results = useMemo(() => {
    if (q.trim().length < 3) return null;
    const qu = q.toUpperCase();
    const matches = dataset.dc.filter((r) => {
      if (!DN[r[0]]?.toUpperCase().includes(qu)) return false;
      if (filters.facultad !== 'ALL' && F[r[2]] !== filters.facultad) return false;
      if (filters.escuela !== 'ALL' && E[r[3]] !== filters.escuela) return false;
      return true;
    });
    if (!matches.length) return [];

    type CourseSummary = {
      p: string;
      year: string;
      f: string;
      e: string;
      a: string;
      m: number;
      ap: number;
      d: number;
      ab: number;
      ret: number;
    };
    const byTeacher = new Map<string, Map<string, CourseSummary>>();
    matches.forEach((r) => {
      const name = DN[r[0]];
      let courses = byTeacher.get(name);
      if (!courses) {
        courses = new Map();
        byTeacher.set(name, courses);
      }

      const period = P[r[1]];
      const faculty = F[r[2]];
      const school = E[r[3]];
      const subject = AN[r[4]];
      const key = JSON.stringify([period, faculty, school, subject]);
      let course = courses.get(key);
      if (!course) {
        course = {
          p: period,
          year: period.slice(0, 4),
          f: faculty,
          e: school,
          a: subject,
          m: 0,
          ap: 0,
          d: 0,
          ab: 0,
          ret: 0,
        };
        courses.set(key, course);
      }

      course.m += r[6];
      course.ap += r[7];
      course.d += r[8];
      course.ab += r[9];
      course.ret += r[10];
    });

    return Array.from(byTeacher, ([name, courses]) => {
      const rows = Array.from(courses.values()).sort((a, b) => a.p.localeCompare(b.p) || a.a.localeCompare(b.a));
      const tm = rows.reduce((sum, row) => sum + row.m, 0);
      const ta = rows.reduce((sum, row) => sum + row.ap, 0);
      const td = rows.reduce((sum, row) => sum + row.d, 0);
      const tab = rows.reduce((sum, row) => sum + row.ab, 0);
      const tret = rows.reduce((sum, row) => sum + row.ret, 0);
      const subjects = [...new Set(rows.map((row) => row.a))];
      const locations = [...new Set(rows.map((row) => row.f + (row.e && row.e !== row.f ? ` · ${row.e}` : '')))];
      return {
        name,
        rows,
        tm,
        ta,
        td,
        tab,
        tret,
        gr: rate(ta, tm),
        subjects,
        locations,
      };
    })
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 10);
  }, [q, dataset, filters.facultad, filters.escuela, F, E, AN, DN, P]);

  return (
    <div>
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar docente por apellidos y nombres..."
          className="w-full text-xs border border-slate-300 rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        />
      </div>

      {q.trim().length < 3 && <p className="text-xs text-slate-400 py-4">Ingrese al menos 3 caracteres para buscar.</p>}

      {results !== null && results.length === 0 && (
        <p className="text-xs text-slate-400 py-4">
          Sin resultados{filters.facultad !== 'ALL' || filters.escuela !== 'ALL' ? ' en la facultad/escuela seleccionada' : ''} para &quot;{q}&quot;
        </p>
      )}

      <div className="space-y-5">
        {results?.map((t) => (
          <div key={t.name} className="border-b border-slate-100 pb-4">
            <div className="flex items-start justify-between flex-wrap gap-2 mb-2">
              <div>
                <span className="font-bold text-sm">{t.name}</span>
                <span className="text-[11px] text-slate-400 ml-2">{t.locations.join(' | ')}</span>
              </div>
              <div className="flex gap-1.5 flex-wrap items-center">
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100">Matr.: {fmt(t.tm)}</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100">Aprob.: {fmt(t.ta)}</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100">Desap.: {fmt(t.td)}</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100">Retiros: {fmt(t.tret)}</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100">Abandonos: {fmt(t.tab)}</span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full bg-slate-100 font-semibold ${HEAT_TEXT[hmClass(t.gr)]}`}>
                  Tasa aprob.: {pct(t.gr)}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mb-2">{t.subjects.length} asignatura(s): {t.subjects.slice(0, 4).join(', ')}{t.subjects.length > 4 ? '…' : ''}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] whitespace-nowrap">
                <thead>
                  <tr className="text-slate-400">
                    <th className="text-left px-1 py-1">Año</th>
                    <th className="text-left px-1 py-1">Periodo</th>
                    <th className="text-left px-1 py-1">Escuela</th>
                    <th className="text-left px-1 py-1">Asignatura</th>
                    <th className="text-right px-1 py-1">Matr.</th>
                    <th className="text-right px-1 py-1">Aprob.</th>
                    <th className="text-right px-1 py-1">Desap.</th>
                    <th className="text-right px-1 py-1">Retiros</th>
                    <th className="text-right px-1 py-1">Abandonos</th>
                    <th className="text-right px-1 py-1">Tasa aprob.</th>
                  </tr>
                </thead>
                <tbody>
                  {t.rows.map((r, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-1 py-1">{r.year}</td>
                      <td className="px-1 py-1">{r.p}</td>
                      <td className="px-1 py-1">{r.e}</td>
                      <td className="px-1 py-1">{r.a}</td>
                      <td className="text-right px-1 py-1">{fmt(r.m)}</td>
                      <td className="text-right px-1 py-1">{fmt(r.ap)}</td>
                      <td className="text-right px-1 py-1">{fmt(r.d)}</td>
                      <td className="text-right px-1 py-1">{fmt(r.ret)}</td>
                      <td className="text-right px-1 py-1">{fmt(r.ab)}</td>
                      <td className="text-right px-1 py-1 font-semibold">{pct(rate(r.ap, r.m))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
