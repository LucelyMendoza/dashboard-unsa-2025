import { getCloudflareContext } from '@opennextjs/cloudflare';
import { requireAdmin, AuthError } from '@/lib/auth-verify';
import { getImportRowKey, groupImportRows } from '@/lib/import-utils';
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
  DB_REMOTE?: D1Database;
};

const BATCH_SIZE = 50; // filas por sentencia D1.batch()

async function findExistingKeys(db: D1Database, rows: ImportRow[]) {
  const rowsByKey = new Map<string, ImportRow>();
  for (const row of rows) rowsByKey.set(getImportRowKey(row), row);
  const uniqueRows = Array.from(rowsByKey.values());
  if (!uniqueRows.length) return new Set<string>();

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
       SELECT academic_records.periodo, academic_records.facultad, academic_records.escuela,
              academic_records.codigo, academic_records.grupo
       FROM academic_records
       INNER JOIN import_keys USING (periodo, facultad, escuela, codigo, grupo)`
    )
    .bind(keysJson)
    .all<Pick<ImportRow, 'periodo' | 'facultad' | 'escuela' | 'codigo' | 'grupo'>>();

  return new Set((result.results ?? []).map(getImportRowKey));
}

function getDuplicateGroups(rows: ImportRow[], existingKeys: Set<string>): DuplicateGroup[] {
  return Array.from(groupImportRows(rows), ([key, group]) => ({
    key,
    exists: existingKeys.has(key),
    rowNumbers: group.map((row) => row._fila),
  })).filter((group) => group.exists || group.rowNumbers.length > 1);
}

export async function POST(request: Request) {
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
  if (mode !== 'preview' && mode !== 'commit' && mode !== 'replace') {
    return Response.json({ error: "mode debe ser 'preview', 'commit' o 'replace'." }, { status: 400 });
  }

  const { env } = getCloudflareContext();
  const appEnv = env as AppEnv;
  const db = appEnv.DB;
  const remoteDb = appEnv.DB_REMOTE;
  if (!db) {
    return Response.json({ error: 'La base de datos D1 (binding DB) no está configurada en este entorno.' }, { status: 500 });
  }

  const existingKeys = await findExistingKeys(db, rows);
  const groups = groupImportRows(rows);
  const duplicateGroups = getDuplicateGroups(rows, existingKeys);
  const duplicateGroupKeys = new Set(duplicateGroups.map((group) => group.key));
  const duplicateSelections = body.duplicateSelections ?? {};
  const nuevas: ImportRow[] = [];
  let duplicateRows = 0;

  for (const [key, group] of groups) {
    if (!duplicateGroupKeys.has(key)) {
      nuevas.push(group[0]);
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
    nuevos: nuevas.length,
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

  // Inserta o reemplaza en lotes; cada grupo duplicado se procesa como una sola fila.
  const insertInto = (targetDb: D1Database) =>
    (async () => {
      for (let i = 0; i < nuevas.length; i += BATCH_SIZE) {
        const chunk = nuevas.slice(i, i + BATCH_SIZE);
        const stmts = chunk.map((r) =>
          targetDb
            .prepare(
              `INSERT OR REPLACE INTO academic_records
               (periodo, anio, facultad, escuela, programa, codigo, cod_asig, digito, nro, asignatura, grupo, docente, matriculados, aprobados, desaprobados, abandonos, retiros, aprob_11_13, aprob_14_16, aprob_17_20, anio_estudios, promedio, source_file)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(
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
              sourceFile ?? ''
            )
        );
        await targetDb.batch(stmts);
      }
    })();

  await insertInto(db);
  let remoteWarning = '';
  if (remoteDb && remoteDb !== db) {
    try {
      await insertInto(remoteDb);
    } catch (err) {
      remoteWarning = err instanceof Error ? err.message : 'No se pudo sincronizar con la base remota.';
      console.warn('Remote D1 sync failed:', remoteWarning);
    }
  }

  await db
    .prepare(
      `INSERT INTO import_log (admin_email, source_file, total_filas, nuevos, duplicados, errores) VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(admin.email, sourceFile ?? '', summary.totalFilas, summary.nuevos, summary.duplicados, 0)
    .run();

  return Response.json({ summary, remoteWarning: remoteWarning || undefined });
}
