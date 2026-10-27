// Lógica del programa de vigilancia del Complejo (sin dependencias de React ni Firebase).

export const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export interface VigBloque {
    id: string;
    nombre: string;            // ej. "Martes"
    dia: number;               // 0=domingo … 6=sábado (día en que se reúnen las congregaciones del bloque)
    congregaciones: string[];  // las que se organizan entre sí ese día
    turnos: string[];          // ej. ["7:20-7:50pm", …]
}

export interface VigCongregacion {
    nombre: string;
    salon?: string;
}

export interface VigConfig {
    complejo: string;
    salones: string[];
    congregaciones: VigCongregacion[];
    bloques: VigBloque[];
}

export type VigEventoTipo = 'asamblea' | 'visitaSC' | 'conmemoracion' | 'otro';

export interface VigEvento {
    id: string;
    tipo: VigEventoTipo;
    fechaInicio: string;       // YYYY-MM-DD
    fechaFin: string;          // YYYY-MM-DD (igual a inicio si es de un día)
    // asamblea: congregaciones que se ausentan · visitaSC: la congregación visitada
    // conmemoracion: congregaciones que SE QUEDAN en el complejo · otro: congregaciones ausentes
    congregaciones: string[];
    notas?: string;
    moverA?: string;           // solo visitaSC: nueva fecha de los bloques que se reúnen ese día
}

export interface VigHistorial {
    at: number;
    quien: string;
    texto: string;
}

export interface VigPrograma {
    year: number;
    asignaciones: { [bloqueId: string]: { [mes: string]: string[] } }; // mes "0".."11" → congregación por turno
    eventos: VigEvento[];
    coberturas: { [clave: string]: string };                            // cambios manuales de quién cubre
    historial: VigHistorial[];
}

export interface VigImpacto {
    clave: string;
    fecha: string;             // fecha efectiva (puede ser la nueva si el bloque cambió de día)
    fechaOriginal: string;
    bloqueId: string;
    bloqueNombre: string;
    turnoIdx: number;
    turno: string;
    titular: string;
    motivo: string;
    sugerido: string | null;
    cubre: string | null;      // coberturas manuales si existen; si no, lo sugerido
    manual: boolean;
    eventoId: string;
}

export interface VigCambioDia {
    eventoId: string;
    bloqueNombre: string;
    fechaOriginal: string;
    fechaNueva: string;
}

export interface VigSinReunion {
    bloqueNombre: string;
    fecha: string;
    motivo: string;
}

export interface VigAnalisis {
    impactos: VigImpacto[];
    cambiosDeDia: VigCambioDia[];
    sinReunion: VigSinReunion[];
    conteoCoberturas: { [cong: string]: number };
    avisos: string[];
}

export const emptyPrograma = (year: number): VigPrograma => ({
    year, asignaciones: {}, eventos: [], coberturas: {}, historial: [],
});

export const defaultConfig = (): VigConfig => {
    const congs = ['Jardines de Andalucia', 'Las Jacarandas', 'Nacozari', 'Cerro de la Silla'];
    return {
        complejo: 'Complejo Las Palmas',
        salones: ['Salón 1', 'Salón 2', 'Salón 3', 'Salón 4'],
        congregaciones: congs.map(nombre => ({ nombre })),
        bloques: [
            { id: 'martes', nombre: 'Martes', dia: 2, congregaciones: [...congs], turnos: ['7:20-7:50pm', '7:50-8:20pm', '8:20-8:50pm', '8:50-9:20pm'] },
            { id: 'sabado', nombre: 'Sábado', dia: 6, congregaciones: [...congs], turnos: ['4:15-4:50pm', '4:50-5:20pm', '5:20-5:50pm', '5:50-6:20pm'] },
        ],
    };
};

// ───────── Fechas (siempre en hora local, sin saltos por zona horaria) ─────────
export const ymd = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const parseYmd = (s: string): Date => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
};

export const datesBetween = (start: string, end: string): string[] => {
    const out: string[] = [];
    if (!start) return out;
    const a = parseYmd(start);
    const b = parseYmd(end || start);
    for (let d = new Date(a); d <= b && out.length < 400; d.setDate(d.getDate() + 1)) out.push(ymd(d));
    return out;
};

export const formatFecha = (s: string): string => {
    const d = parseYmd(s);
    return `${DIAS[d.getDay()].slice(0, 3)} ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
};

// ───────── Rotación mensual ─────────
/** Reparte los turnos de cada mes rotando las congregaciones, para que nadie quede siempre con el mismo turno. */
export const generarRotacion = (bloque: VigBloque, desfase = 0): { [mes: string]: string[] } => {
    const n = bloque.congregaciones.length;
    const t = bloque.turnos.length;
    const out: { [mes: string]: string[] } = {};
    for (let m = 0; m < 12; m++) {
        if (n === 0) { out[String(m)] = bloque.turnos.map(() => ''); continue; }
        const paso = n <= t ? 1 : t; // con más congregaciones que turnos, cada mes entra el siguiente grupo
        const offset = (m * paso + desfase) % n;
        out[String(m)] = bloque.turnos.map((_, k) => bloque.congregaciones[(k + offset) % n]);
    }
    return out;
};

// ───────── Eventos → turnos que hay que cubrir ─────────
export const claveCobertura = (bloqueId: string, fecha: string, turnoIdx: number) => `${bloqueId}|${fecha}|${turnoIdx}`;

interface AusenciaDia {
    ausentes: Map<string, { motivo: string; eventoId: string }>;
    soloEstas: Set<string> | null; // Conmemoración: solo estas congregaciones pueden cubrir
}

export const analizar = (config: VigConfig, programa: VigPrograma): VigAnalisis => {
    const year = programa.year;
    const todas = Array.from(new Set([
        ...config.congregaciones.map(c => c.nombre),
        ...config.bloques.flatMap(b => b.congregaciones),
    ])).filter(Boolean).sort((a, b) => a.localeCompare(b, 'es'));

    // 1. Ausencias por fecha
    const porFecha = new Map<string, AusenciaDia>();
    const diaDe = (f: string) => {
        if (!porFecha.has(f)) porFecha.set(f, { ausentes: new Map(), soloEstas: null });
        return porFecha.get(f)!;
    };
    const cambiosDeDia: VigCambioDia[] = [];
    const sinReunionMap = new Map<string, string>(); // `${bloqueId}|${fecha}` → motivo
    const movidos = new Map<string, { nueva: string; eventoId: string }>(); // `${bloqueId}|${fechaOriginal}` → nueva fecha

    for (const ev of programa.eventos || []) {
        const fechas = datesBetween(ev.fechaInicio, ev.fechaFin);
        for (const f of fechas) {
            const info = diaDe(f);
            if (ev.tipo === 'asamblea' || ev.tipo === 'otro') {
                const label = ev.tipo === 'asamblea' ? 'Asamblea' : (ev.notas || 'Evento');
                ev.congregaciones.forEach(c => info.ausentes.set(c, { motivo: `${label}: ${c} se ausenta`, eventoId: ev.id }));
            } else if (ev.tipo === 'visitaSC') {
                ev.congregaciones.forEach(c => info.ausentes.set(c, { motivo: `Visita del SC a ${c}`, eventoId: ev.id }));
                if (ev.moverA) {
                    const dia = parseYmd(f).getDay();
                    config.bloques.filter(b => b.dia === dia).forEach(b => {
                        movidos.set(`${b.id}|${f}`, { nueva: ev.moverA!, eventoId: ev.id });
                        cambiosDeDia.push({ eventoId: ev.id, bloqueNombre: b.nombre, fechaOriginal: f, fechaNueva: ev.moverA! });
                    });
                }
            } else if (ev.tipo === 'conmemoracion') {
                const quedan = new Set(ev.congregaciones);
                info.soloEstas = quedan;
                // Esa semana no se celebra la reunión del mismo tipo: entre semana (lun–vie) o fin de semana (sáb–dom).
                const dow = parseYmd(f).getDay();
                const esEntreSemana = dow >= 1 && dow <= 5;
                const lunes = parseYmd(f);
                lunes.setDate(lunes.getDate() - ((dow + 6) % 7));
                for (let i = 0; i < 7; i++) {
                    const dia = new Date(lunes); dia.setDate(lunes.getDate() + i);
                    const fd = ymd(dia);
                    if (fd === f) continue; // el día de la Conmemoración sí requiere vigilancia
                    const wd = dia.getDay();
                    const mismoTipo = esEntreSemana ? (wd >= 1 && wd <= 5) : (wd === 0 || wd === 6);
                    if (!mismoTipo) continue;
                    config.bloques.filter(b => b.dia === wd).forEach(b =>
                        sinReunionMap.set(`${b.id}|${fd}`, `Conmemoración: esa semana no hay reunión de ${esEntreSemana ? 'entre semana' : 'fin de semana'}`));
                }
                todas.filter(c => !quedan.has(c)).forEach(c =>
                    info.ausentes.set(c, { motivo: 'Conmemoración: renta salón, no se queda en el complejo', eventoId: ev.id }));
            }
        }
    }

    // 2. Ocupación por fecha (quién ya tiene turno ese día) y turnos afectados
    const ocupacion = new Map<string, Map<string, number>>();
    const sumaOcup = (fecha: string, cong: string) => {
        if (!ocupacion.has(fecha)) ocupacion.set(fecha, new Map());
        const m = ocupacion.get(fecha)!;
        m.set(cong, (m.get(cong) || 0) + 1);
    };
    const afectados: Omit<VigImpacto, 'sugerido' | 'cubre' | 'manual'>[] = [];
    const sinReunion: VigSinReunion[] = [];

    for (const b of config.bloques) {
        for (let d = new Date(year, 0, 1); d.getFullYear() === year; d.setDate(d.getDate() + 1)) {
            if (d.getDay() !== b.dia) continue;
            const fechaOrig = ymd(d);
            const motivoSin = sinReunionMap.get(`${b.id}|${fechaOrig}`);
            if (motivoSin) {
                sinReunion.push({ bloqueNombre: b.nombre, fecha: fechaOrig, motivo: motivoSin });
                continue;
            }
            const mov = movidos.get(`${b.id}|${fechaOrig}`);
            const fechaEf = mov?.nueva || fechaOrig;
            const asign = programa.asignaciones?.[b.id]?.[String(d.getMonth())] || [];
            const ausDia = porFecha.get(fechaOrig);
            b.turnos.forEach((turno, idx) => {
                const titular = asign[idx] || '';
                const aus = titular ? ausDia?.ausentes.get(titular) : undefined;
                if (aus) {
                    afectados.push({
                        clave: claveCobertura(b.id, fechaOrig, idx), fecha: fechaEf, fechaOriginal: fechaOrig,
                        bloqueId: b.id, bloqueNombre: b.nombre, turnoIdx: idx, turno, titular,
                        motivo: aus.motivo, eventoId: aus.eventoId,
                    });
                } else if (titular) {
                    sumaOcup(fechaEf, titular);
                }
            });
        }
    }
    sinReunion.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.bloqueNombre.localeCompare(b.bloqueNombre));
    afectados.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.bloqueNombre.localeCompare(b.bloqueNombre) || a.turnoIdx - b.turnoIdx);

    // 3. Asignar quién cubre, en orden cronológico y repartiendo parejo
    const conteo: { [c: string]: number } = {};
    todas.forEach(c => (conteo[c] = 0));
    const avisos: string[] = [];
    const impactos: VigImpacto[] = [];
    const bloquePorId = new Map(config.bloques.map(b => [b.id, b]));

    for (const a of afectados) {
        const manual = programa.coberturas?.[a.clave];
        let sugerido: string | null = null;
        const info = porFecha.get(a.fechaOriginal);
        const candidatas = todas.filter(c => !info?.ausentes.has(c) && (!info?.soloEstas || info.soloEstas.has(c)));
        const mismoBloque = new Set(bloquePorId.get(a.bloqueId)?.congregaciones || []);
        let mejor = Infinity;
        for (const c of candidatas) {
            const turnosEseDia = ocupacion.get(a.fecha)?.get(c) || 0;
            const costo = (conteo[c] || 0) + turnosEseDia * 4 - (mismoBloque.has(c) ? 0.5 : 0);
            if (costo < mejor) { mejor = costo; sugerido = c; }
        }
        const cubre = manual || sugerido;
        if (cubre) {
            conteo[cubre] = (conteo[cubre] || 0) + 1;
            sumaOcup(a.fecha, cubre);
        } else {
            avisos.push(`${formatFecha(a.fecha)} · ${a.bloqueNombre} · ${a.turno}: no hay congregación disponible para cubrir a ${a.titular}.`);
        }
        impactos.push({ ...a, sugerido, cubre: cubre || null, manual: !!manual });
    }

    // 4. Avisos de días con muchas ausencias
    porFecha.forEach((info, fecha) => {
        const asamblea = Array.from(info.ausentes.values()).filter(v => v.motivo.startsWith('Asamblea')).length;
        if (asamblea >= 3) avisos.push(`${formatFecha(fecha)}: ${asamblea} congregaciones en asamblea al mismo tiempo; revisa que haya quien cubra.`);
    });

    return { impactos, cambiosDeDia, sinReunion, conteoCoberturas: conteo, avisos };
};
