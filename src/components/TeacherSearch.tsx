'use client';

import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { fmt, hmClass, pct, rate } from '@/lib/data-utils';
import type { DashboardDataset } from '@/types/dashboard';
import type { FilterState } from '@/lib/data-utils';
import TablePagination from '@/components/TablePagination';

const HEAT_TEXT: Record<string, string> = {
  g6: 'text-emerald-700', g5: 'text-emerald-600', g4: 'text-amber-600',
  g3: 'text-amber-700', g2: 'text-red-600', g1: 'text-red-700',
};

type CourseSummary = {
  p: string; year: string; f: string; e: string; code: string; a: string;
  m: number; ap: number; d: number; ab: number; ret: number;
};

type TeacherSummary = {
  name: string; rows: CourseSummary[]; tm: number; ta: number; td: number;
  tab: number; tret: number; gr: number; subjects: string[]; locations: string[];
};

function TeacherCard({ teacher }: { teacher: TeacherSummary }) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const pageCount = Math.max(1, Math.ceil(teacher.rows.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const visibleRows = teacher.rows.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold tracking-tight text-slate-800">{teacher.name}</h3>
            <p className="mt-1 text-xs text-slate-500">{teacher.locations.join(' · ') || 'Sin facultad o escuela registrada'}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
            {[
              ['Matriculados', teacher.tm], ['Aprobados', teacher.ta], ['Desaprobados', teacher.td],
              ['Retiros', teacher.tret], ['Abandonos', teacher.tab], ['Tasa aprob.', pct(teacher.gr)],
            ].map(([label, value]) => (
              <div key={String(label)} className="min-w-[92px] rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
                <p className={`mt-0.5 text-sm font-semibold tabular-nums ${label === 'Tasa aprob.' ? HEAT_TEXT[hmClass(teacher.gr)] : 'text-slate-800'}`}>
                  {typeof value === 'number' ? fmt(value) : value}
                </p>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-3 text-[11px] text-slate-500">
          <span className="font-semibold text-slate-700">{teacher.rows.length}</span> registros de curso
          <span className="mx-2 text-slate-300">|</span>
          <span className="font-semibold text-slate-700">{teacher.subjects.length}</span> asignaturas
          {teacher.subjects.length > 0 && <span className="ml-1">· {teacher.subjects.slice(0, 3).join(', ')}{teacher.subjects.length > 3 ? '…' : ''}</span>}
        </p>
      </div>

      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-xs font-semibold text-[var(--accent)] hover:bg-red-50/50 sm:px-5">
          <span>Ver historial de cursos</span>
          <span className="text-slate-400 transition-transform group-open:rotate-180">⌄</span>
        </summary>
        <div className="border-t border-slate-100">
          <div className="academic-table-shell rounded-none border-0">
            <table className="academic-table min-w-[980px] text-xs">
              <thead><tr>
                <th className="text-left">Año</th><th className="text-left">Periodo</th>
                <th className="text-left">Escuela</th><th className="text-left">Código</th>
                <th className="text-left">Asignatura</th><th className="text-right">Matr.</th>
                <th className="text-right">Aprob.</th><th className="text-right">Desap.</th>
                <th className="text-right">Retiros</th><th className="text-right">Abandonos</th>
                <th className="text-right">Tasa aprob.</th>
              </tr></thead>
              <tbody>{visibleRows.map((row, index) => (
                <tr key={`${row.p}-${row.e}-${row.code}-${row.a}-${index}`}>
                  <td>{row.year}</td><td>{row.p}</td><td>{row.e}</td>
                  <td className="font-mono text-slate-500">{row.code || '—'}</td>
                  <td className="max-w-[320px] truncate font-medium text-slate-700" title={row.a}>{row.a}</td>
                  <td className="text-right tabular-nums">{fmt(row.m)}</td><td className="text-right tabular-nums">{fmt(row.ap)}</td>
                  <td className="text-right tabular-nums">{fmt(row.d)}</td><td className="text-right tabular-nums">{fmt(row.ret)}</td>
                  <td className="text-right tabular-nums">{fmt(row.ab)}</td>
                  <td className={`text-right font-semibold tabular-nums ${HEAT_TEXT[hmClass(rate(row.ap, row.m))]}`}>{pct(rate(row.ap, row.m))}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          {pageCount > 1 && (
            <TablePagination
              total={teacher.rows.length} page={currentPage} pageSize={pageSize}
              onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(0); }} itemLabel="cursos"
            />
          )}
        </div>
      </details>
    </article>
  );
}

export default function TeacherSearch({ dataset, filters }: { dataset: DashboardDataset; filters: FilterState }) {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const { fs: F, es: E, an: AN, ac: AC, dn: DN, ps: P } = dataset;

  const results = useMemo(() => {
    const byTeacher = new Map<string, Map<string, CourseSummary>>();
    dataset.dc.forEach((row) => {
      const name = DN[row[0]] ?? '';
      if (!name.trim()) return;
      if (filters.facultad !== 'ALL' && F[row[2]] !== filters.facultad) return;
      if (filters.escuela !== 'ALL' && E[row[3]] !== filters.escuela) return;
      if (q.trim() && !name.toLocaleLowerCase('es').includes(q.trim().toLocaleLowerCase('es'))) return;

      let courses = byTeacher.get(name);
      if (!courses) { courses = new Map(); byTeacher.set(name, courses); }
      const period = P[row[1]] ?? '';
      const faculty = F[row[2]] ?? '';
      const school = E[row[3]] ?? '';
      const subject = AN[row[4]] ?? '';
      const code = AC[row[4]] ?? '';
      const key = JSON.stringify([period, faculty, school, code, subject]);
      let course = courses.get(key);
      if (!course) {
        course = { p: period, year: period.slice(0, 4), f: faculty, e: school, code, a: subject, m: 0, ap: 0, d: 0, ab: 0, ret: 0 };
        courses.set(key, course);
      }
      course.m += row[6]; course.ap += row[7]; course.d += row[8]; course.ab += row[9]; course.ret += row[10];
    });

    return Array.from(byTeacher, ([name, courses]) => {
      const rows = Array.from(courses.values()).sort((a, b) => b.p.localeCompare(a.p) || a.a.localeCompare(b.a));
      const tm = rows.reduce((sum, row) => sum + row.m, 0);
      const ta = rows.reduce((sum, row) => sum + row.ap, 0);
      const subjects = [...new Set(rows.map((row) => `${row.code} ${row.a}`.trim()))];
      const locations = [...new Set(rows.map((row) => row.f + (row.e && row.e !== row.f ? ` · ${row.e}` : '')))];
      return {
        name, rows, tm, ta,
        td: rows.reduce((sum, row) => sum + row.d, 0),
        tab: rows.reduce((sum, row) => sum + row.ab, 0),
        tret: rows.reduce((sum, row) => sum + row.ret, 0),
        gr: rate(ta, tm), subjects, locations,
      };
    }).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [q, dataset.dc, filters.facultad, filters.escuela, F, E, AN, AC, DN, P]);

  const pageCount = Math.max(1, Math.ceil(results.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const visibleResults = results.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-800">Directorio de docentes</h2>
          <p className="mt-1 text-xs text-slate-500">
            {filters.facultad === 'ALL' ? 'Todas las facultades' : filters.facultad}
            {filters.escuela !== 'ALL' ? ` · ${filters.escuela}` : ''}
            {' · '}{fmt(results.length)} docentes
          </p>
        </div>
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
          <input value={q} onChange={(event) => { setQ(event.target.value); setPage(0); }}
            placeholder="Buscar docente por nombre..." aria-label="Buscar docente por nombre"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs outline-none transition focus:border-[var(--accent)] focus:bg-white focus:ring-2 focus:ring-red-100" />
        </div>
      </div>

      {!results.length ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-12 text-center">
          <p className="text-sm font-semibold text-slate-600">No hay docentes para estos filtros</p>
          <p className="mt-1 text-xs text-slate-400">Prueba otra facultad, escuela o búsqueda.</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">{visibleResults.map((teacher) => <TeacherCard key={teacher.name} teacher={teacher} />)}</div>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <TablePagination total={results.length} page={currentPage} pageSize={pageSize} onPageChange={setPage}
              onPageSizeChange={(size) => { setPageSize(size); setPage(0); }} itemLabel="docentes" />
          </div>
        </>
      )}
    </div>
  );
}
