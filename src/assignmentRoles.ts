// Fuente única de verdad para los "Privilegios de Asignación" de los publicadores.
// Publicadores.tsx (casillas), AsignacionesReunion.tsx (generador/selects) y el PDF
// de privilegios deben usar SIEMPRE estos nombres. Los nombres antiguos se aceptan
// solo como alias y se convierten al nombre actual (ver normalizeRoles).

export const ASSIGNMENT_ROLES = [
    'Presidente',
    'Acomodador PP',
    'Acomodador Puerta del Auditorio',
    'Acomodador de Auditorio',
    'Micrófonos',
    'Vigilante',
    'Lector de la Atalaya',
    'Conductor de la Atalaya',
    'Capitán para Predicación',
    'Oración',
    'Califica para Discursar',
] as const;

const LEGACY_ALIASES: Record<string, string> = {
    'Micrófono': 'Micrófonos',
    'Acomodador en la puerta Principal': 'Acomodador PP',
    'Acomodador de la puerta del Auditorio': 'Acomodador Puerta del Auditorio',
    'Acomodador de los Asistentes': 'Acomodador de Auditorio',
};

export const normalizeRole = (role: string): string => {
    const r = String(role ?? '').trim();
    return LEGACY_ALIASES[r] ?? r;
};

// Lista de privilegios del publicador con nombres actuales y sin duplicados.
export const normalizeRoles = (roles: unknown): string[] => {
    if (!Array.isArray(roles)) return [];
    return [...new Set(roles.map(r => normalizeRole(r as string)).filter(Boolean))];
};

export const hasRole = (publisher: { asignacionesDisponibles?: unknown }, role: string): boolean =>
    normalizeRoles(publisher.asignacionesDisponibles).includes(normalizeRole(role));
