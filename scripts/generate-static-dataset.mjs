import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exportPath = path.join(os.tmpdir(), `dashboard-unsa-${process.pid}.sql`);
const dataDirectory = path.join(root, 'public', 'data');
const modulePath = path.join(root, 'src', 'lib', 'generated-dataset.ts');
const temporaryModulePath = `${modulePath}.${process.pid}.tmp`;
const wranglerPath = path.join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
let database;
let temporaryOutputPath;

try {
  execFileSync(
    process.execPath,
    [
      wranglerPath,
      'd1',
      'export',
      'academic-db-produccion',
      '--local',
      '--output',
      exportPath,
      '--table',
      'academic_records',
      '--skip-confirmation',
    ],
    { cwd: root, stdio: 'inherit' }
  );

  database = new DatabaseSync(':memory:');
  database.exec(readFileSync(exportPath, 'utf8'));
  const rows = database
    .prepare(
      `SELECT id, periodo, anio, facultad, escuela, COALESCE(programa, '') AS programa,
              codigo, cod_asig, digito, nro, asignatura, grupo, docente,
              matriculados, aprobados, desaprobados, abandonos, retiros,
              aprob_11_13, aprob_14_16, aprob_17_20, anio_estudios, promedio
       FROM academic_records
       ORDER BY id`
    )
    .all();

  if (!rows.length) {
    throw new Error('La D1 local no contiene registros; no se reemplazó el dataset estático.');
  }

  const bundledBuilder = await build({
    entryPoints: [path.join(root, 'src', 'lib', 'dataset-builder.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    write: false,
    tsconfig: path.join(root, 'tsconfig.json'),
    alias: { '@': path.join(root, 'src') },
  });
  const builderUrl = `data:text/javascript;base64,${Buffer.from(bundledBuilder.outputFiles[0].text).toString('base64')}`;
  const { buildDataset } = await import(builderUrl);

  const importRows = rows.map((row, index) => ({
    ...row,
    codAsig: row.cod_asig || row.codigo,
    digito: row.digito || '',
    nro: row.nro || '',
    aprob1113: row.aprob_11_13 || 0,
    aprob1416: row.aprob_14_16 || 0,
    aprob1720: row.aprob_17_20 || 0,
    anioEstudios: row.anio_estudios || '',
    _fila: index,
  }));
  const dataset = buildDataset(importRows);
  const content = `${JSON.stringify(dataset)}\n`;
  const hash = createHash('sha256').update(content).digest('hex').slice(0, 16);
  const assetName = `dashboard-${hash}.json`;
  const outputPath = path.join(dataDirectory, assetName);
  temporaryOutputPath = `${outputPath}.${process.pid}.tmp`;

  writeFileSync(temporaryOutputPath, content, 'utf8');
  renameSync(temporaryOutputPath, outputPath);
  writeFileSync(temporaryModulePath, `export const STATIC_DATASET_URL = '/data/${assetName}';\n`, 'utf8');
  renameSync(temporaryModulePath, modulePath);

  for (const name of readdirSync(dataDirectory)) {
    if (/^dashboard-[a-f0-9]{16}\.json$/.test(name) && name !== assetName) {
      unlinkSync(path.join(dataDirectory, name));
    }
  }

  console.log(
    `Dataset generado: ${rows.length.toLocaleString('es-PE')} registros D1, ` +
      `${dataset.sa.length.toLocaleString('es-PE')} filas de asignaturas, ` +
      `${Buffer.byteLength(content).toLocaleString('es-PE')} bytes: public/data/${assetName}`
  );
} catch (error) {
  console.error('No se pudo generar el dataset estático:', error);
  process.exitCode = 1;
} finally {
  database?.close();
  for (const temporaryPath of [exportPath, temporaryOutputPath, temporaryModulePath]) {
    if (!temporaryPath) continue;
    try {
      unlinkSync(temporaryPath);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
}
