ALTER TABLE academic_records RENAME TO academic_records_previous;

CREATE TABLE academic_records (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  periodo       TEXT    NOT NULL,
  anio          INTEGER NOT NULL,
  facultad      TEXT    NOT NULL,
  escuela       TEXT    NOT NULL,
  programa      TEXT    NOT NULL DEFAULT '',
  codigo        TEXT    NOT NULL,
  cod_asig      TEXT    NOT NULL DEFAULT '',
  digito        TEXT    NOT NULL DEFAULT '',
  nro           TEXT    NOT NULL DEFAULT '',
  asignatura    TEXT    NOT NULL,
  grupo         TEXT    NOT NULL DEFAULT '',
  docente       TEXT    NOT NULL DEFAULT '(sin especificar)',
  matriculados  INTEGER NOT NULL DEFAULT 0,
  aprobados     INTEGER NOT NULL DEFAULT 0,
  desaprobados  INTEGER NOT NULL DEFAULT 0,
  abandonos     INTEGER NOT NULL DEFAULT 0,
  retiros       INTEGER NOT NULL DEFAULT 0,
  aprob_11_13   INTEGER NOT NULL DEFAULT 0,
  aprob_14_16   INTEGER NOT NULL DEFAULT 0,
  aprob_17_20   INTEGER NOT NULL DEFAULT 0,
  anio_estudios TEXT    NOT NULL DEFAULT '',
  promedio      REAL    NOT NULL DEFAULT 0,
  source_file   TEXT,
  imported_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO academic_records (
  id, periodo, anio, facultad, escuela, programa, codigo, cod_asig, digito, nro,
  asignatura, grupo, docente, matriculados, aprobados, desaprobados, abandonos,
  retiros, aprob_11_13, aprob_14_16, aprob_17_20, anio_estudios, promedio,
  source_file, imported_at
)
SELECT
  id, periodo, anio, facultad, escuela, programa, codigo, cod_asig, digito, nro,
  asignatura, grupo, docente, matriculados, aprobados, desaprobados, abandonos,
  retiros, aprob_11_13, aprob_14_16, aprob_17_20, anio_estudios, promedio,
  source_file, imported_at
FROM academic_records_previous;

DROP TABLE academic_records_previous;

CREATE INDEX idx_ar_periodo ON academic_records(periodo);
CREATE INDEX idx_ar_facultad ON academic_records(facultad);
CREATE INDEX idx_ar_escuela ON academic_records(escuela);
CREATE INDEX idx_ar_import_lookup
  ON academic_records(periodo, facultad, escuela, codigo, grupo);
