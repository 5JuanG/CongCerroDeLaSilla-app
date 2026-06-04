import { Permission } from './types';

export const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
export const SERVICE_YEAR_MONTHS = [...MONTHS.slice(8), ...MONTHS.slice(0, 8)];

export const ALL_PERMISSIONS: Permission[] = [
    // Views
    'asistenciaForm', 'asistenciaReporte', 'publicadores', 'registrosServicio', 'grupos',
    'informeServicio', 'territorios', 'precursorAuxiliar', 'home', 'controlAcceso',
    'informeMensualGrupo', 'gestionContenidoInvitacion', 'informeMensualConsolidado',
    'dashboardCursos', 'dashboardPrecursores', 'asignacionesReunion',
    'programaServiciosAuxiliares', 'vidaYMinisterio', 'registroTransaccion', 'reunionPublica', 'vigilancia', 'visitaSC',
    // Granular Permissions
    'editAsistenciaReporte', 'managePublicadores', 'editRegistrosServicio', 'manageGrupos',
    'configVidaYMinisterio', 'manageMeetingAssignments', 'managePublicTalks', 'resetData'
];

export const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%239CA3AF'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z'/%3E%3C/svg%3E";
export const DEFAULT_MAP_ERROR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 800'%3E%3Crect width='1200' height='800' fill='%23e2e8f0'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='40' fill='%2364748b'%3EError al cargar mapa%3C/text%3E%3C/svg%3E";

