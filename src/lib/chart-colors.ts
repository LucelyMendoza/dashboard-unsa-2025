import type { AcademicArea } from './school-catalog';
import { normalizeFacultyKey } from './school-catalog';

export const INDICATOR_CHART_COLORS = {
  apr: '#15986b',
  des: '#dc8a1f',
  ret: '#347fc1',
  abn: '#d94f57',
} as const;

export const AREA_CHART_COLORS: Record<AcademicArea | 'Sin clasificar', string> = {
  Sociales: '#672631',
  Ingenierías: '#2476a8',
  Biomédicas: '#16805f',
  'Sin clasificar': '#667085',
};

export const FACULTY_CHART_COLORS: Record<string, string> = {
  ADMINISTRACION: '#672631',
  AGRONOMIA: '#15986b',
  'ARQUITECTURA Y URBANISMO': '#347fc1',
  'CIENCIAS BIOLOGICAS': '#d94f57',
  'CIENCIAS CONTABLES Y FINANCIERAS': '#866b3d',
  'CIENCIAS DE LA EDUCACION': '#7353a6',
  'CIENCIAS HISTORICO SOCIALES': '#18898a',
  'CIENCIAS NATURALES Y FORMALES': '#b56826',
  DERECHO: '#486f9a',
  ECONOMIA: '#a54768',
  ENFERMERIA: '#667f2f',
  'FILOSOFIA Y HUMANIDADES': '#b17b13',
  'GEOLOGIA GEOFISICA Y MINAS': '#4a7c87',
  'INGENIERIA CIVIL': '#8d5a40',
  'INGENIERIA DE PROCESOS': '#536982',
  'INGENIERIA DE PRODUCCION Y SERVICIOS': '#9a567d',
  'INGENIERIA GEOLOGICA GEOFISICA Y MINAS': '#4a7c87',
  MEDICINA: '#43855a',
  'PSICOLOGIA RELACIONES INDUSTRIALES Y CIENCIAS DE LA COMUNICACION': '#7a5aa0',
  'PSICOLOGIA RR II Y CS DE LA COMUNICACION': '#7a5aa0',
};

export function getFacultyChartColor(faculty: string): string {
  return FACULTY_CHART_COLORS[normalizeFacultyKey(faculty)] ?? AREA_CHART_COLORS['Sin clasificar'];
}
