import { Permission } from './types';

export const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
export const SERVICE_YEAR_MONTHS = [...MONTHS.slice(8), ...MONTHS.slice(0, 8)];

export const ALL_PERMISSIONS: Permission[] = [
    // Views
    'asistenciaForm', 'asistenciaReporte', 'publicadores', 'registrosServicio', 'grupos',
    'informeServicio', 'territorios', 'precursorAuxiliar', 'home', 'controlAcceso',
    'informeMensualGrupo', 'gestionContenidoInvitacion', 'informeMensualConsolidado',
    'dashboardCursos', 'dashboardPrecursores', 'asignacionesReunion',
    'programaServiciosAuxiliares', 'vidaYMinisterio', 'registroTransaccion', 'reunionPublica', 'vigilancia',
    // Granular Permissions
    'editAsistenciaReporte', 'managePublicadores', 'editRegistrosServicio', 'manageGrupos',
    'configVidaYMinisterio', 'manageMeetingAssignments', 'managePublicTalks', 'resetData'
];
