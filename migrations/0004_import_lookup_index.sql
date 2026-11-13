CREATE INDEX IF NOT EXISTS idx_ar_import_lookup
  ON academic_records(periodo, facultad, escuela, codigo, grupo);
