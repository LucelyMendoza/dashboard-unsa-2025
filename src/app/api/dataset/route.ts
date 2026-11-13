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
  aprob_11_13?: number;
  aprob_14_16?: number;
  aprob_17_20?: number;
  anio_estudios?: string;
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
              matriculados, aprobados, desaprobados, abandonos, retiros,
              aprob_11_13, aprob_14_16, aprob_17_20, anio_estudios, promedio
       FROM academic_records`
    )
    .all<DbRow>();

  const rows: ImportRow[] = (res.results ?? []).map((r, i) => ({
    ...r,
    codAsig: r.cod_asig ?? r.codigo,
    digito: r.digito ?? '',
    nro: r.nro ?? '',
    aprob1113: r.aprob_11_13 ?? 0,
    aprob1416: r.aprob_14_16 ?? 0,
    aprob1720: r.aprob_17_20 ?? 0,
    anioEstudios: r.anio_estudios ?? '',
    _fila: i,
  }));
  const dataset = buildDataset(rows);
  return Response.json(dataset);
}
