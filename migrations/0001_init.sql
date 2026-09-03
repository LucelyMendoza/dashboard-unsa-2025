-- Tabla única de hechos académicos (reemplaza public/data/initialData.json).
-- Clave de deduplicación: ESCUELA + PERIODO + CODIGO (asignatura) + GRUPO.
-- FACULTAD se guarda desnormalizada (resuelta en el import vía school-catalog.ts)
-- porque el Excel de origen (SISACAD) no trae esa columna.
CREATE TABLE IF NOT EXISTS academic_records (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  periodo       TEXT    NOT NULL,               -- p.ej. '2024-A'
  anio          INTEGER NOT NULL,                -- derivado de periodo
  facultad      TEXT    NOT NULL,
  escuela       TEXT    NOT NULL,
  codigo        TEXT    NOT NULL,                -- código de asignatura (col. CODIGO)
  asignatura    TEXT    NOT NULL,
  grupo         TEXT    NOT NULL DEFAULT '',      -- col. GRUPOS ('A', 'X', ...)
  docente       TEXT    NOT NULL DEFAULT '(sin especificar)',
  matriculados  INTEGER NOT NULL DEFAULT 0,
  aprobados     INTEGER NOT NULL DEFAULT 0,
  desaprobados  INTEGER NOT NULL DEFAULT 0,
  abandonos     INTEGER NOT NULL DEFAULT 0,
  retiros       INTEGER NOT NULL DEFAULT 0,
  promedio      REAL    NOT NULL DEFAULT 0,
  source_file   TEXT,                             -- nombre del Excel de origen (auditoría)
  imported_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (escuela, periodo, codigo, grupo)
);

CREATE INDEX IF NOT EXISTS idx_ar_periodo  ON academic_records(periodo);
CREATE INDEX IF NOT EXISTS idx_ar_facultad ON academic_records(facultad);
CREATE INDEX IF NOT EXISTS idx_ar_escuela  ON academic_records(escuela);

-- Log de cada carga de Excel (auditoría de quién importó qué y cuándo).
CREATE TABLE IF NOT EXISTS import_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_email     TEXT    NOT NULL,
  source_file     TEXT    NOT NULL,
  total_filas     INTEGER NOT NULL,
  nuevos          INTEGER NOT NULL,
  duplicados      INTEGER NOT NULL,
  errores         INTEGER NOT NULL,
  imported_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);
