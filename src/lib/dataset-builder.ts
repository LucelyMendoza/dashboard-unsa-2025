import { DashboardDataset } from '@/types/dashboard';
import { recomputeDerived } from '@/lib/recompute';
import type { ImportRow } from '@/lib/excelParser';

/**
 * Arma un DashboardDataset (mismo shape que antes vivía en
 * public/data/initialData.json) a partir de filas planas — ya sea las que
 * vienen de D1 (GET /api/dataset) o las recién parseadas de un Excel para
 * previsualización. Reemplaza la mutación manual que antes hacía
 * excelParser.ts directamente sobre el dataset.
 */
export function buildDataset(rows: ImportRow[]): DashboardDataset {
  const fe: Record<string, string[]> = {};
  const ep: Record<string, string[]> = {};
  const ps: string[] = [];
  const fs: string[] = [];
  const es: string[] = [];
  const pr: string[] = [];
  const an: string[] = [];
  const dn: string[] = [];
  const sa: DashboardDataset['sa'] = [];
  const dc: DashboardDataset['dc'] = [];
  const indexes = {
    dn: new Map<string, number>(),
    fs: new Map<string, number>(),
    es: new Map<string, number>(),
    pr: new Map<string, number>(),
    ps: new Map<string, number>(),
    an: new Map<string, number>(),
  };

  const getOrAdd = (list: string[], index: Map<string, number>, val: string) => {
    const v = val?.trim() || '(sin especificar)';
    const existing = index.get(v);
    if (existing !== undefined) return existing;

    const idx = list.length;
    list.push(v);
    index.set(v, idx);
    return idx;
  };

  rows.forEach((row) => {
    const isGeneral = row.facultad === '(SIN CLASIFICAR)' || row.escuela.includes('GENERAL');
    if (isGeneral) return;

    const idDoc = getOrAdd(dn, indexes.dn, row.docente);
    const idFac = getOrAdd(fs, indexes.fs, row.facultad);
    const idEsc = getOrAdd(es, indexes.es, row.escuela);
    const idPro = getOrAdd(pr, indexes.pr, row.programa);
    const idPer = getOrAdd(ps, indexes.ps, row.periodo);
    const idAsi = getOrAdd(an, indexes.an, row.asignatura);

    if (!fe[row.facultad]) fe[row.facultad] = [];
    if (!fe[row.facultad].includes(row.escuela)) fe[row.facultad].push(row.escuela);
    if (!ep[row.escuela]) ep[row.escuela] = [];
    if (row.programa && !ep[row.escuela].includes(row.programa)) ep[row.escuela].push(row.programa);

    sa.push([idPer, idFac, idEsc, idAsi, idPro, row.matriculados, row.aprobados, row.desaprobados, row.abandonos, row.retiros, row.promedio]);
    dc.push([idDoc, idPer, idFac, idEsc, idAsi, idPro, row.matriculados, row.aprobados, row.desaprobados, row.abandonos, row.retiros]);
  });

  const base: DashboardDataset = { fe, ep, ps, fs, es, pr, an, dn, ag: [], sa, dc, sc: [], cd: [] };
  return recomputeDerived(base);
}
