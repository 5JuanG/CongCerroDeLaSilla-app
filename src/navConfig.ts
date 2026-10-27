import { UserRole, View, Permission } from './types';

export interface NavItem {
    view: View;
    label: string;
    tooltip?: string;
}

export interface NavSection {
    title?: string;
    items: NavItem[];
}

export interface NavGroup {
    id: string;
    label: string;
    sections: NavSection[];
}

/**
 * Estructura del menú. Para mover una página de categoría, solo cambia de lugar su línea aquí.
 * Los `view` son los mismos de siempre, así que permisos y rutas no cambian.
 */
export const NAV_GROUPS: NavGroup[] = [
    {
        id: 'inicio',
        label: 'Inicio',
        sections: [{ items: [{ view: 'home', label: 'Inicio' }] }],
    },
    {
        id: 'predicacion',
        label: 'Predicación',
        sections: [
            {
                title: 'Mi servicio',
                items: [
                    { view: 'informeServicio', label: 'Informar Servicio' },
                    { view: 'precursorAuxiliar', label: 'Prec. Auxiliar' },
                ],
            },
            {
                title: 'Organización',
                items: [
                    { view: 'programaPredicacionSemanal', label: 'Programa de Predicación', tooltip: 'Organización semanal de grupos, capitanes y lugares de salida.' },
                    { view: 'territorios', label: 'Territorios' },
                ],
            },
        ],
    },
    {
        id: 'reuniones',
        label: 'Reuniones',
        sections: [
            {
                title: 'Programas',
                items: [
                    { view: 'vidaYMinisterio', label: 'Vida y Ministerio' },
                    { view: 'reunionPublica', label: 'Reunión Pública', tooltip: 'Programa y asignación de discursos públicos para visitantes y la congregación.' },
                    { view: 'asignacionesReunion', label: 'Generar Acomodadores' },
                    { view: 'programaServiciosAuxiliares', label: 'Programa de Acomodadores' },
                ],
            },
            {
                title: 'Asistencia',
                items: [
                    { view: 'asistenciaForm', label: 'Formulario de Asistencia' },
                    { view: 'asistenciaReporte', label: 'Reporte Anual' },
                ],
            },
            {
                title: 'Visitas',
                items: [{ view: 'visitaSC', label: 'Visita del SC' }],
            },
        ],
    },
    {
        id: 'publicadores',
        label: 'Publicadores',
        sections: [
            {
                title: 'Personas',
                items: [
                    { view: 'publicadores', label: 'Publicadores' },
                    { view: 'registrosServicio', label: 'Tarjetas de Publicador' },
                ],
            },
            {
                title: 'Organización',
                items: [{ view: 'grupos', label: 'Grupos' }],
            },
        ],
    },
    {
        id: 'informes',
        label: 'Informes',
        sections: [
            {
                title: 'Informes',
                items: [
                    { view: 'informeMensualGrupo', label: 'Informe Mensual' },
                    { view: 'informeMensualConsolidado', label: 'Informe a la Sucursal' },
                    { view: 'seguimientoInformes', label: 'Agente de Informes', tooltip: 'Seguimiento y recordatorios automáticos de informes por WhatsApp.' },
                ],
            },
            {
                title: 'Dashboards',
                items: [
                    { view: 'dashboardCursos', label: 'Cursos Bíblicos' },
                    { view: 'dashboardPrecursores', label: 'Precursores' },
                ],
            },
        ],
    },
    {
        id: 'administracion',
        label: 'Administración',
        sections: [
            {
                title: 'Congregación',
                items: [
                    { view: 'registroTransaccion', label: 'Registro de Transacciones', tooltip: 'Donaciones y otras transacciones financieras de la congregación.' },
                    { view: 'gestionContenidoInvitacion', label: 'Contenido de Invitación' },
                ],
            },
            {
                title: 'Sistema',
                items: [
                    { view: 'controlAcceso', label: 'Control de Acceso' },
                    { view: 'vigilancia', label: 'Vigilancia' },
                ],
            },
        ],
    },
];

/** Mismo criterio de permisos que usaba el Sidebar anterior, pero devolviendo la estructura por grupos. */
export const getVisibleNavGroups = (
    userRole: UserRole,
    userPermissions: Permission[],
    isCommitteeMember: boolean
): NavGroup[] => {
    const role = (userRole || '').toLowerCase();
    const isPrivileged = role === 'admin' || role === 'secretario' || isCommitteeMember;

    let canSee: (view: View) => boolean;
    if (isPrivileged) {
        canSee = () => true;
    } else {
        const allowed = new Set<View>(userPermissions as unknown as View[]);
        // Permiso implícito: quien administra asignaciones ve la generación de acomodadores.
        if (userPermissions.includes('manageMeetingAssignments' as Permission)) {
            allowed.add('asignacionesReunion');
        }
        const alwaysVisible: View[] = ['home', 'informeServicio', 'precursorAuxiliar', 'programaServiciosAuxiliares'];
        canSee = (view) => alwaysVisible.includes(view) || allowed.has(view);
    }

    return NAV_GROUPS
        .map(group => ({
            ...group,
            sections: group.sections
                .map(section => ({ ...section, items: section.items.filter(item => canSee(item.view)) }))
                .filter(section => section.items.length > 0),
        }))
        .filter(group => group.sections.length > 0);
};

export const flattenGroupItems = (group: NavGroup): NavItem[] =>
    group.sections.flatMap(section => section.items);

export const findGroupForView = (groups: NavGroup[], view: View): NavGroup | undefined =>
    groups.find(group => flattenGroupItems(group).some(item => item.view === view));
