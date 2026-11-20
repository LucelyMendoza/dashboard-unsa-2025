'use client';

import React, { useMemo, useState } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import '@/lib/chart-setup';
import { fmt, rate } from '@/lib/data-utils';
import { AREA_CHART_COLORS, getFacultyChartColor, INDICATOR_CHART_COLORS } from '@/lib/chart-colors';
import { getChartAnimationDuration } from '@/lib/chart-motion';
import { areaDeFacultad } from '@/lib/school-catalog';
import type { AcademicArea } from '@/lib/school-catalog';
import type { AggregatedRow } from '@/types/dashboard';

type Metric = 'apr' | 'des' | 'ret' | 'abn';
type ViewMode = 'combined' | 'areas' | 'bars' | 'faculties' | 'heatmap' | 'all';
type Counts = { m: number; apr: number; des: number; ret: number; abn: number };
type SchoolData = { faculty: string; school: string; periods: Record<string, Counts> };
type SchoolIdentity = { faculty: string; school: string };
type AreaLabel = AcademicArea | 'Sin clasificar';

const METRICS: Record<Metric, { label: string; color: string; field: keyof Counts }> = {
  apr: { label: 'Aprobados', color: INDICATOR_CHART_COLORS.apr, field: 'apr' },
  des: { label: 'Desaprobados', color: INDICATOR_CHART_COLORS.des, field: 'des' },
  ret: { label: 'Retiros', color: INDICATOR_CHART_COLORS.ret, field: 'ret' },
  abn: { label: 'Abandonos', color: INDICATOR_CHART_COLORS.abn, field: 'abn' },
};

const SCHOOL_COLORS = ['#672631', '#15986b', '#347fc1', '#d94f57', '#866b3d', '#7353a6', '#18898a', '#b56826'];
const AREA_ORDER: AreaLabel[] = ['Sociales', 'Ingenierías', 'Biomédicas', 'Sin clasificar'];

function getRate(counts: Counts | undefined, metric: Metric): number | null {
  if (!counts || counts.m === 0) return null;
  return rate(counts[METRICS[metric].field], counts.m);
}

function periodLabel(period: string, grouping: 'sem' | 'anio') {
  if (grouping === 'anio') return period;
  const [year, semester] = period.split('-');
  return `${year} · Semestre ${semester}`;
}

function heatColor(value: number | null, metric: Metric) {
  if (value === null) return { backgroundColor: '#f3f1ed', color: '#858078' };
  const favorable = metric === 'apr'
    ? value >= 80
      ? 'high'
      : value >= 60
        ? 'medium'
        : 'low'
    : value <= (metric === 'des' ? 10 : 5)
      ? 'high'
      : value <= (metric === 'des' ? 25 : 15)
        ? 'medium'
        : 'low';
  if (favorable === 'high') return { backgroundColor: '#c6efd2', color: '#174b2d' };
  if (favorable === 'medium') return { backgroundColor: '#fff0a6', color: '#624800' };
  return { backgroundColor: '#f4b2ae', color: '#702321' };
}

function buildViewData(
  rows: AggregatedRow[],
  schoolIdentities: SchoolIdentity[],
  periods: string[],
  grouping: 'sem' | 'anio'
) {
  const schools = new Map<string, SchoolData>(
    schoolIdentities.map((identity) => [
      JSON.stringify([identity.faculty, identity.school]),
      { ...identity, periods: {} },
    ])
  );

  rows.forEach((row) => {
    const period = grouping === 'sem' ? row.PERIODO : String(row.AÑO);
    const schoolKey = JSON.stringify([row.FACULTAD, row.ESCUELA]);
    let school = schools.get(schoolKey);
    if (!school) {
      school = { faculty: row.FACULTAD, school: row.ESCUELA, periods: {} };
      schools.set(schoolKey, school);
    }

    const counts = school.periods[period] ?? { m: 0, apr: 0, des: 0, ret: 0, abn: 0 };
    counts.m += row.m;
    counts.apr += row.a;
    counts.des += row.d;
    counts.ret += row.r;
    counts.abn += row.b;
    school.periods[period] = counts;
  });

  return {
    periods,
    schools: [...schools.values()],
  };
}

function SchoolBars({ schools, metric }: { schools: SchoolData[]; metric: Metric }) {
  const metricInfo = METRICS[metric];
  const rankedSchools = schools
    .map((school) => {
      const total = Object.values(school.periods).reduce(
        (sum, counts) => ({
          m: sum.m + counts.m,
          apr: sum.apr + counts.apr,
          des: sum.des + counts.des,
          ret: sum.ret + counts.ret,
          abn: sum.abn + counts.abn,
        }),
        { m: 0, apr: 0, des: 0, ret: 0, abn: 0 }
      );
      return { school, value: getRate(total, metric) };
    })
    .sort((a, b) => (a.value ?? -1) - (b.value ?? -1) || a.school.school.localeCompare(b.school.school));

  const height = Math.max(300, Math.min(780, rankedSchools.length * 28 + 80));
  const faculties = [...new Set(rankedSchools.map(({ school }) => school.faculty))].sort((a, b) => a.localeCompare(b));

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1" role="list" aria-label="Leyenda de colores por facultad">
        {faculties.map((faculty) => (
          <span key={faculty} role="listitem" className="inline-flex max-w-full items-center gap-1.5 text-[10px] text-slate-600">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: getFacultyChartColor(faculty) }} aria-hidden="true" />
            <span className="max-w-[16rem] truncate" title={faculty}>{faculty}</span>
          </span>
        ))}
      </div>
      <div className="max-h-[820px] overflow-auto rounded-lg border border-[var(--linea)] p-2">
        <div style={{ height }}>
          <Bar
            data={{
              labels: rankedSchools.map(({ school }) => `${school.faculty} · ${school.school}`),
              datasets: [{
                label: `Tasa de ${metricInfo.label.toLocaleLowerCase('es')}`,
                data: rankedSchools.map(({ value }) => value),
                backgroundColor: rankedSchools.map(({ school }) => getFacultyChartColor(school.faculty)),
                borderRadius: 4,
                borderSkipped: false,
              }],
            }}
            options={{
              indexAxis: 'y',
              responsive: true,
              maintainAspectRatio: false,
              animation: { duration: getChartAnimationDuration(), easing: 'easeOutQuart' },
              scales: {
                x: { beginAtZero: true, max: 100, ticks: { callback: (value) => `${value}%` } },
                y: { grid: { display: false }, ticks: { autoSkip: false, font: { size: 10 } } },
              },
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: (context) => `${metricInfo.label}: ${Number(context.parsed.x).toFixed(2)}%`,
                  },
                },
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}

function AreaComparison({
  schools,
  periods,
  metric,
  grouping,
}: {
  schools: SchoolData[];
  periods: string[];
  metric: Metric;
  grouping: 'sem' | 'anio';
}) {
  const areaCounts = new Map<AreaLabel, Record<string, Counts>>();

  schools.forEach((school) => {
    const area = areaDeFacultad(school.faculty) ?? 'Sin clasificar';
    const countsByPeriod = areaCounts.get(area) ?? {};
    periods.forEach((period) => {
      const schoolCounts = school.periods[period];
      if (!schoolCounts) return;
      const counts = countsByPeriod[period] ?? { m: 0, apr: 0, des: 0, ret: 0, abn: 0 };
      counts.m += schoolCounts.m;
      counts.apr += schoolCounts.apr;
      counts.des += schoolCounts.des;
      counts.ret += schoolCounts.ret;
      counts.abn += schoolCounts.abn;
      countsByPeriod[period] = counts;
    });
    areaCounts.set(area, countsByPeriod);
  });

  const areas = AREA_ORDER.filter((area) => areaCounts.has(area));
  const unclassifiedFaculties = [...new Set(
    schools.filter((school) => areaDeFacultad(school.faculty) === null).map((school) => school.faculty)
  )].sort((a, b) => a.localeCompare(b));
  const metricInfo = METRICS[metric];

  return (
    <section className="dashboard-panel p-3 sm:p-4">
      <div className="mb-3">
        <h4 className="text-xs font-bold text-[var(--ink)]">Tendencia comparativa por áreas</h4>
        <p className="mt-1 text-[10px] text-slate-500">
          Tasas ponderadas: se suman los resultados y matrículas de las escuelas del área; no se promedian sus porcentajes.
        </p>
      </div>
      <div className="h-72 sm:h-80">
        <Line
          data={{
            labels: periods.map((period) => periodLabel(period, grouping)),
            datasets: areas.map((area) => ({
              label: area,
              data: periods.map((period) => getRate(areaCounts.get(area)?.[period], metric)),
              borderColor: AREA_CHART_COLORS[area],
              backgroundColor: AREA_CHART_COLORS[area] + '22',
              tension: 0.25,
              pointRadius: 3,
              pointHoverRadius: 6,
              borderWidth: 3,
              spanGaps: false,
            })),
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: getChartAnimationDuration(), easing: 'easeOutQuart' },
            scales: {
              y: { beginAtZero: true, max: 100, ticks: { callback: (value) => `${value}%` } },
              x: { grid: { display: false } },
            },
            plugins: {
              legend: {
                position: 'bottom',
                labels: { boxWidth: 12, padding: 12, font: { size: 10 } },
              },
              tooltip: {
                callbacks: {
                  label: (context) => `${context.dataset.label} · ${metricInfo.label}: ${Number(context.parsed.y).toFixed(2)}%`,
                },
              },
            },
          }}
        />
      </div>
      {unclassifiedFaculties.length > 0 && (
        <p className="mt-3 rounded-lg border border-[#e0b83f] bg-[#fff9e8] px-3 py-2 text-[10px] leading-relaxed text-[#624800]">
          Facultades sin área asignada, mostradas por separado: {unclassifiedFaculties.join(', ')}.
        </p>
      )}
    </section>
  );
}

function FacultyPanels({
  schools,
  periods,
  metric,
  grouping,
}: {
  schools: SchoolData[];
  periods: string[];
  metric: Metric;
  grouping: 'sem' | 'anio';
}) {
  const faculties = [...new Set(schools.map((school) => school.faculty))].sort((a, b) => a.localeCompare(b));
  const metricInfo = METRICS[metric];

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
      {faculties.map((faculty) => {
        const facultySchools = schools
          .filter((school) => school.faculty === faculty)
          .sort((a, b) => a.school.localeCompare(b.school));
        return (
          <section key={faculty} className="min-w-0 rounded-lg border border-[var(--linea)] bg-white p-3">
            <h4 className="mb-2 truncate text-xs font-bold text-[var(--ink)]" title={faculty}>{faculty}</h4>
            <div className="h-64">
              <Line
                data={{
                  labels: periods.map((period) => periodLabel(period, grouping)),
                  datasets: facultySchools.map((school, index) => ({
                    label: school.school,
                    data: periods.map((period) => getRate(school.periods[period], metric)),
                    borderColor: SCHOOL_COLORS[index % SCHOOL_COLORS.length],
                    backgroundColor: SCHOOL_COLORS[index % SCHOOL_COLORS.length] + '22',
                    tension: 0.25,
                    pointRadius: 2,
                    pointHoverRadius: 5,
                    borderWidth: 2,
                    spanGaps: false,
                  })),
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  animation: { duration: getChartAnimationDuration(), easing: 'easeOutQuart' },
                  scales: {
                    y: { beginAtZero: true, max: 100, ticks: { callback: (value) => `${value}%` } },
                    x: { grid: { display: false } },
                  },
                  plugins: {
                    legend: {
                      position: 'bottom',
                      labels: { boxWidth: 10, padding: 8, font: { size: 9 } },
                    },
                    tooltip: {
                      callbacks: {
                        label: (context) => `${context.dataset.label}: ${Number(context.parsed.y).toFixed(2)}%`,
                      },
                    },
                  },
                }}
              />
            </div>
            <p className="mt-1 text-[10px] text-slate-500">
              Evolución de {metricInfo.label.toLocaleLowerCase('es')} por escuela
            </p>
          </section>
        );
      })}
    </div>
  );
}

function SchoolHeatmap({
  schools,
  periods,
  metric,
  grouping,
}: {
  schools: SchoolData[];
  periods: string[];
  metric: Metric;
  grouping: 'sem' | 'anio';
}) {
  const sortedSchools = [...schools].sort(
    (a, b) => a.faculty.localeCompare(b.faculty) || a.school.localeCompare(b.school)
  );

  return (
    <div className="max-h-[70vh] overflow-auto rounded-lg border border-[var(--linea)]">
      <table className="min-w-max border-separate border-spacing-0 text-[10px]">
        <thead className="sticky top-0 z-10 bg-[#f7f5f1]">
          <tr>
            <th className="sticky left-0 z-20 min-w-48 border-b border-r border-[var(--linea)] bg-[#f7f5f1] px-3 py-2 text-left">Facultad · Escuela</th>
            {periods.map((period) => (
              <th key={period} className="min-w-20 border-b border-[var(--linea)] px-2 py-2 text-center">
                {periodLabel(period, grouping)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedSchools.map((school) => (
            <tr key={`${school.faculty}-${school.school}`}>
              <th
                scope="row"
                className="sticky left-0 z-[1] max-w-64 border-b border-r border-[var(--linea)] bg-[var(--papel)] px-3 py-2 text-left font-medium"
                title={`${school.faculty} · ${school.school}`}
              >
                <span className="block truncate text-[9px] text-slate-500">{school.faculty}</span>
                <span className="block truncate text-slate-700">{school.school}</span>
              </th>
              {periods.map((period) => {
                const value = getRate(school.periods[period], metric);
                return (
                  <td
                    key={period}
                    className="border-b border-[var(--linea)] px-2 py-2 text-center font-semibold tabular-nums"
                    style={heatColor(value, metric)}
                    title={`${school.faculty} · ${school.school} · ${periodLabel(period, grouping)} · ${value === null ? 'Sin datos' : `${value.toFixed(2)}%`}`}
                  >
                    {value === null ? '—' : `${value.toFixed(1)}%`}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SchoolComparison({
  rows,
  schools: schoolIdentities,
  periods: selectedPeriods,
  grouping,
}: {
  rows: AggregatedRow[];
  schools: SchoolIdentity[];
  periods: string[];
  grouping: 'sem' | 'anio';
}) {
  const [view, setView] = useState<ViewMode>('combined');
  const [metric, setMetric] = useState<Metric>('apr');
  const { periods, schools } = useMemo(
    () => buildViewData(rows, schoolIdentities, selectedPeriods, grouping),
    [rows, schoolIdentities, selectedPeriods, grouping]
  );

  if (schools.length === 0) {
    return <p className="py-8 text-center text-xs text-slate-500">Sin datos para comparar con los filtros seleccionados.</p>;
  }

  const missingBySchool = schools
    .map((school) => ({
      ...school,
      missingPeriods: periods.filter((period) => {
        const counts = school.periods[period];
        return !counts || counts.m === 0;
      }),
    }))
    .filter((school) => school.missingPeriods.length > 0);
  const showAreas = view === 'combined' || view === 'areas' || view === 'all';
  const showBars = view === 'combined' || view === 'bars' || view === 'all';
  const showFaculties = view === 'combined' || view === 'faculties' || view === 'all';
  const showHeatmap = view === 'heatmap' || view === 'all';

  return (
    <section className="dashboard-panel p-3 sm:p-4">
      <div className="mb-3 flex flex-col gap-3 border-b border-[var(--linea)] pb-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-sm font-bold text-[var(--ink)]">Comparación por facultad y escuela</h3>
          <p className="mt-1 text-[10px] text-slate-500">
            Las tasas se calculan con los matriculados de las selecciones y periodos aplicados.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="text-[10px] font-semibold text-slate-600">
            Vista
            <select
              aria-label="Vista de comparación"
              value={view}
              onChange={(event) => setView(event.target.value as ViewMode)}
              className="dashboard-control mt-1 min-h-9 w-full rounded-lg border px-2.5 py-2 text-xs"
            >
              <option value="combined">Áreas, tendencias por facultad y escuelas</option>
              <option value="areas">Comparación por áreas</option>
              <option value="bars">Barras comparativas por escuela</option>
              <option value="faculties">Paneles de tendencias por facultad</option>
              <option value="all">Vista completa: todos los gráficos</option>
            </select>
          </label>
          <label className="text-[10px] font-semibold text-slate-600">
            Indicador comparado
            <select
              aria-label="Indicador de comparación"
              value={metric}
              onChange={(event) => setMetric(event.target.value as Metric)}
              className="dashboard-control mt-1 min-h-9 w-full rounded-lg border px-2.5 py-2 text-xs"
            >
              {Object.entries(METRICS).map(([key, info]) => (
                <option key={key} value={key}>{info.label}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <p className="mb-3 rounded-lg bg-[#f7f5f1] px-3 py-2 text-[10px] leading-relaxed text-slate-600">
        {view === 'bars' && 'Ordenadas de menor a mayor tasa para identificar rápidamente las escuelas que requieren atención. Cada barra identifica facultad y escuela.'}
        {view === 'faculties' && 'Cada panel muestra la evolución por periodo de las escuelas de una facultad; colores distintos identifican cada escuela dentro del panel.'}
        {view === 'heatmap' && 'Cada celda muestra la tasa de una escuela en un periodo. Verde indica un resultado favorable y rojo uno que requiere atención; el criterio depende del indicador.'}
        {view === 'areas' && 'Compara la evolución del indicador entre Sociales, Ingenierías y Biomédicas para los filtros seleccionados.'}
        {view === 'combined' && 'Se muestran primero las áreas, luego las tendencias por facultad y finalmente las barras comparativas por escuela.'}
      </p>

      {missingBySchool.length > 0 && (
        <aside
          aria-label="Cobertura de datos por escuela"
          className="mb-4 rounded-lg border border-[#e0b83f] bg-[#fff9e8] px-3 py-2.5 text-[10px] leading-relaxed text-[#624800]"
        >
          <p className="font-bold">
            Hay {fmt(missingBySchool.reduce((total, school) => total + school.missingPeriods.length, 0))} combinaciones escuela-periodo sin matrícula registrada en los datos actuales.
            Se muestran como «Sin datos», no como 0%.
          </p>
          <ul className="mt-1 list-inside list-disc">
            {missingBySchool.slice(0, 6).map((school) => (
              <li key={`${school.faculty}-${school.school}`}>
                {school.faculty} · {school.school}: {school.missingPeriods.map((period) => periodLabel(period, grouping)).join(', ')}
              </li>
            ))}
            {missingBySchool.length > 6 && <li>y {fmt(missingBySchool.length - 6)} escuelas más.</li>}
          </ul>
        </aside>
      )}

      <div className="space-y-5">
        {showAreas && (
          <section>
            {(view === 'combined' || view === 'all') && <h4 className="mb-2 text-xs font-bold text-slate-700">1. Comparación por áreas</h4>}
            <AreaComparison schools={schools} periods={periods} metric={metric} grouping={grouping} />
          </section>
        )}
        {showFaculties && (
          <section>
            {(view === 'combined' || view === 'all') && <h4 className="mb-2 text-xs font-bold text-slate-700">2. Tendencias por facultad</h4>}
            <FacultyPanels schools={schools} periods={periods} metric={metric} grouping={grouping} />
          </section>
        )}
        {showBars && (
          <section>
            {(view === 'combined' || view === 'all') && <h4 className="mb-2 text-xs font-bold text-slate-700">3. Comparación de escuelas</h4>}
            <SchoolBars schools={schools} metric={metric} />
          </section>
        )}
      </div>

      <p className="mt-3 text-[10px] text-slate-500">
        Resultado mostrado: {schools.length ? fmt(schools.length) : '0'} escuelas en {fmt(new Set(schools.map((school) => school.faculty)).size)} facultades · {fmt(periods.length)} {grouping === 'sem' ? 'periodos semestrales' : 'años'}.
      </p>
    </section>
  );
}
