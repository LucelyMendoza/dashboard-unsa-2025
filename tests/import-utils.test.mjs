import assert from 'node:assert/strict';
import test from 'node:test';
import { getImportRowKey, groupImportRows } from '../src/lib/import-utils.ts';

function makeRow(overrides = {}) {
  return {
    periodo: '2019-A',
    anio: 2019,
    facultad: 'FACULTAD DE CIENCIAS',
    escuela: 'ESCUELA DE CIENCIAS',
    programa: '',
    codigo: 'MAT101',
    codAsig: 'MAT101',
    digito: '',
    nro: '',
    asignatura: 'ALGEBRA LINEAL',
    grupo: 'A',
    docente: 'DOCENTE',
    matriculados: 30,
    aprobados: 25,
    desaprobados: 3,
    abandonos: 1,
    retiros: 1,
    aprob1113: 10,
    aprob1416: 10,
    aprob1720: 5,
    anioEstudios: '1',
    promedio: 13.5,
    _fila: 2,
    ...overrides,
  };
}

test('only groups rows with identical academic data', () => {
  const first = makeRow();
  const identical = makeRow({ _fila: 8 });
  const changedResults = makeRow({ aprobados: 24, desaprobados: 4, _fila: 9 });

  assert.equal(getImportRowKey(first), getImportRowKey(identical));
  assert.notEqual(getImportRowKey(first), getImportRowKey(changedResults));
  assert.equal(groupImportRows([first, identical, changedResults]).size, 2);
});

test('treats assignment accents and letter case as equivalent, but compares other fields', () => {
  const unaccented = makeRow();
  const accented = makeRow({ asignatura: 'Álgebra Lineal', _fila: 10 });
  const differentTeacher = makeRow({ asignatura: 'ÁLGEBRA LINEAL', docente: 'OTRO DOCENTE' });

  assert.equal(getImportRowKey(unaccented), getImportRowKey(accented));
  assert.notEqual(getImportRowKey(unaccented), getImportRowKey(differentTeacher));
  assert.equal(groupImportRows([unaccented, accented, differentTeacher]).size, 2);
});

test('preserves the distinction between N and Ñ in assignment names', () => {
  assert.notEqual(
    getImportRowKey(makeRow({ asignatura: 'ANO LINEAL' })),
    getImportRowKey(makeRow({ asignatura: 'AÑO LINEAL' }))
  );
});
