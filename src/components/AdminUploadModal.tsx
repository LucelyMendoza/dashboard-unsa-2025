'use client';

import React, { useState } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, X, ChevronDown, ChevronUp } from 'lucide-react';
import { parseExcelFile, ExcelParseError } from '@/lib/excelParser';
import { getImportRowKey, groupImportRows, IMPORT_API_BATCH_SIZE } from '@/lib/import-utils';
import { getIdToken } from '@/lib/firebase';
import type { ImportRow } from '@/lib/excelParser';

interface ImportSummary {
  totalFilas: number;
  nuevos: number;
  actualizados?: number;
  duplicados: number;
  errores: ValidationError[];
}

interface PreviewResponse {
  summary: ImportSummary;
  preview: ImportRow[];
  duplicateGroups: {
    key: string;
    exists: boolean;
    rowNumbers: number[];
    rows: ImportRow[];
  }[];
}

interface ValidationError {
  fila: number;
  motivo: string;
}

type ModalStep = 'idle' | 'reading' | 'preview' | 'confirming' | 'done' | 'error';
// Mantiene cada invocación del Worker pequeña; lotes grandes pueden superar
// el límite de recursos de Cloudflare aunque D1 escriba en sublotes.

function splitIntoBatches<T>(items: T[], size: number) {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) batches.push(items.slice(i, i + size));
  return batches;
}

export default function AdminUploadModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<ModalStep>('idle');
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [preview, setPreview] = useState<ImportRow[]>([]);
  const [allRows, setAllRows] = useState<ImportRow[]>([]);
  const [existingKeys, setExistingKeys] = useState<string[]>([]);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [sourceFile, setSourceFile] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [progress, setProgress] = useState('');

  const readError = async (res: Response, fallback: string) => {
    const text = await res.text();
    try {
      const data = JSON.parse(text);
      return data.error || fallback;
    } catch {
      if (text.includes('Worker exceeded resource limits') || text.includes('error-code">1102')) {
        return 'Cloudflare agotó los recursos al procesar este lote. Si ocurrió al guardar, puede que parte del lote actual ya se haya importado; revisa los datos antes de reintentar.';
      }
      return text.slice(0, 500) || fallback;
    }
  };

  const resetModal = () => {
    setStep('idle');
    setError('');
    setSummary(null);
    setPreview([]);
    setAllRows([]);
    setExistingKeys([]);
    setReplaceExisting(false);
    setSourceFile('');
    setShowErrors(false);
    setProgress('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setSourceFile(file.name);
    setStep('reading');
    setError('');

    try {
      const buffer = await file.arrayBuffer();
      const result = parseExcelFile(buffer);

      if (result.errores.length && !result.filasValidas.length) {
        throw new Error(`Archivo con solo errores de validación. ${result.errores.length} filas rechazadas.`);
      }

      // Analiza en lotes pequeños para que los archivos grandes no excedan los límites del Worker.
      let token = await getIdToken();
      if (!token) throw new Error('No hay sesión activa. Por favor, vuelve a iniciar sesión.');

      const groups = groupImportRows(result.filasValidas);
      const entries = Array.from(groups.entries());
      const batches = splitIntoBatches(entries, IMPORT_API_BATCH_SIZE);
      const existingKeys = new Set<string>();
      const serverPreviews: ImportRow[] = [];

      for (let i = 0; i < batches.length; i += 1) {
        token = await getIdToken();
        if (!token) throw new Error('La sesión expiró. Vuelve a iniciar sesión y carga el archivo de nuevo.');
        setProgress(`Revisando lote ${i + 1} de ${batches.length}...`);
        const previewRes = await fetch('/api/admin/import', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            rows: batches[i].map(([, group]) => group[0]),
            sourceFile: file.name,
            mode: 'preview',
          }),
        });

        if (!previewRes.ok) {
          throw new Error(await readError(previewRes, `Error en el servidor (${previewRes.status}).`));
        }

        const response = (await previewRes.json()) as PreviewResponse;
        response.duplicateGroups.forEach((group) => existingKeys.add(group.key));
        const remainingPreviewSlots = 50 - serverPreviews.length;
        if (remainingPreviewSlots > 0) serverPreviews.push(...response.preview.slice(0, remainingPreviewSlots));
      }

      const newGroups = entries.filter(([key]) => !existingKeys.has(key)).length;
      const duplicateRows = entries.reduce(
        (count, [key, group]) => count + (existingKeys.has(key) ? group.length : group.length - 1),
        0
      );

      setSummary({
        totalFilas: result.filasValidas.length,
        nuevos: newGroups,
        actualizados: 0,
        duplicados: duplicateRows,
        errores: result.errores,
      });
      setPreview(serverPreviews);
      setAllRows(result.filasValidas);
      setExistingKeys(Array.from(existingKeys));
      setReplaceExisting(false);
      setProgress('');
      setStep('preview');
    } catch (e) {
      const msg = e instanceof ExcelParseError ? e.message : e instanceof Error ? e.message : 'Error desconocido al leer el archivo.';
      setError(msg);
      setProgress('');
      setStep('error');
    }
  };

  const handleConfirm = async () => {
    if (!summary || !allRows.length) return;
    setStep('confirming');
    setError('');

    try {
      let token = await getIdToken();
      if (!token) throw new Error('No hay sesión activa. Por favor, vuelve a iniciar sesión.');

      const groups = groupImportRows(allRows);
      const existingKeySet = new Set(existingKeys);
      const rowsToCommit: ImportRow[] = [];
      const selectionsToCommit: Record<string, number> = {};

      for (const [key, group] of groups) {
        const exists = existingKeySet.has(key);
        if (!exists || replaceExisting) {
          rowsToCommit.push(group[0]);
          if (exists) selectionsToCommit[key] = group[0]._fila;
        }
      }

      const batches = splitIntoBatches(rowsToCommit, IMPORT_API_BATCH_SIZE);
      let savedRows = 0;
      let updatedRows = 0;
      for (let i = 0; i < batches.length; i += 1) {
        token = await getIdToken();
        if (!token) {
          throw new Error(
            savedRows
              ? `La sesión expiró después de guardar ${savedRows} registros. Vuelve a iniciar sesión y carga el mismo archivo para continuar.`
              : 'La sesión expiró. Vuelve a iniciar sesión y carga el archivo de nuevo.'
          );
        }
        setProgress(`Guardando lote ${i + 1} de ${batches.length}...`);
        const batch = batches[i];
        const batchSelections: Record<string, number> = {};
        for (const row of batch) {
          const key = getImportRowKey(row);
          if (selectionsToCommit[key] !== undefined) batchSelections[key] = selectionsToCommit[key];
        }
        const commitRes = await fetch('/api/admin/import', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            rows: batch,
            sourceFile,
            mode: 'commit',
            duplicateSelections: batchSelections,
          }),
        });

        if (!commitRes.ok) {
          const reason = await readError(commitRes, `Error en el servidor (${commitRes.status}).`);
          throw new Error(
            savedRows
              ? `La importación se interrumpió en el lote ${i + 1} de ${batches.length}. Ya se guardaron ${savedRows} registros. ${reason} Revisa los duplicados antes de reintentar.`
              : reason
          );
        }

        const result = (await commitRes.json()) as { summary: ImportSummary };
        savedRows += result.summary.nuevos;
        updatedRows += result.summary.actualizados ?? 0;
      }

      setSummary({ ...summary, nuevos: savedRows, actualizados: updatedRows });
      setProgress('');
      setStep('done');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido al confirmar.';
      setError(msg);
      setProgress('');
      setStep('error');
    }
  };

  const closeModal = () => {
    resetModal();
    setIsOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 bg-[var(--accent)] hover:opacity-90 text-white font-semibold text-xs px-3.5 py-2 rounded-lg transition"
      >
        <Upload size={15} />
        <span className="hidden sm:inline">Subir Excel</span>
        <span className="sm:hidden">Excel</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            {/* Encabezado */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="text-[var(--accent)]" size={18} />
                <h3 className="text-base font-bold text-slate-800">Importar datos locales</h3>
              </div>
              <button
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Paso 1: Seleccionar archivo */}
            {step === 'idle' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-600">
                  Carga un archivo Excel (.xlsx, .xls o .csv). Se reconocen estas cabeceras:
                  <br />
                  <code className="bg-slate-100 p-1.5 rounded font-mono text-[10px] block mt-1.5">
                    PERIODO | FACULTAD | ESCUELA | CODIGO | ASIGNATURA | GRUPOS | MATRICULADOS | APROBADOS | DESAPROBADOS | ABANDONOS | RETIROS | APROB 11-13 | APROB. 14-16 | APROB. 17-20 | PROMEDIO | DOCENTES | AÑO ESTUDIOS
                  </code>
                  <span className="block mt-1">Obligatorias: PERIODO, ESCUELA, CODIGO, ASIGNATURA, MATRICULADOS, APROBADOS y DESAPROBADOS.</span>
                </p>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={closeModal}
                    className="px-4 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-md"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Paso 2: Leyendo archivo */}
            {step === 'reading' && (
              <div className="text-center py-8">
                <div className="inline-block">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]" />
                </div>
                <p className="mt-3 text-xs text-slate-600">{progress || 'Procesando archivo...'}</p>
              </div>
            )}

            {/* Paso 3: Preview */}
            {step === 'preview' && summary && (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-800 font-semibold">Resumen de importación</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 text-xs">
                    <div>
                      <p className="text-slate-500">Total filas</p>
                      <p className="font-bold text-slate-800">{summary.totalFilas}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Filas nuevas</p>
                      <p className="font-bold text-emerald-600">{summary.nuevos}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Filas repetidas o ya existentes</p>
                      <p className="font-bold text-orange-600">{summary.duplicados}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Errores</p>
                      <p className="font-bold text-red-600">{summary.errores.length}</p>
                    </div>
                  </div>
                </div>

                {summary.errores.length > 0 && (
                  <div className="border border-red-200 rounded-lg p-3 bg-red-50">
                    <button
                      onClick={() => setShowErrors(!showErrors)}
                      className="flex items-center gap-2 text-xs font-semibold text-red-800 hover:text-red-900 w-full"
                    >
                      {showErrors ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      Ver {summary.errores.length} errores de validación
                    </button>
                    {showErrors && (
                      <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                        {summary.errores.slice(0, 20).map((err, i) => (
                          <p key={i} className="text-[10px] text-red-700">
                            Fila {err.fila}: {err.motivo}
                          </p>
                        ))}
                        {summary.errores.length > 20 && (
                          <p className="text-[10px] text-red-700 italic">... y {summary.errores.length - 20} más</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {summary.duplicados > 0 && (
                  <p className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-[10px] leading-relaxed text-orange-900">
                    Los duplicados se comparan usando todos los datos de la fila. En el nombre de la asignatura no se distinguen mayúsculas ni acentos vocálicos. Las filas idénticas repetidas dentro del archivo se agrupan y se importa una sola copia.
                  </p>
                )}

                {existingKeys.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs font-semibold text-amber-900">
                      {existingKeys.length} registros del archivo ya existen en D1 local
                    </p>
                    <label className="mt-2 flex items-start gap-2 text-[10px] text-amber-900">
                      <input
                        type="checkbox"
                        checked={replaceExisting}
                        onChange={(event) => setReplaceExisting(event.target.checked)}
                        className="mt-0.5"
                      />
                      <span>
                        Actualizar los registros existentes con una fila idéntica (ignorando acentos vocálicos y mayúsculas en la asignatura). Si el archivo repite esa fila, se usará la primera copia.
                      </span>
                    </label>
                  </div>
                )}

                {preview.length > 0 && (
                  <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                    <p className="text-xs font-semibold text-slate-700 mb-2">
                      Primeras {Math.min(5, preview.length)} filas a importar
                    </p>
                    <div className="academic-table-shell">
                      <table className="academic-table text-[10px] text-slate-700">
                        <thead>
                          <tr>
                            <th className="text-left">Periodo</th>
                            <th className="text-left">Escuela</th>
                            <th className="text-left">CODIGO</th>
                            <th className="text-left">Asignatura</th>
                            <th className="text-right">Mat.</th>
                            <th className="text-right">Apr.</th>
                            <th className="text-right">Des.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {preview.slice(0, 5).map((row, i) => (
                            <tr key={i}>
                              <td>{row.periodo}</td>
                              <td>{row.escuela}</td>
                              <td className="font-mono">{row.codigo}</td>
                              <td>{row.asignatura.slice(0, 20)}</td>
                              <td className="text-right">{row.matriculados}</td>
                              <td className="text-right">{row.aprobados}</td>
                              <td className="text-right">{row.desaprobados}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => resetModal()}
                    className="px-4 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-md"
                  >
                    Volver
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={summary.nuevos === 0 && !replaceExisting}
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-[var(--accent)] hover:opacity-90 disabled:opacity-50 rounded-md"
                  >
                    Confirmar importación
                  </button>
                </div>
              </div>
            )}

            {/* Paso 4: Confirmando */}
            {step === 'confirming' && (
              <div className="text-center py-8">
                <div className="inline-block">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]" />
                </div>
                <p className="mt-3 text-xs text-slate-600">{progress || 'Guardando en la base de datos...'}</p>
              </div>
            )}

            {/* Paso 5: Éxito */}
            {step === 'done' && summary && (
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <CheckCircle size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-emerald-900">Importación completada</p>
                    <p className="text-[10px] text-emerald-800 mt-1">
                      Se agregaron {summary.nuevos} registros nuevos y se actualizaron {summary.actualizados ?? 0} registros en D1 local. Ejecuta <code>npm run data:build</code> y publica el archivo actualizado en GitHub para reflejar los cambios en producción.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={closeModal}
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-[var(--accent)] hover:opacity-90 rounded-md"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            )}

            {/* Paso 6: Error */}
            {step === 'error' && (
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle size={18} className="text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-red-900">Error en la importación</p>
                    <p className="text-[10px] text-red-800 mt-1">{error}</p>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => resetModal()}
                    className="px-4 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-md"
                  >
                    Volver
                  </button>
                  <button
                    onClick={closeModal}
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-600 hover:bg-slate-700 rounded-md"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
