import type { ImportRow } from '@/lib/excelParser';

export const IMPORT_API_BATCH_SIZE = 250;

type ImportRowContent = Omit<ImportRow, '_fila'>;

export function getImportRowLookupKey(
  row: Pick<ImportRow, 'periodo' | 'facultad' | 'escuela' | 'codigo' | 'grupo'>
) {
  return JSON.stringify([row.periodo, row.facultad, row.escuela, row.codigo, row.grupo]);
}

function normalizeAssignment(value: string) {
  return value.normalize('NFD').replace(/[\u0301\u0308]/g, '').toLocaleUpperCase('es');
}

export function getImportRowKey(row: ImportRowContent) {
  return JSON.stringify([
    row.periodo,
    row.anio,
    row.facultad,
    row.escuela,
    row.programa,
    row.codigo,
    row.codAsig,
    row.digito,
    row.nro,
    normalizeAssignment(row.asignatura),
    row.grupo,
    row.docente,
    row.matriculados,
    row.aprobados,
    row.desaprobados,
    row.abandonos,
    row.retiros,
    row.aprob1113,
    row.aprob1416,
    row.aprob1720,
    row.anioEstudios,
    row.promedio,
  ]);
}

export function groupImportRows(rows: ImportRow[]) {
  const groups = new Map<string, ImportRow[]>();
  for (const row of rows) {
    const key = getImportRowKey(row);
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  return groups;
}
