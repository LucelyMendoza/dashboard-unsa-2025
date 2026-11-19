'use client';

import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { fmt, hmClass, pct, rate } from '@/lib/data-utils';
import type { DashboardDataset } from '@/types/dashboard';
import type { FilterState } from '@/lib/data-utils';
import TablePagination from '@/components/TablePagination';

const HEAT_TEXT: Record<string, string> = {
  g6: 'text-[#42604f]', g5: 'text-[#56705e]', g4: 'text-[#826c43]',
  g3: 'text-[#8b6842]', g2: 'text-[#8a514b]', g1: 'text-[#783e3c]',
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
  const metrics = [
    { label: 'Matriculados', value: fmt(teacher.tm) },
    { label: 'Aprobados', value: fmt(teacher.ta) },
    { label: 'Desaprobados', value: fmt(teacher.td) },
    { label: 'Retiros', value: fmt(teacher.tret) },
    { label: 'Abandonos', value: fmt(teacher.tab) },
    { label: 'Tasa de aprobación', value: pct(teacher.gr), valueClass: HEAT_TEXT[hmClass(teacher.gr)] },
  ];

  return (
    <article className="dashboard-panel teacher-card-enter overflow-hidden transition-shadow hover:shadow-md">
      <div className="px-4 pt-4 sm:px-5 sm:pt-5">
        <div className="min-w-0">
          <h3 className="text-[15px] font-bold tracking-tight text-slate-800">{teacher.name}</h3>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500" title={teacher.locations.join(' · ') || 'Sin facultad o escuela registrada'}>
            {teacher.locations.join(' · ') || 'Sin facultad o escuela registrada'}
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-2 px-4 py-4 sm:grid-cols-3 sm:gap-3 sm:px-5 xl:grid-cols-6">
        {metrics.map((metric) => (
          <div key={metric.label} className="min-w-0 rounded-lg border border-[var(--linea)] bg-[#f7f5f1] px-3 py-3 sm:px-3.5">
            <dt className="min-h-8 text-[10px] font-medium leading-4 text-slate-500 sm:min-h-0">
              {metric.label}
            </dt>
            <dd className={`mt-1 text-base font-semibold tabular-nums ${metric.valueClass ?? 'text-slate-800'}`}>
              {metric.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mx-4 mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 pt-3 text-[11px] text-slate-500 sm:mx-5">
        <span><span className="font-semibold text-slate-700">{teacher.rows.length}</span> registros de curso</span>
        <span><span className="font-semibold text-slate-700">{teacher.subjects.length}</span> asignaturas</span>
        {teacher.subjects.length > 0 && (
          <span className="min-w-0 basis-full truncate sm:basis-auto" title={teacher.subjects.join(', ')}>
            {teacher.subjects.slice(0, 3).join(', ')}{teacher.subjects.length > 3 ? '…' : ''}
          </span>
        )}
      </div>

      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-xs font-semibold text-[var(--accent)] transition-colors hover:bg-[var(--crema)] sm:px-5">
          <span>Ver historial de cursos</span>
          <span className="text-slate-400 transition-transform group-open:rotate-180">⌄</span>
        </summary>
        <div className="border-t border-slate-100">
          <div className="academic-table-shell rounded-none border-0">
            <table className="academic-table animated-table min-w-[980px] text-xs">
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
      const normalizedName = name.trim().toLocaleLowerCase('es').replace(/[()[\]]/g, '').trim();
      if (!normalizedName || ['sin especificar', 'no especificado', 'no especificada'].includes(normalizedName)) return;
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
      <div className="dashboard-panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
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
            className="dashboard-control w-full rounded-lg border py-2 pl-9 pr-3 text-xs outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--linea)]" />
        </div>
      </div>

      {!results.length ? (
        <div className="dashboard-panel border-dashed px-4 py-12 text-center">
          <p className="text-sm font-semibold text-slate-600">No hay docentes para estos filtros</p>
          <p className="mt-1 text-xs text-slate-400">Prueba otra facultad, escuela o búsqueda.</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">{visibleResults.map((teacher) => <TeacherCard key={teacher.name} teacher={teacher} />)}</div>
          <div className="dashboard-panel overflow-hidden">
            <TablePagination total={results.length} page={currentPage} pageSize={pageSize} onPageChange={setPage}
              onPageSizeChange={(size) => { setPageSize(size); setPage(0); }} itemLabel="docentes" />
          </div>
        </>
      )}
    </div>
  );
}
