'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardDataset, UserSession } from '@/types/dashboard';
import { signOut } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase';
import { getSession, clearSession, getRoleScope } from '@/lib/session';
import { getAllowedTabs, canViewTab } from '@/lib/roles';
import type { DashboardTab } from '@/types/dashboard';
import { DEFAULT_FILTERS, FilterState, filterAgg, filterScorecard, groupBy } from '@/lib/data-utils';
import { recomputeDerived } from '@/lib/recompute';
import { STATIC_DATASET_URL } from '@/lib/generated-dataset';
import AdminUploadModal from '@/components/AdminUploadModal';
import TopBar from '@/components/TopBar';
import FiltersBar from '@/components/FiltersBar';
import Tabs, { TabDef } from '@/components/Tabs';
import KpiGrid from '@/components/KpiGrid';
import TrendChart from '@/components/TrendChart';
import GroupedBarChart from '@/components/GroupedBarChart';
import IndicatorCards from '@/components/IndicatorCards';
import SchoolScorecard from '@/components/SchoolScorecard';
import SubjectHeatmap from '@/components/SubjectHeatmap';
import TeacherSearch from '@/components/TeacherSearch';

function applyProgramFilter(dataset: DashboardDataset, facultad: string, escuela: string, programa: string): DashboardDataset {
  if (facultad !== 'CIENCIAS DE LA EDUCACIÓN' || escuela === 'ALL' || programa === 'ALL') {
    return dataset;
  }

  const programIdx = dataset.pr.indexOf(programa);
  if (programIdx === -1) return dataset;

  const sa = dataset.sa.filter((row) => row[4] === programIdx);
  const dc = dataset.dc.filter((row) => row[5] === programIdx);
  return recomputeDerived({ ...dataset, sa, dc });
}

const TABS: TabDef<DashboardTab>[] = [
  { key: 'resumen', label: 'Resumen' },
  { key: 'escuelas', label: 'Escuelas' },
  { key: 'asignaturas', label: 'Asignaturas' },
  { key: 'docentes', label: 'Docentes' },
];

export default function DashboardPage() {
  const router = useRouter();
  // Lazy init: lee la sesión una sola vez al montar (no requiere efecto).
  const [session] = useState<UserSession | null>(() => getSession());
  const [dataset, setDataset] = useState<DashboardDataset | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [datasetRetry, setDatasetRetry] = useState(0);
  // Arranca en la primera pestaña permitida para el rol (cada rol ve sólo las suyas).
  const [tab, setTab] = useState<DashboardTab>(() => {
    const s = getSession();
    const allowed = getAllowedTabs(s?.role ?? 'ADMIN');
    return allowed[0] ?? 'resumen';
  });
  const [filters, setFilters] = useState<FilterState>(() => {
    const s = getSession();
    if (!s) return DEFAULT_FILTERS;
    const scope = getRoleScope(s);
    return { ...DEFAULT_FILTERS, facultad: scope.facultad, escuela: scope.escuela };
  });
  const [subjectMetric, setSubjectMetric] = useState<'apr' | 'des' | 'ret' | 'abn'>('apr');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // 1. Verificar sesión (guard). Sin sesión → login. Es navegación, no setState.
  useEffect(() => {
    if (!session) router.replace('/login');
  }, [session, router]);

  // El dataset precomputado se sirve como archivo estático desde Cloudflare.
  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    const loadDataset = async () => {
      setErrorMsg('');
      try {
        const res = await fetch(STATIC_DATASET_URL, { signal: controller.signal, cache: 'force-cache' });
        if (!res.ok) {
          const responseText = await res.text();
          let message = `El archivo de datos respondió con error ${res.status}.`;
          try {
            const body = JSON.parse(responseText) as { error?: string };
            if (body.error) message = body.error;
          } catch {
            if (responseText) message = `${message} ${responseText.slice(0, 300)}`;
          }
          if (active) setErrorMsg(`No se pudieron cargar los datos. ${message}`);
          return;
        }
        const data = (await res.json()) as DashboardDataset;
        if (active) setDataset(data);
      } catch (err) {
        if (controller.signal.aborted) return;
        if (active) {
          setErrorMsg(
            err instanceof Error
              ? `No se pudieron cargar los datos. ${err.message}`
              : 'No se pudieron cargar los datos. Comprueba tu conexión e inténtalo de nuevo.'
          );
        }
      }
    };

    void loadDataset();
    return () => {
      active = false;
      controller.abort();
    };
  }, [datasetRetry]);

  const handleLogout = async () => {
    // 1. Borra la sesión local (localStorage).
    clearSession();
    // 2. Cierra sesión en Firebase/Google de verdad, para que el listener
    //    onAuthStateChanged del login NO recreé la sesión automáticamente
    //    y se vuelva a pedir acceso con Google.
    try {
      await signOut(firebaseAuth);
    } catch {
      // Si falla el signOut de Firebase, igualmente borramos la sesión local
      // y mandamos al login; el usuario podrá reintentar.
    }
    router.replace('/login');
  };

  const scope = session ? getRoleScope(session) : null;
  // Pestañas que este rol puede ver (las demás se ocultan de la barra).
  const visibleTabs = useMemo(
    () => (session ? TABS.filter((t) => canViewTab(session.role, t.key)) : TABS),
    [session]
  );
  // Defensa en profundidad: si por algún motivo la pestaña activa no está
  // permitida para el rol, no renderizamos su contenido.
  const currentTabAllowed = session ? canViewTab(session.role, tab) : false;

  const viewDataset = useMemo(
    () => (dataset ? applyProgramFilter(dataset, filters.facultad, filters.escuela, filters.programa) : null),
    [dataset, filters.facultad, filters.escuela, filters.programa]
  );
  const filteredAgg = useMemo(
    () =>
      viewDataset
        ? filterAgg(viewDataset.ag, {
            facultad: filters.facultad,
            escuela: filters.escuela,
            anio: filters.anio,
            periodo: filters.periodo,
          })
        : [],
    [viewDataset, filters.facultad, filters.escuela, filters.anio, filters.periodo]
  );
  const groups = useMemo(
    () => (viewDataset ? groupBy(filteredAgg, filters.agrupacion === 'sem' ? (r) => r.PERIODO : (r) => String(r.AÑO)) : []),
    [viewDataset, filteredAgg, filters.agrupacion]
  );
  const scorecardRows = useMemo(
    () => (viewDataset ? filterScorecard(viewDataset.sc, filters.facultad, filters.escuela) : []),
    [viewDataset, filters.facultad, filters.escuela]
  );
  const chScope = filters.facultad === 'ALL' ? 'UNSA' : filters.facultad;

  if (errorMsg) {
    return (
      <div className="p-8 text-center text-red-600 bg-red-50 rounded-lg max-w-lg mx-auto mt-10 border border-red-200">
        <p className="font-bold text-sm">{errorMsg}</p>
        <button
          type="button"
          onClick={() => {
            setDataset(null);
            setDatasetRetry((attempt) => attempt + 1);
          }}
          className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (!dataset || !session || !scope) {
    return <div className="p-8 text-center text-xs text-slate-500 font-medium">Cargando datos del sistema...</div>;
  }

  const mobileFilters = (
    <div className="space-y-3">
      <FiltersBar
        dataset={dataset}
        filters={filters}
        onChange={(next) => {
          setFilters(next);
          setMobileMenuOpen(false);
        }}
        scope={scope}
      />
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 pt-16 md:pt-6 space-y-5 w-full">
      <TopBar
        session={session}
        onLogout={handleLogout}
        mobileOpen={mobileMenuOpen}
        onToggleMobile={() => setMobileMenuOpen((v) => !v)}
        mobileFilters={mobileFilters}
        adminAction={
          session.role === 'ADMIN' && process.env.NODE_ENV === 'development'
            ? <AdminUploadModal />
            : undefined
        }
      />

      <div className="hidden md:block">
        <FiltersBar dataset={dataset} filters={filters} onChange={setFilters} scope={scope} />
      </div>

      <Tabs
        tabs={visibleTabs}
        active={tab}
        onChange={(k) => {
          setTab(k as DashboardTab);
          setMobileMenuOpen(false);
        }}
      />

      {currentTabAllowed && tab === 'resumen' && (
        <div className="space-y-5">
          <KpiGrid groups={groups} />

          <div className="grid grid-cols-1 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 w-full">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-[var(--ink)]">Evolución de Tasas</h3>
                <span className="text-[11px] text-slate-400">
                  {chScope}
                  {filters.escuela !== 'ALL' ? ` / ${filters.escuela}` : ''}
                </span>
              </div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Indicador</label>
                <select
                  value={filters.indicador}
                  onChange={(e) => setFilters({ ...filters, indicador: e.target.value as typeof filters.indicador })}
                  className="text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-slate-50"
                >
                  <option value="apr">Aprobados</option>
                  <option value="des">Desaprobados</option>
                  <option value="ret">Retiro</option>
                  <option value="abn">Abandono</option>
                  <option value="all">Todas</option>
                </select>
              </div>
              <TrendChart groups={groups} indicador={filters.indicador} />
              {filters.indicador === 'all' && (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold text-[var(--ink)]">Desglose en barras</h4>
                    <span className="text-[11px] text-slate-400">Aprobados, desaprobados, retiro y abandono</span>
                  </div>
                  <GroupedBarChart groups={groups} />
                </div>
              )}
            </div>
          </div>

          <IndicatorCards groups={groups} />
        </div>
      )}

      {currentTabAllowed && tab === 'escuelas' && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="text-sm font-bold text-[var(--ink)] mb-3">Scorecard por escuela</h3>
          <SchoolScorecard rows={scorecardRows} />
        </div>
      )}

      {currentTabAllowed && tab === 'asignaturas' && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h3 className="text-sm font-bold text-[var(--ink)]">Resultados por asignatura y periodo</h3>
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Estado</label>
              <select
                value={subjectMetric}
                onChange={(e) => setSubjectMetric(e.target.value as typeof subjectMetric)}
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-slate-50"
              >
                <option value="apr">Aprobados</option>
                <option value="des">Desaprobados</option>
                <option value="ret">Retiro</option>
                <option value="abn">Abandono</option>
              </select>
            </div>
          </div>
          <SubjectHeatmap dataset={viewDataset ?? dataset} filters={filters} metric={subjectMetric} />
        </div>
      )}

      {currentTabAllowed && tab === 'docentes' && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="text-sm font-bold text-[var(--ink)] mb-3">Buscador de docentes</h3>
          <TeacherSearch dataset={viewDataset ?? dataset} filters={filters} />
        </div>
      )}
    </div>
  );
}
