'use client';

import React, { useState } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, X, ChevronDown, ChevronUp } from 'lucide-react';
import { parseExcelFile, ExcelParseError } from '@/lib/excelParser';
import { getIdToken } from '@/lib/firebase';
import type { ImportRow } from '@/lib/excelParser';

interface ImportSummary {
  totalFilas: number;
  nuevos: number;
  duplicados: number;
  errores: { fila: number; motivo: string }[];
}

type ModalStep = 'idle' | 'reading' | 'preview' | 'confirming' | 'done' | 'error';

export default function AdminUploadModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<ModalStep>('idle');
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [preview, setPreview] = useState<ImportRow[]>([]);
  const [allRows, setAllRows] = useState<ImportRow[]>([]);
  const [sourceFile, setSourceFile] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [replaceDuplicates, setReplaceDuplicates] = useState(false);

  const readError = async (res: Response, fallback: string) => {
    const text = await res.text();
    try {
      const data = JSON.parse(text);
      return data.error || fallback;
    } catch {
      return text || fallback;
    }
  };

  const resetModal = () => {
    setStep('idle');
    setError('');
    setSummary(null);
    setPreview([]);
    setAllRows([]);
    setSourceFile('');
    setShowErrors(false);
    setReplaceDuplicates(false);
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

      // Enviar al backend para preview y dedup
      const token = await getIdToken();
      if (!token) throw new Error('No hay sesión activa. Por favor, vuelve a iniciar sesión.');

      const previewRes = await fetch('/api/admin/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          rows: result.filasValidas,
          sourceFile: file.name,
          mode: 'preview',
        }),
      });

      if (!previewRes.ok) {
        throw new Error(await readError(previewRes, `Error en el servidor (${previewRes.status}).`));
      }

      const { summary: s, preview: p } = await previewRes.json();
      setSummary(s);
      setPreview(p || []);
      setAllRows(result.filasValidas);
      setStep('preview');
    } catch (e) {
      const msg = e instanceof ExcelParseError ? e.message : e instanceof Error ? e.message : 'Error desconocido al leer el archivo.';
      setError(msg);
      setStep('error');
    }
  };

  const handleConfirm = async () => {
    if (!summary || !allRows.length) return;
    setStep('confirming');
    setError('');

    try {
      const token = await getIdToken();
      if (!token) throw new Error('No hay sesión activa. Por favor, vuelve a iniciar sesión.');

      const commitRes = await fetch('/api/admin/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          rows: allRows,
          sourceFile,
          mode: replaceDuplicates ? 'replace' : 'commit',
        }),
      });

      if (!commitRes.ok) {
        throw new Error(await readError(commitRes, `Error en el servidor (${commitRes.status}).`));
      }

      setStep('done');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido al confirmar.';
      setError(msg);
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
                <h3 className="text-base font-bold text-slate-800">Importar datos académicos</h3>
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
                  Carga un archivo Excel (.xlsx) con datos académicos. Las columnas requeridas son:
                  <br />
                  <code className="bg-slate-100 p-1.5 rounded font-mono text-[10px] block mt-1.5">
                    PERIODO | ESCUELA | CODIGO | ASIGNATURA | MATRICULADOS | APROBADOS | DESAPROBADOS
                  </code>
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
                <p className="mt-3 text-xs text-slate-600">Procesando archivo...</p>
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
                      <p className="text-slate-500">Nuevos</p>
                      <p className="font-bold text-emerald-600">{summary.nuevos}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Duplicados</p>
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

                {preview.length > 0 && (
                  <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3 p-3 rounded-lg bg-white border border-slate-200">
                      <div>
                        <p className="text-xs font-semibold text-slate-800">Opciones de importación</p>
                        <p className="text-[10px] text-slate-500">Si activas reemplazo, las filas con la misma clave se actualizan.</p>
                      </div>
                      <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={replaceDuplicates}
                          onChange={(e) => setReplaceDuplicates(e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        Reemplazar duplicados
                      </label>
                    </div>
                    <p className="text-xs font-semibold text-slate-700 mb-2">
                      Primeras {Math.min(5, preview.length)} filas a importar
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[10px] text-slate-700">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-100">
                            <th className="text-left px-2 py-1">Periodo</th>
                            <th className="text-left px-2 py-1">Escuela</th>
                            <th className="text-left px-2 py-1">Asignatura</th>
                            <th className="text-right px-2 py-1">Mat.</th>
                            <th className="text-right px-2 py-1">Apr.</th>
                            <th className="text-right px-2 py-1">Des.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {preview.slice(0, 5).map((row, i) => (
                            <tr key={i} className="border-b border-slate-100 hover:bg-slate-100">
                              <td className="px-2 py-1">{row.periodo}</td>
                              <td className="px-2 py-1">{row.escuela}</td>
                              <td className="px-2 py-1">{row.asignatura.slice(0, 20)}</td>
                              <td className="text-right px-2 py-1">{row.matriculados}</td>
                              <td className="text-right px-2 py-1">{row.aprobados}</td>
                              <td className="text-right px-2 py-1">{row.desaprobados}</td>
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
                    disabled={summary.nuevos === 0}
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
                <p className="mt-3 text-xs text-slate-600">Guardando en la base de datos...</p>
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
                      Se agregaron {summary.nuevos} registros nuevos. El dashboard se actualizará automáticamente en la próxima recarga.
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
