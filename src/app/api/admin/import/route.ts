import { getCloudflareContext } from '@opennextjs/cloudflare';
import { requireAdmin, AuthError } from '@/lib/auth-verify';
import type { ImportRow } from '@/lib/excelParser';

interface ImportBody {
  rows: ImportRow[];
  sourceFile: string;
  mode: 'preview' | 'commit' | 'replace';
}

interface Summary {
  totalFilas: number;
  nuevos: number;
  duplicados: number;
  errores: { fila: number; motivo: string }[];
}

type AppEnv = CloudflareEnv & {
  DB?: D1Database;
  DB_REMOTE?: D1Database;
};

const BATCH_SIZE = 50; // filas por sentencia D1.batch()

function rowKey(r: Pick<ImportRow, 'escuela' | 'periodo' | 'codigo' | 'grupo'>) {
  return `${r.escuela}|||${r.periodo}|||${r.codigo}|||${r.grupo}`;
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

  // Sólo se consultan las claves de los periodos presentes en el archivo,
  // no toda la tabla — evita traer millones de filas para deduplicar.
  const periodos = Array.from(new Set(rows.map((r) => r.periodo)));
  const placeholders = periodos.map(() => '?').join(',');
  const existingRes = await db
    .prepare(`SELECT escuela, periodo, codigo, grupo FROM academic_records WHERE periodo IN (${placeholders})`)
    .bind(...periodos)
    .all<{ escuela: string; periodo: string; codigo: string; grupo: string }>();
  const existingKeys = new Set((existingRes.results ?? []).map(rowKey));

  const nuevas: ImportRow[] = [];
  let duplicados = 0;
  const seenInFile = new Set<string>();

  for (const r of rows) {
    const key = rowKey(r);
    if ((mode !== 'replace' && existingKeys.has(key)) || seenInFile.has(key)) {
      duplicados += 1;
      continue;
    }
    seenInFile.add(key);
    nuevas.push(r);
  }

  const summary: Summary = {
    totalFilas: rows.length,
    nuevos: nuevas.length,
    duplicados,
    errores: [], // los errores de formato ya se filtraron en el cliente (excelParser); aquí solo dedup
  };

  if (mode === 'preview') {
    return Response.json({ summary, preview: nuevas.slice(0, 50) });
  }

  // mode === 'commit': inserta en lotes. INSERT OR IGNORE es la red de
  // seguridad final por si dos cargas concurrentes chocan en la misma clave.
  const insertInto = (targetDb: D1Database) =>
    (async () => {
      for (let i = 0; i < nuevas.length; i += BATCH_SIZE) {
        const chunk = nuevas.slice(i, i + BATCH_SIZE);
        if (mode === 'replace') {
          const deleteStmts = chunk.map((r) =>
            targetDb
              .prepare(
                `DELETE FROM academic_records
                 WHERE escuela = ? AND periodo = ? AND codigo = ? AND grupo = ?`
              )
              .bind(r.escuela, r.periodo, r.codigo, r.grupo)
          );
          await targetDb.batch(deleteStmts);
        }
        const stmts = chunk.map((r) =>
          targetDb
            .prepare(
              `INSERT OR REPLACE INTO academic_records
               (periodo, anio, facultad, escuela, programa, codigo, cod_asig, digito, nro, asignatura, grupo, docente, matriculados, aprobados, desaprobados, abandonos, retiros, promedio, source_file)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
