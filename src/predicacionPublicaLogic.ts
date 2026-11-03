// Predicación pública con exhibidores: modelo de datos y cálculo de semanas.
// Sin servidor: la "limpieza automática" es que cada semana usa su propio documento
// (predicacion_publica/{martes yyyy-mm-dd}), así que al cambiar de semana el formulario nace vacío.

export interface Turno { id: string; hora: string; dias: number[] }          // dias: 2=Mar ... 6=Sáb (Date.getDay)
export interface Punto { id: string; nombre: string; cupo: number; turnos: Turno[] }
export interface Inscrito { pubId: string; nombre: string; grupo: string; ts: number }
export type Inscritos = Record<string, Inscrito[]>;

export const DIAS = [
    { n: 2, corto: 'Mar', largo: 'Martes' },
    { n: 3, corto: 'Mié', largo: 'Miércoles' },
    { n: 4, corto: 'Jue', largo: 'Jueves' },
    { n: 5, corto: 'Vie', largo: 'Viernes' },
    { n: 6, corto: 'Sáb', largo: 'Sábado' },
];

export const CUPO_DEFECTO = 4;
export const CONFIG_DOC = 'predicacion_publica_config';
export const SEMANAS_COLLECTION = 'predicacion_publica';

export const PUNTOS_EJEMPLO: Punto[] = [
    { id: 'livas-fresa', nombre: 'Pablo Livas, Entre Fresa y Madre Selva', cupo: 4, turnos: [{ id: 't1', hora: '7 am a 9 am', dias: [2, 3, 4, 5, 6] }] },
    { id: 'livas-mimosa', nombre: 'Pablo Livas esquina con calle Mimosa', cupo: 4, turnos: [{ id: 't1', hora: '7 am a 9 am', dias: [2, 3, 4, 5, 6] }] },
    { id: 'primavera-fresa', nombre: 'Primavera y Fresa', cupo: 4, turnos: [{ id: 't1', hora: '7 am a 9 am', dias: [2, 3, 4, 5, 6] }] },
    { id: 'enredadera-zapata', nombre: 'Enredadera y Emiliano Zapata', cupo: 4, turnos: [{ id: 't1', hora: '7 am a 9 am', dias: [2, 3, 4, 5, 6] }] },
    { id: 'primavera-polivalente', nombre: 'Primavera afuera del Polivalente (Por la tarde)', cupo: 4, turnos: [{ id: 't1', hora: '6 pm a 8 pm', dias: [3, 4, 5] }] },
];

export const newId = () => Math.random().toString(36).slice(2, 8);
export const slotKey = (puntoId: string, turnoId: string, dia: number) => `${puntoId}__${turnoId}__${dia}`;

const pad = (n: number) => String(n).padStart(2, '0');
export const weekIdOf = (tuesday: Date) => `${tuesday.getFullYear()}-${pad(tuesday.getMonth() + 1)}-${pad(tuesday.getDate())}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());

export type EstadoSemana = 'abierto' | 'pronto' | 'cerrado';
export interface SemanaInfo { tuesday: Date; estado: EstadoSemana; abre: Date; cierra: Date; proxAbre: Date }

/**
 * Semana de martes a sábado que se está llenando.
 * Abre el sábado anterior a las 12:00 y cierra el lunes a las 20:00.
 * Pasado el cierre queda "cerrado" hasta que abra la siguiente (sábado 12:00).
 */
export const getSemana = (now: Date = new Date()): SemanaInfo => {
    let t = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    while (t.getDay() !== 2) t = addDays(t, 1);
    const abreDe = (tue: Date) => { const s = addDays(tue, -3); return new Date(s.getFullYear(), s.getMonth(), s.getDate(), 12, 0); };
    const cierraDe = (tue: Date) => { const m = addDays(tue, -1); return new Date(m.getFullYear(), m.getMonth(), m.getDate(), 20, 0); };
    const abre = abreDe(t), cierra = cierraDe(t);
    let estado: EstadoSemana = 'cerrado';
    if (now < abre) estado = 'pronto';
    else if (now < cierra) estado = 'abierto';
    return { tuesday: t, estado, abre, cierra, proxAbre: estado === 'cerrado' ? abreDe(addDays(t, 7)) : abre };
};

export const fechaDia = (tuesday: Date, dia: number) => addDays(tuesday, dia - 2);
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_C = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const fmtCorta = (d: Date) => `${d.getDate()} de ${MESES[d.getMonth()]}`;
export const fmtFechaHora = (d: Date) => {
    const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const h = d.getHours(); const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${dias[d.getDay()]} ${d.getDate()} de ${MESES_C[d.getMonth()]} a las ${h12}:${pad(d.getMinutes())} ${h < 12 ? 'am' : 'pm'}`;
};
export const tituloSemana = (tuesday: Date) => {
    const a = tuesday, b = fechaDia(tuesday, 6);
    const mismoMes = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
    const rango = mismoMes
        ? `del ${a.getDate()} al ${b.getDate()} de ${MESES[b.getMonth()]} de ${b.getFullYear()}`
        : `del ${fmtCorta(a)} de ${a.getFullYear()} al ${fmtCorta(b)} de ${b.getFullYear()}`;
    return `Programa de predicación pública, Cong. Cerro de la Silla, ${rango}`;
};

export const cupoLleno = (lista: Inscrito[] | undefined, cupo: number) => (lista?.length || 0) >= cupo;
