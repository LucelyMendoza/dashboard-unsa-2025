import type { ImportRow } from '@/lib/excelParser';

export function getImportRowKey(row: Pick<ImportRow, 'periodo' | 'facultad' | 'escuela' | 'codigo' | 'grupo'>) {
  return JSON.stringify([row.periodo, row.facultad, row.escuela, row.codigo, row.grupo]);
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
