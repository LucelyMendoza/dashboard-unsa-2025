import { getCloudflareContext } from '@opennextjs/cloudflare';
import { requireAdmin, AuthError } from '@/lib/auth-verify';
import { getImportRowKey, getImportRowLookupKey, groupImportRows, IMPORT_API_BATCH_SIZE } from '@/lib/import-utils';
import type { ImportRow } from '@/lib/excelParser';

interface ImportBody {
  rows: ImportRow[];
  sourceFile: string;
  mode: 'preview' | 'commit' | 'replace';
  duplicateSelections?: Record<string, number>;
  validationErrors?: { fila: number; motivo: string }[];
}

interface Summary {
  totalFilas: number;
  nuevos: number;
  actualizados: number;
  duplicados: number;
  errores: { fila: number; motivo: string }[];
}

interface DuplicateGroup {
  key: string;
  exists: boolean;
  rowNumbers: number[];
}

type AppEnv = CloudflareEnv & {
  DB?: D1Database;
};

const D1_BATCH_SIZE = 50;

type StoredImportRow = Omit<ImportRow, '_fila'> & { id: number };

async function findExistingRecords(db: D1Database, rows: ImportRow[]) {
  const rowsByLookupKey = new Map<string, ImportRow>();
  for (const row of rows) rowsByLookupKey.set(getImportRowLookupKey(row), row);
  const uniqueRows = Array.from(rowsByLookupKey.values());
  if (!uniqueRows.length) return new Map<string, number>();

  const keysJson = JSON.stringify(uniqueRows.map((row) => [
    row.periodo,
    row.facultad,
    row.escuela,
    row.codigo,
    row.grupo,
  ]));
  const result = await db
    .prepare(
      `WITH import_keys AS (
         SELECT
           json_extract(value, '$[0]') AS periodo,
           json_extract(value, '$[1]') AS facultad,
           json_extract(value, '$[2]') AS escuela,
           json_extract(value, '$[3]') AS codigo,
           json_extract(value, '$[4]') AS grupo
         FROM json_each(?)
       )
       SELECT academic_records.id, academic_records.periodo, academic_records.anio,
              academic_records.facultad, academic_records.escuela, academic_records.programa,
              academic_records.codigo, academic_records.cod_asig AS codAsig,
              academic_records.digito, academic_records.nro, academic_records.asignatura,
              academic_records.grupo, academic_records.docente, academic_records.matriculados,
              academic_records.aprobados, academic_records.desaprobados,
              academic_records.abandonos, academic_records.retiros,
              academic_records.aprob_11_13 AS aprob1113,
              academic_records.aprob_14_16 AS aprob1416,
              academic_records.aprob_17_20 AS aprob1720,
              academic_records.anio_estudios AS anioEstudios, academic_records.promedio
       FROM academic_records
       INNER JOIN import_keys USING (periodo, facultad, escuela, codigo, grupo)`
    )
    .bind(keysJson)
    .all<StoredImportRow>();

  return new Map((result.results ?? []).map((row) => [getImportRowKey(row), row.id]));
}

function getDuplicateGroups(rows: ImportRow[], existingKeys: Set<string>): DuplicateGroup[] {
  return Array.from(groupImportRows(rows), ([key, group]) => ({
    key,
    exists: existingKeys.has(key),
    rowNumbers: group.map((row) => row._fila),
  })).filter((group) => group.exists);
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return Response.json(
      { error: 'La importación web está deshabilitada. Actualiza el dataset estático desde el entorno local.' },
      { status: 410 }
    );
  }

  let admin: { email: string };
  try {
    admin = await requireAdmin(request);
  } catch (e) {
    const err = e as AuthError;
    return Response.json({ error: err.message }, { status: err.status ?? 401 });
  }

  let body: ImportBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'JSON inválido en el cuerpo de la solicitud.' }, { status: 400 });
  }

  const { rows, sourceFile, mode } = body;
  if (!Array.isArray(rows) || !rows.length) {
    return Response.json({ error: 'No se recibieron filas para procesar.' }, { status: 400 });
  }
  if (rows.length > IMPORT_API_BATCH_SIZE) {
    return Response.json(
      { error: `Cada solicitud puede procesar como máximo ${IMPORT_API_BATCH_SIZE} filas.` },
      { status: 413 }
    );
  }
  if (mode !== 'preview' && mode !== 'commit' && mode !== 'replace') {
    return Response.json({ error: "mode debe ser 'preview', 'commit' o 'replace'." }, { status: 400 });
  }

  const { env } = getCloudflareContext();
  const appEnv = env as AppEnv;
  const db = appEnv.DB;
  if (!db) {
    return Response.json({ error: 'La base de datos D1 (binding DB) no está configurada en este entorno.' }, { status: 500 });
  }

  const existingRecords = await findExistingRecords(db, rows);
  const existingKeys = new Set(existingRecords.keys());
  const groups = groupImportRows(rows);
  const duplicateGroups = getDuplicateGroups(rows, existingKeys);
  const duplicateSelections = body.duplicateSelections ?? {};
  const nuevas: ImportRow[] = [];
  let duplicateRows = 0;

  for (const [key, group] of groups) {
    if (!existingKeys.has(key)) {
      nuevas.push(group[0]);
      duplicateRows += Math.max(0, group.length - 1);
      continue;
    }

    duplicateRows += group.length;
    const selectedRowNumber =
      duplicateSelections[key] ??
      (mode === 'replace' ? group[group.length - 1]._fila : undefined);
    if (selectedRowNumber === undefined) continue;

    const selectedRow = group.find((row) => row._fila === selectedRowNumber);
    if (!selectedRow) {
      return Response.json({ error: `La fila seleccionada para el duplicado ${key} no pertenece al archivo.` }, { status: 400 });
    }
    nuevas.push(selectedRow);
  }

  for (const [key, rowNumber] of Object.entries(duplicateSelections)) {
    if (!groups.get(key)?.some((row) => row._fila === rowNumber)) {
      return Response.json({ error: 'La selección de duplicados ya no coincide con las filas del archivo.' }, { status: 400 });
    }
  }

  const summary: Summary = {
    totalFilas: rows.length,
    nuevos: nuevas.filter((row) => !existingRecords.has(getImportRowKey(row))).length,
    actualizados: nuevas.filter((row) => existingRecords.has(getImportRowKey(row))).length,
    duplicados: duplicateRows,
    errores: body.validationErrors ?? [],
  };

  if (mode === 'preview') {
    const duplicatePreviews = duplicateGroups.map((group) => ({
      ...group,
      rows: groups.get(group.key) ?? [],
    }));
    return Response.json({ summary, preview: nuevas.slice(0, 50), duplicateGroups: duplicatePreviews });
  }

  // Inserta filas nuevas y actualiza coincidencias exactas seleccionadas.
  const insertInto = (targetDb: D1Database) =>
    (async () => {
      for (let i = 0; i < nuevas.length; i += D1_BATCH_SIZE) {
        const chunk = nuevas.slice(i, i + D1_BATCH_SIZE);
        const stmts = chunk.map((r) => {
          const existingId = existingRecords.get(getImportRowKey(r));
          const values = [
            r.periodo,
            r.anio,
            r.facultad,
            r.escuela,
            r.programa ?? '',
            r.codigo,
            r.codAsig ?? r.codigo,
            r.digito ?? '',
            r.nro ?? '',
            r.asignatura,
            r.grupo,
            r.docente,
            r.matriculados,
            r.aprobados,
            r.desaprobados,
            r.abandonos,
            r.retiros,
            r.aprob1113,
            r.aprob1416,
            r.aprob1720,
            r.anioEstudios,
            r.promedio,
            sourceFile ?? '',
          ];
          if (existingId !== undefined) {
            return targetDb
              .prepare(
                `UPDATE academic_records
                 SET periodo = ?, anio = ?, facultad = ?, escuela = ?, programa = ?, codigo = ?,
                     cod_asig = ?, digito = ?, nro = ?, asignatura = ?, grupo = ?, docente = ?,
                     matriculados = ?, aprobados = ?, desaprobados = ?, abandonos = ?, retiros = ?,
                     aprob_11_13 = ?, aprob_14_16 = ?, aprob_17_20 = ?, anio_estudios = ?,
                     promedio = ?, source_file = ?
                 WHERE id = ?`
              )
              .bind(...values, existingId);
          }
          return targetDb
            .prepare(
              `INSERT INTO academic_records
               (periodo, anio, facultad, escuela, programa, codigo, cod_asig, digito, nro, asignatura, grupo, docente, matriculados, aprobados, desaprobados, abandonos, retiros, aprob_11_13, aprob_14_16, aprob_17_20, anio_estudios, promedio, source_file)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(...values);
        });
        await targetDb.batch(stmts);
      }
    })();

  await insertInto(db);

  await db
    .prepare(
      `INSERT INTO import_log (admin_email, source_file, total_filas, nuevos, duplicados, errores) VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(admin.email, sourceFile ?? '', summary.totalFilas, summary.nuevos, summary.duplicados, 0)
    .run();

  return Response.json({ summary });
}
