import React, { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import type { DashboardDataset } from '@/types/dashboard';
import type { FilterState } from '@/lib/data-utils';
import type { RoleScope } from '@/lib/session';

interface Props {
  dataset: DashboardDataset;
  filters: FilterState;
  onChange: (next: FilterState) => void;
  scope: RoleScope;
}

interface FilterOption {
  value: string;
  label: string;
}

const labelCls = 'mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500';

function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
  open,
  onOpenChange,
  disabled = false,
}: {
  label: string;
  options: FilterOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disabled?: boolean;
}) {
  const allSelected = selected.length === 0 || selected.length >= options.length;
  const selectionLabel = allSelected
    ? 'Todas'
    : selected.length === 1
      ? options.find((option) => option.value === selected[0])?.label ?? '1 seleccionada'
      : `${selected.length} seleccionadas`;
  const selectedSummary = allSelected
    ? 'Todas'
    : selected.map((value) => options.find((option) => option.value === value)?.label ?? value).join(', ');

  const handleOptionChange = (value: string, checked: boolean) => {
    if (!checked) {
      const current = allSelected ? options.map((option) => option.value) : selected;
      onChange(current.filter((item) => item !== value));
      return;
    }

    if (allSelected) {
      onChange([value]);
      return;
    }

    const next = [...selected, value];
    onChange(next.length >= options.length ? [] : next);
  };

  return (
    <div className="min-w-0">
      <span className={labelCls}>{label}</span>
      <details
        className="group relative"
        aria-disabled={disabled}
        open={open}
        onToggle={(event) => onOpenChange(event.currentTarget.open)}
      >
        <summary
          className={`dashboard-control flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs transition hover:border-[#c9bda9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dorado-oscuro)] ${
            disabled ? 'cursor-not-allowed bg-slate-100 text-slate-400' : ''
          }`}
          aria-label={`${label}: ${selectionLabel}`}
          title={selectedSummary}
          onClick={(event) => {
            if (disabled) event.preventDefault();
          }}
        >
          <span className="truncate">{selectionLabel}</span>
          <span aria-hidden="true" className="shrink-0 text-[var(--texto-sec)] transition-transform group-open:rotate-180">⌄</span>
        </summary>
        {options.length > 0 && !disabled && (
          <div className="relative mt-1 max-h-64 w-full min-w-0 overflow-y-auto rounded-lg border border-[var(--linea)] bg-[var(--papel)] p-2 shadow-md">
            <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-xs font-semibold text-[var(--granate)] hover:bg-[var(--crema)]">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => onChange([])}
                className="accent-[var(--granate)]"
              />
              Todas
            </label>
            <div className="my-1 border-t border-[var(--linea)]" />
            {options.map((option) => (
              <label key={option.value} className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-2 text-xs text-slate-700 hover:bg-[var(--crema)]">
                <input
                  type="checkbox"
                  checked={!allSelected && selected.includes(option.value)}
                  onChange={(event) => handleOptionChange(option.value, event.target.checked)}
                  className="mt-0.5 accent-[var(--granate)]"
                />
                <span className="leading-relaxed">{option.label}</span>
              </label>
            ))}
          </div>
        )}
      </details>
    </div>
  );
}

export default function FiltersBar({ dataset, filters, onChange, scope }: Props) {
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const facultadOptions = dataset.fs.map((facultad) => ({ value: facultad, label: facultad }));
  const escuelaOptions = filters.facultad.length === 0
    ? dataset.es
    : [...new Set(filters.facultad.flatMap((facultad) => dataset.fe[facultad] ?? []))];
  const schoolSelection = filters.escuela.filter((escuela) => escuelaOptions.includes(escuela));
  const showProgram =
    filters.facultad.length === 1 &&
    filters.facultad[0] === 'CIENCIAS DE LA EDUCACIÓN' &&
    schoolSelection.length === 1;
  const programaOptions = showProgram ? dataset.ep[schoolSelection[0]] ?? [] : [];

  const years = [...new Set(dataset.ps.map((period) => period.slice(0, 4)))].sort();
  const yearOptions = years.map((year) => ({ value: year, label: year }));
  const availablePeriods = dataset.ps.filter(
    (period) => filters.anio.length === 0 || filters.anio.includes(period.slice(0, 4))
  );
  const periodOptions = availablePeriods.map((period) => {
    const [year, semester] = period.split('-');
    return { value: period, label: `${year} · Semestre ${semester}` };
  });

  const handleFacultyChange = (facultad: string[]) => {
    const availableSchools = facultad.length === 0
      ? dataset.es
      : [...new Set(facultad.flatMap((item) => dataset.fe[item] ?? []))];
    const escuela = filters.escuela.length === 0
      ? []
      : filters.escuela.filter((item) => availableSchools.includes(item));
    onChange({ ...filters, facultad, escuela, programa: 'ALL' });
  };

  const activeFilterCount = [
    !scope.lockFacultad && filters.facultad.length > 0 && filters.facultad.length < facultadOptions.length,
    !scope.lockEscuela && schoolSelection.length > 0 && schoolSelection.length < escuelaOptions.length,
    filters.anio.length > 0 && filters.anio.length < yearOptions.length,
    filters.agrupacion === 'sem' && filters.periodo.length > 0 && filters.periodo.length < availablePeriods.length,
    filters.programa !== 'ALL',
  ].filter(Boolean).length;

  const resetFilters = () => {
    onChange({
      ...filters,
      facultad: scope.lockFacultad ? filters.facultad : [],
      escuela: scope.lockEscuela ? filters.escuela : [],
      programa: 'ALL',
      anio: [],
      periodo: [],
      agrupacion: 'sem',
    });
    setOpenFilter(null);
  };

  const handleOpenChange = (name: string, open: boolean) => {
    setOpenFilter((current) => {
      if (open) return name;
      return current === name ? null : current;
    });
  };

  return (
    <section className="dashboard-panel p-3.5 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--linea)] pb-3">
        <div>
          <h2 className="text-xs font-bold text-[var(--ink)]">Filtros de análisis</h2>
          <p className="mt-0.5 text-[10px] text-slate-500">Combina criterios para ajustar los resultados del tablero.</p>
        </div>
        <button
          type="button"
          onClick={resetFilters}
          disabled={activeFilterCount === 0}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--linea)] px-3 py-1.5 text-[11px] font-semibold text-[var(--granate)] transition hover:bg-[var(--crema)] disabled:cursor-not-allowed disabled:opacity-45"
        >
          <RotateCcw size={13} aria-hidden="true" />
          Restablecer
          {activeFilterCount > 0 && <span className="rounded-full bg-[var(--granate)] px-1.5 text-[9px] text-white">{activeFilterCount}</span>}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <MultiSelectFilter
          label="Facultades"
          options={facultadOptions}
          selected={filters.facultad}
          onChange={handleFacultyChange}
          open={openFilter === 'facultad'}
          onOpenChange={(open) => handleOpenChange('facultad', open)}
          disabled={scope.lockFacultad}
        />

        <MultiSelectFilter
          label="Escuelas"
          options={escuelaOptions.map((escuela) => ({ value: escuela, label: escuela }))}
          selected={schoolSelection}
          onChange={(escuela) => onChange({ ...filters, escuela, programa: 'ALL' })}
          open={openFilter === 'escuela'}
          onOpenChange={(open) => handleOpenChange('escuela', open)}
          disabled={scope.lockEscuela}
        />

        {showProgram && (
          <div>
            <label className={labelCls} htmlFor="program-filter">Programa</label>
            <select
              id="program-filter"
              value={filters.programa}
              onChange={(event) => onChange({ ...filters, programa: event.target.value })}
              className="dashboard-control min-h-10 w-full rounded-lg border px-2.5 py-2 text-xs"
            >
              <option value="ALL">Todos</option>
              {programaOptions.map((programa) => (
                <option key={programa} value={programa}>{programa}</option>
              ))}
            </select>
          </div>
        )}

        <MultiSelectFilter
          label="Años"
          options={yearOptions}
          selected={filters.anio}
          onChange={(anio) => onChange({ ...filters, anio, periodo: [] })}
          open={openFilter === 'anio'}
          onOpenChange={(open) => handleOpenChange('anio', open)}
        />

        {filters.agrupacion === 'sem' && (
          <MultiSelectFilter
            label="Periodos semestrales"
            options={periodOptions}
            selected={filters.periodo.filter((period) => availablePeriods.includes(period))}
            onChange={(periodo) => onChange({ ...filters, periodo })}
            open={openFilter === 'periodo'}
            onOpenChange={(open) => handleOpenChange('periodo', open)}
          />
        )}

        <div>
          <span className={labelCls}>Agrupar por</span>
          <div className="inline-flex min-h-10 w-full overflow-hidden rounded-lg border" style={{ borderColor: 'var(--linea)' }}>
            {(['sem', 'anio'] as const).map((grouping) => (
              <button
                key={grouping}
                type="button"
                aria-pressed={filters.agrupacion === grouping}
                onClick={() => onChange({
                  ...filters,
                  agrupacion: grouping,
                  periodo: grouping === 'anio' ? [] : filters.periodo,
                })}
                className={`flex-1 px-2 py-2 text-[11px] font-medium transition-colors ${
                  filters.agrupacion === grouping
                    ? 'bg-[var(--granate)] text-white'
                    : 'bg-[var(--papel)] text-slate-500 hover:bg-[var(--crema)]'
                }`}
              >
                {grouping === 'sem' ? 'Semestral' : 'Anual'}
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-3 text-[10px] text-slate-500">
        Puedes combinar varias opciones; se incluyen los resultados de todas las opciones elegidas. En vista anual se consideran los semestres completos de cada año.
      </p>
    </section>
  );
}
