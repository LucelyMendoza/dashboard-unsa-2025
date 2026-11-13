export type UserRole = 'ADMIN' | 'VICERRECTOR' | 'DECANO' | 'AUTORIDAD' | 'DIRECTOR';

/** Claves de pestaña del tablero (deben coincidir con TABS en dashboard/page.tsx). */
export type DashboardTab = 'resumen' | 'escuelas' | 'asignaturas' | 'docentes';

export interface UserSession {
  email: string;
  name: string;
  role: UserRole;
  facultad?: string;
  escuela?: string;
  programa?: string;
}

export interface AggregatedRow {
  PERIODO: string;
  AÑO: number;
  FACULTAD: string;
  ESCUELA: string;
  m: number;
  a: number;
  d: number;
  b: number;
  r: number;
  n: number;
  prom: number;
}

export interface ScorecardRow {
  e: string;
  f: string;
  tm: number;
  ta: number;
  td: number;
  tr: number;
  tb: number;
  tn: number;
  sl: number;
  yr: Record<string, number>;
}

export type SubjectRow = [
  periodIndex: number,
  facultyIndex: number,
  schoolIndex: number,
  subjectIndex: number,
  programIndex: number,
  matriculados: number,
  aprobados: number,
  desaprobados: number,
  abandonos: number,
  retirados: number,
  promedio: number
];

export type TeacherRow = [
  teacherIndex: number,
  periodIndex: number,
  facultyIndex: number,
  schoolIndex: number,
  subjectIndex: number,
  programIndex: number,
  matriculados: number,
  aprobados: number,
  desaprobados: number,
  abandonos: number,
  retirados: number
];

export interface DashboardDataset {
  fe: Record<string, string[]>;
  ep: Record<string, string[]>;
  ps: string[];
  fs: string[];
  es: string[];
  pr: string[];
  an: string[];
  ac: string[];
  dn: string[];
  ag: AggregatedRow[];
  sa: SubjectRow[];
  dc: TeacherRow[];
  sc: ScorecardRow[];
  cd: unknown[];
}
