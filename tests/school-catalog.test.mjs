import assert from 'node:assert/strict';
import test from 'node:test';
import { areaDeFacultad, ESCUELA_A_FACULTAD } from '../src/lib/school-catalog.ts';

test('every faculty in the school catalog belongs to a comparison area', () => {
  const faculties = new Set(Object.values(ESCUELA_A_FACULTAD));
  for (const faculty of faculties) {
    assert.ok(areaDeFacultad(faculty), `Missing academic area for ${faculty}`);
  }
});

test('classifies formal SISACAD faculty labels with prefixes and spelling variants', () => {
  assert.equal(areaDeFacultad('FACULTAD DE CIENCIAS HISTÓRICO SOCIALES'), 'Sociales');
  assert.equal(areaDeFacultad('FACULTAD DE GEOLOGÍA, GEOFÍSICA Y MINAS'), 'Ingenierías');
  assert.equal(areaDeFacultad('FACULTAD DE PSICOLOGÍA, RELACIONES INDUSTRIALES Y CIENCIAS DE LA COMUNICACIÓN'), 'Sociales');
  assert.equal(areaDeFacultad('FACULTAD DE ENFERMERÍA'), 'Biomédicas');
});

test('leaves unknown faculties unclassified instead of assigning an area by guess', () => {
  assert.equal(areaDeFacultad('FACULTAD DE NUEVA FACULTAD'), null);
});
