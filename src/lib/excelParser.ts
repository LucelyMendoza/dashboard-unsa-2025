import * as XLSX from 'xlsx';
import { facultadDeEscuela } from '@/lib/school-catalog';

/**
 * Cabeceras reales de los archivos SISACAD (verificadas contra los Excel de
 * origen: no incluyen FACULTAD ni DOCENTE — solo ESCUELA; la facultad se
 * resuelve vía school-catalog.ts, y el docente por defecto es
 * '(sin especificar)' si la hoja no lo trae).
 */
export interface RawExcelRow {
  PERIODO: string;
  ESCUELA: string;
  CODIGO: string | number;
  ASIGNATURA: string;
  GRUPOS?: string;
  MATRICULADOS: number;
  APROBADOS: number;
  DESAPROBADOS: number;
  ABANDONOS?: number;
  RETIROS?: number;
  PROMEDIO?: number;
  DOCENTE?: string;
  FACULTAD?: string; // opcional: si el Excel sí la trae (otras fuentes), se respeta
}

// Mínimas para poder ubicar y agregar el registro. Todo lo demás es opcional
// (con default 0 / '(sin especificar)').
export const REQUIRED_HEADERS = ['PERIODO', 'ESCUELA', 'CODIGO', 'ASIGNATURA', 'MATRICULADOS', 'APROBADOS', 'DESAPROBADOS'] as const;

// Alias de cabeceras: el Excel de SISACAD trae espacios, puntos, abreviaturas
// y variaciones de mayúsculas. Se normaliza todo a nombres canónicos.
const HEADER_ALIASES: Record<string, string> = {
  'CODIGO': 'CODIGO',
  'COD': 'CODIGO',
  'COD_ASIG': 'CODIGO',
  'COD-ASIG': 'CODIGO',
  'CODASIG': 'CODIGO',
  'ASIGNATURA': 'ASIGNATURA',
  'GRUPOS': 'GRUPOS',
  'GRUPO': 'GRUPOS',
  'NRO': 'NRO',
  'NRO.': 'NRO',
  'N': 'N',
  'DIGITO': 'DIGITO',
  'PROGRAMA': 'PROGRAMA',
  'MATRICULADOS': 'MATRICULADOS',
  'APROBADOS': 'APROBADOS',
  'DESAPROBADOS': 'DESAPROBADOS',
  'ABANDONOS': 'ABANDONOS',
  'NO_CULMINADOS': 'ABANDONOS',
  'RETIROS': 'RETIROS',
  'RETIRADOS': 'RETIROS',
  'PROMEDIO': 'PROMEDIO',
  'NOTA_PROMEDIO': 'PROMEDIO',
  'DOCENTE': 'DOCENTE',
  'DOCENTES': 'DOCENTE',
  'FACULTAD': 'FACULTAD',
  'ESCUELA': 'ESCUELA',
  'PROGRAMA_DE_ESTUDIOS': 'PROGRAMA',
  'PERIODO': 'PERIODO',
};

const normalizeHeader = (h: string) =>
  h
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/[.]/g, '')
    .replace(/-/g, '_');

export class ExcelParseError extends Error {}

export interface ImportRow {
  periodo: string;
  anio: number;
  facultad: string;
  escuela: string;
  programa: string;
  codigo: string;
  codAsig: string;
  digito: string;
  nro: string;
  asignatura: string;
  grupo: string;
  docente: string;
  matriculados: number;
  aprobados: number;
  desaprobados: number;
  abandonos: number;
  retiros: number;
  promedio: number;
  // fila original (1-indexado incluyendo cabecera) para reportar errores
  _fila: number;
}

export interface ParseResult {
  filasValidas: ImportRow[];
  errores: { fila: number; motivo: string }[];
  totalFilas: number;
}

const PERIODO_RE = /^\d{4}-[A-Za-z0-9]+$/;

/**
 * Lee el Excel en el navegador y devuelve filas normalizadas + errores de
 * validación. NO escribe nada — la persistencia/dedup ocurre en el backend
 * (/api/admin/import) contra D1. Esto habilita el paso de previsualización.
 */
export function parseExcelFile(fileBuffer: ArrayBuffer): ParseResult {
  const workbook = XLSX.read(fileBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });

  if (!rawRows.length) {
    throw new ExcelParseError('El archivo no contiene filas de datos.');
  }

  const firstRowKeys = Object.keys(rawRows[0]).map(normalizeHeader).map((k) => HEADER_ALIASES[k] ?? k);
  const missing = REQUIRED_HEADERS.filter((h) => !firstRowKeys.includes(h));
  if (missing.length) {
    throw new ExcelParseError(`Faltan las columnas obligatorias: ${missing.join(', ')}`);
  }

  const filasValidas: ImportRow[] = [];
  const errores: { fila: number; motivo: string }[] = [];

  rawRows.forEach((raw, i) => {
    const fila = i + 2; // +1 por índice 0, +1 por la fila de cabecera
    const norm: Record<string, unknown> = {};
    Object.entries(raw).forEach(([k, v]) => {
      const nk = HEADER_ALIASES[normalizeHeader(k)] ?? normalizeHeader(k);
      norm[nk] = v;
    });

    const periodo = String(norm.PERIODO ?? '').trim();
    const escuela = String(norm.ESCUELA ?? '').trim().toUpperCase();
    const programa = String(norm.PROGRAMA ?? '').trim().toUpperCase();
    const codigo = String(norm.CODIGO ?? '').trim();
    const asignatura = String(norm.ASIGNATURA ?? '').trim();
    const grupo = String(norm.GRUPOS ?? norm.GRUPO ?? '').trim().toUpperCase();
    const docente = String(norm.DOCENTE ?? '').trim() || '(sin especificar)';
    const facultadExcel = String(norm.FACULTAD ?? '').trim().toUpperCase();
    const isEducacion = facultadExcel === 'CIENCIAS DE LA EDUCACIÓN' || escuela === 'EDUCACIÓN';

    if (!periodo) { errores.push({ fila, motivo: 'Periodo vacío' }); return; }
    if (!PERIODO_RE.test(periodo)) { errores.push({ fila, motivo: `Periodo con formato inválido: "${periodo}" (esperado AAAA-X)` }); return; }
    if (!escuela) { errores.push({ fila, motivo: 'Escuela vacía' }); return; }
    if (!codigo) { errores.push({ fila, motivo: 'Código de asignatura vacío' }); return; }
    if (!asignatura) { errores.push({ fila, motivo: 'Asignatura vacía' }); return; }

    const anio = parseInt(periodo.slice(0, 4), 10);
    if (!Number.isFinite(anio)) { errores.push({ fila, motivo: 'Año no numérico en periodo' }); return; }

    const facultad = facultadExcel || facultadDeEscuela(escuela);

    filasValidas.push({
      periodo,
      anio,
      facultad,
      escuela,
      programa: isEducacion ? (programa || escuela) : programa,
      codigo,
      codAsig: String(norm.CODIGO ?? '').trim(),
      digito: String(norm.DIGITO ?? '').trim(),
      nro: String(norm.NRO ?? '').trim(),
      asignatura,
      grupo,
      docente,
      matriculados: Number(norm.MATRICULADOS || 0),
      aprobados: Number(norm.APROBADOS || 0),
      desaprobados: Number(norm.DESAPROBADOS || 0),
      abandonos: Number(norm.ABANDONOS || 0),
      retiros: Number(norm.RETIROS || 0),
      promedio: Number(norm.PROMEDIO || 0),
      _fila: fila,
    });
  });

  return { filasValidas, errores, totalFilas: rawRows.length };
}
