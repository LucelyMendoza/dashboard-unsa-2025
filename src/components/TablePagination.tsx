'use client';

import React from 'react';
import { fmt } from '@/lib/data-utils';

const PAGE_SIZES = [10, 25, 50];

export default function TablePagination({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  itemLabel = 'registros',
}: {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  itemLabel?: string;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const first = total ? currentPage * pageSize + 1 : 0;
  const last = Math.min((currentPage + 1) * pageSize, total);

  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-slate-500">
        <span>Mostrando <strong className="font-semibold text-slate-700">{fmt(first)}–{fmt(last)}</strong> de <strong className="font-semibold text-slate-700">{fmt(total)}</strong> {itemLabel}</span>
        <label className="flex items-center gap-2">
          Filas por página
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-[var(--accent)]"
          >
            {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
      </div>
      <div className="flex items-center gap-2 self-end sm:self-auto">
        <button type="button" onClick={() => onPageChange(Math.max(0, currentPage - 1))} disabled={currentPage === 0}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40">
          Anterior
        </button>
        <span className="min-w-[90px] text-center text-xs tabular-nums text-slate-600">Página {currentPage + 1} de {pageCount}</span>
        <button type="button" onClick={() => onPageChange(Math.min(pageCount - 1, currentPage + 1))} disabled={currentPage >= pageCount - 1}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40">
          Siguiente
        </button>
      </div>
    </div>
  );
}
