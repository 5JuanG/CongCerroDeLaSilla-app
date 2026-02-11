import { Dispatch, SetStateAction } from 'react';

export type UserRole = 'admin' | 'overseer' | 'publisher' | 'helper' | 'auxiliary' | 'secretario';

export type View = 'asistenciaForm' | 'asistenciaReporte' | 'publicadores' | 'registrosServicio' | 'grupos' | 'informeServicio' | 'territorios' | 'precursorAuxiliar' | 'home' | 'controlAcceso' | 'informeMensualGrupo' | 'gestionContenidoInvitacion' | 'informeMensualConsolidado' | 'dashboardCursos' | 'dashboardPrecursores' | 'asignacionesReunion' | 'programaServiciosAuxiliares' | 'vidaYMinisterio' | 'registroTransaccion' | 'reunionPublica' | 'vigilancia';

export type GranularPermission =
    'editAsistenciaReporte' |
    'managePublicadores' |
    'editRegistrosServicio' |
    'manageGrupos' |
    'configVidaYMinisterio' |
    'manageMeetingAssignments' |
    'managePublicTalks' |
    'resetData';

export type Permission = View | GranularPermission;

export interface UserData {
    id: string;
    email: string;
    role: UserRole;
    isCommitteeMember: boolean;
    permissions: Permission[];
    authUid?: string;
    publisherId?: string;
}

export interface Publisher {
    id: string;
    [key: string]: any;
    Familia?: string;
    preparedTalks?: number[];
}

export interface ServiceReport {
    id: string;
    idPublicador: string;
    nombrePublicador?: string;
    anioCalendario: number;
    mes: string;
    participacion: boolean;
    precursorAuxiliar: string;
    horas?: number;
    cursosBiblicos?: number;
    notas?: string;
}

export interface AsistenciaData {
    es_sem1: string; es_sem2: string; es_sem3: string; es_sem4: string; es_sem5: string;
    fs_sem1: string; fs_sem2: string; fs_sem3: string; fs_sem4: string; fs_sem5: string;
}

export interface AttendanceRecord extends AsistenciaData {
    id: string;
    ano: number;
    mes: string;
}

export interface TerritoryRecord {
    id: string;
    terrNum: number;
    vueltaNum: number;
    serviceYear: number;
    asignadoA?: string;
    assignedDate?: string;
    completedDate?: string;
    observations?: string;
}

export interface TerritoryMarker {
    id: string;
    terrNum: number;
    x: number; // Porcentaje 0-100
    y: number; // Porcentaje 0-100
    status: 'available' | 'assigned' | 'completed';
    assigneeName?: string;
    lastUpdated: any;
}

export interface TerritoryMap {
    id: string;
    territoryId: string;
    mapUrl: string;
    fileName: string;
    uploadedAt: any;
}

export interface TerritoryResponsible {
    publisherId: string;
    publisherName: string;
    assignedDate: string;
    assignedBy: string;
}

export interface DailyTerritoryAssignment {
    id: string;
    date: string;
    vueltaNum: number;
    territories: number[];
    captain: string;
    assignedDate: string;
    completedDate?: string;
    observations?: string;
    createdBy: string;
    createdAt: any;
}

export interface InvitationContent {
    id: string;
    imageUrl: string;
    phrase: string;
}

export interface HomepageContent {
    id: string;
    imageUrl: string;
    title: string;
    phrase: string;
}

export interface MeetingAssignmentSchedule {
    id: string;
    year: number;
    month: string;
    schedule: { [dateKey: string]: DayAssignment };
    isPublic?: boolean;
}

export interface DayAssignment {
    fechaReunion?: string;
    reunionHorario?: string;
    vigilanciaHorario?: string;
    presidente?: string;
    conductorAtalaya?: string;
    lectorAtalaya?: string;
    acomodadoresPrincipal?: (string | null)[];
    acomodadoresAuditorio?: (string | null)[];
    acomodadoresSala?: (string | null)[];
    microfonos?: (string | null)[];
    vigilantes?: (string | null)[];
    aseo?: string;
    hospitalidad?: string;
}

export interface LMMeetingSchedule {
    id: string;
    year: number;
    month: string;
    weeks: LMWeekAssignment[];
    isPublic?: boolean;
}

export interface LMWeekAssignment {
    [key: string]: any;
}

export interface PioneerApplication {
    id: string;
    nombre: string;
    mes: string;
    deContinuo: boolean;
    status: 'Pendiente' | 'Aprobado';
}

export interface OutgoingTalkAssignment {
    id: string;
    speakerId: string;
    talkNumber: number;
    date: string;
    congregation: string;
}

export interface PublicTalksSchedule {
    [key: string]: any;
    outgoingTalks?: OutgoingTalkAssignment[];
    publicVisibility?: { [yearMonth: string]: boolean };
}

export interface PublicTalkAssignment {
    date: string;
    speakerName: string;
    song: string;
    congregation?: string;
    phone?: string;
}

export interface SpecialEvent {
    id: string;
    date: string;
    description: string;
}

export interface MeetingConfig {
    midweekDay: number;
    midweekTime: string;
    weekendDay: number;
    weekendTime: string;
    specialEvents: SpecialEvent[];
}

export interface VigilanciaConfig {
    tuesdaySlots: string[];
    saturdaySlots: string[];
    congregations: string[];
}

export interface ModalInfo {
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
}

export type ModalType = Dispatch<SetStateAction<ModalInfo | null>>;
