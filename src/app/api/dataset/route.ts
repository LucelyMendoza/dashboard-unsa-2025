import { getCloudflareContext } from '@opennextjs/cloudflare';
import { buildDataset } from '@/lib/dataset-builder';
import type { ImportRow } from '@/lib/excelParser';

interface DbRow {
  periodo: string;
  anio: number;
  facultad: string;
  escuela: string;
  programa: string;
  codigo: string;
  cod_asig?: string;
  digito?: string;
  nro?: string;
  asignatura: string;
  grupo: string;
  docente: string;
  matriculados: number;
  aprobados: number;
  desaprobados: number;
  abandonos: number;
  retiros: number;
  promedio: number;
}

type AppEnv = CloudflareEnv & { DB?: D1Database };

/**
 * GET público (requiere sesión válida, verificada igual que en login — no
 * expone nada por rol acá; el filtrado por facultad/escuela del DECANO/
 * DIRECTOR se sigue aplicando en el cliente como antes, vía getRoleScope).
 * Sustituye a fetch('/data/initialData.json').
 */
export async function GET() {
  const { env } = getCloudflareContext();
  const db = (env as AppEnv).DB;
  if (!db) {
    return Response.json({ error: 'La base de datos D1 (binding DB) no está configurada en este entorno.' }, { status: 500 });
  }

  const res = await db
    .prepare(
      `SELECT periodo, anio, facultad, escuela, COALESCE(programa, '') as programa, codigo, cod_asig, digito, nro, asignatura, grupo, docente,
              matriculados, aprobados, desaprobados, abandonos, retiros, promedio
       FROM academic_records`
    )
    .all<DbRow>();

  const rows: ImportRow[] = (res.results ?? []).map((r, i) => ({
    ...r,
    codAsig: r.cod_asig ?? r.codigo,
    digito: r.digito ?? '',
    nro: r.nro ?? '',
    _fila: i,
  }));
  const dataset = buildDataset(rows);
  return Response.json(dataset);
}
