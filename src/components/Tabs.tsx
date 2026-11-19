








































































































































































































































































































import React from 'react';

export interface TabDef<K extends string = string> {
  key: K;
  label: string;
}

export default function Tabs<K extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: TabDef<K>[];
  active: K;
  onChange: (k: K) => void;
}) {
  return (
    <div className="border-b -mx-4 px-4 sm:mx-0 sm:px-0" style={{ borderColor: 'var(--linea)' }}>
      <div className="flex gap-2 overflow-x-auto no-scrollbar" role="group" aria-label="Secciones del tablero">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            aria-pressed={active === t.key}
            className={`shrink-0 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--dorado-oscuro)] ${
              active === t.key
                ? 'border-[var(--dorado-oscuro)] text-[var(--granate)]'
                : 'border-transparent text-[var(--texto-sec)] hover:text-[var(--ink)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
