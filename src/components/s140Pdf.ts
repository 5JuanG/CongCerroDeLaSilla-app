// Generador del PDF del programa de Vida y Ministerio como clon del formato S-140-S.
// Se dibuja directamente con jsPDF (texto y rectángulos vectoriales), sin convertir HTML a imagen,
// para que los encabezados de sección queden exactos y el texto sea nítido y seleccionable.
// Colores tomados del modelo: gris #575A5D (Tesoros de la Biblia), dorado #BE8900 (Seamos mejores maestros),
// vino #7E0024 (Nuestra vida cristiana). Hoja carta, dos semanas por página.

type RGB = [number, number, number];
type GetName = (id: string | null | undefined) => string;

const GRAY: RGB = [0x57, 0x5a, 0x5d];
const GOLD: RGB = [0xbe, 0x89, 0x00];
const BURGUNDY: RGB = [0x7e, 0x00, 0x24];
const BLACK: RGB = [0, 0, 0];
const WHITE: RGB = [255, 255, 255];

export interface S140Options {
    congregationName?: string;
    midweekTime?: string;      // "19:30"
    showAuxRoom?: boolean;     // la congregación no usa sala auxiliar: se omite esa columna
}

// Duraciones (min) de lo que no trae tiempo en la guía; solo sirven para calcular la hora de cada parte.
const OPENING_SONG_MIN = 5;
const INTRO_MIN = 1;
const MIDDLE_SONG_MIN = 5;
const CBS_MIN = 30;
const CONCLUSION_MIN = 3;

// Medidas en puntos (hoja carta 612 x 792). Márgenes del modelo: 0.79" a los lados, 0.70" arriba.
const PAGE_W = 612;
const PAGE_H = 792;
const MX = 57;
const MT = 50;
const CONTENT_W = PAGE_W - MX * 2; // 498
const BOTTOM_LIMIT = PAGE_H - 44;
const WEEK_GAP = 14;
const BAR_H = 14.5;

// Métricas de texto. Si dos semanas no caben en una hoja con las normales, se usan las compactas (≈10 % más chicas).
interface Metrics { size: number; dur: number; lineH: number; rowMin: number; base: number; name: number }
const NORMAL: Metrics = { size: 10, dur: 8, lineH: 12, rowMin: 13.5, base: 9.6, name: 10 };
const COMPACT: Metrics = { size: 9, dur: 7.2, lineH: 10.8, rowMin: 12.2, base: 8.7, name: 9 };

const X_TIME = MX;
const X_TEXT = MX + 30;
const TEXT_INDENT = 9;             // espacio de la viñeta
const TEXT_W = 205 - TEXT_INDENT - 4;
const X_LABEL_RIGHT = MX + 30 + 205 + 6 + 62;   // las etiquetas pequeñas terminan aquí (alineadas a la derecha)
const X_NAMES = X_LABEL_RIGHT + 6;
const NAMES_W = MX + CONTENT_W - X_NAMES;       // 175
const BAR_W = 256;

const parseMinutes = (d?: string | null, fallback = 0): number => {
    const m = String(d ?? '').match(/\d+/);
    return m ? Number(m[0]) : fallback;
};

const startMinutes = (time?: string): number => {
    const [h, m] = String(time || '19:30').split(':').map(Number);
    return (Number.isFinite(h) ? h : 19) * 60 + (Number.isFinite(m) ? m : 30);
};

const fmtClock = (mins: number): string => `${Math.floor(mins / 60) % 12 || 12}:${String(mins % 60).padStart(2, '0')}`;

// La guía trae la referencia al final del título ("DE CASA EN CASA. (lmd lección 2 punto 3)."); el S-140 solo lleva el título.
export const cleanTitle = (t?: string | null): string =>
    String(t ?? '').replace(/\s*\((?:[^()]*\b(?:lecci[oó]n|punto|p[aá]g|p[aá]rr|lmd|lff|th|ijwbq|bhs)\b[^()]*)\)\.?\s*$/i, '').trim();

class Painter {
    constructor(public doc: any, public dry: boolean, public m: Metrics = NORMAL) {}

    font(size: number, bold = false, family: 'helvetica' | 'times' = 'helvetica') {
        this.doc.setFont(family, bold ? 'bold' : 'normal');
        this.doc.setFontSize(size);
    }
    color(c: RGB) { this.doc.setTextColor(c[0], c[1], c[2]); }
    wrap(text: string, width: number, size: number, bold = false): string[] {
        this.font(size, bold);
        const out = this.doc.splitTextToSize(String(text || ''), width) as string[];
        return out.length ? out : [''];
    }
    width(text: string, size: number, bold = false): number {
        this.font(size, bold);
        return this.doc.getTextWidth(text);
    }
    text(str: string, x: number, y: number, size: number, bold: boolean, c: RGB, opts?: any, family: 'helvetica' | 'times' = 'helvetica') {
        if (this.dry || !str) return;
        this.font(size, bold, family);
        this.color(c);
        this.doc.text(str, x, y, opts);
    }
    rect(x: number, y: number, w: number, h: number, c: RGB) {
        if (this.dry) return;
        this.doc.setFillColor(c[0], c[1], c[2]);
        this.doc.rect(x, y, w, h, 'F');
    }
    line(x1: number, y1: number, x2: number, y2: number, c: RGB, w: number) {
        if (this.dry) return;
        this.doc.setDrawColor(c[0], c[1], c[2]);
        this.doc.setLineWidth(w);
        this.doc.line(x1, y1, x2, y2);
    }
}

interface RowOpts {
    time?: string;
    bullet?: RGB;
    text: string;
    duration?: string;
    label?: string;     // etiqueta pequeña a la derecha de la columna de texto ("Estudiante:", "Oración:"...)
    name?: string;
    bold?: boolean;
    textWidth?: number;
    flush?: boolean;    // texto pegado al margen izquierdo (encabezado de la semana)
}

// Dibuja una fila y devuelve su alto.
const drawRow = (p: Painter, y: number, o: RowOpts): number => {
    const m = p.m;
    const xText = o.flush ? X_TIME : X_TEXT + TEXT_INDENT;
    const width = o.textWidth ?? TEXT_W;
    const lines = p.wrap(o.text, width, m.size, !!o.bold);
    let durOwnLine = false;
    let durX = 0;
    if (o.duration) {
        const lastW = p.width(lines[lines.length - 1], m.size, !!o.bold);
        const durW = p.width(`(${o.duration})`, m.dur);
        if (lastW + 4 + durW <= width) durX = xText + lastW + 4; else durOwnLine = true;
    }
    const nameLines = o.name ? p.wrap(o.name, NAMES_W, m.name) : [''];
    const rows = Math.max(lines.length + (durOwnLine ? 1 : 0), nameLines.length, 1);
    const h = Math.max(m.rowMin, rows * m.lineH + 1.5);
    const base = y + m.base; // misma línea base para todo lo de la primera línea

    p.text(o.time || '', X_TIME, base, m.dur, true, GRAY);
    if (o.bullet) p.text('•', X_TEXT, base, m.size, false, o.bullet);
    lines.forEach((l, i) => p.text(l, xText, base + i * m.lineH, m.size, !!o.bold, BLACK));
    if (o.duration) {
        if (durOwnLine) p.text(`(${o.duration})`, xText, base + lines.length * m.lineH, m.dur, false, BLACK);
        else p.text(`(${o.duration})`, durX, base + (lines.length - 1) * m.lineH, m.dur, false, BLACK);
    }
    if (o.label) p.text(o.label, X_LABEL_RIGHT, base, 6.5, true, GRAY, { align: 'right' });
    nameLines.forEach((l, i) => p.text(l, X_NAMES, base + i * m.lineH, m.name, false, BLACK));
    return h;
};

const drawBar = (p: Painter, y: number, title: string, color: RGB, showAux: boolean): number => {
    p.rect(MX, y, BAR_W, BAR_H, color);
    const mid = y + BAR_H / 2;
    p.text(title.toUpperCase(), MX + 5, mid, 8.5, true, WHITE, { baseline: 'middle' });
    if (showAux) p.text('Sala auxiliar', X_LABEL_RIGHT + 6, mid, 6.5, true, GRAY, { baseline: 'middle' });
    p.text('Auditorio principal', X_NAMES, mid, 6.5, true, GRAY, { baseline: 'middle' });
    return BAR_H;
};

// Dibuja (o mide, si p.dry) una semana completa. Devuelve el alto usado.
const drawWeek = (p: Painter, y0: number, week: any, nameOf: GetName, opts: S140Options): number => {
    let y = y0;
    let t = startMinutes(opts.midweekTime);
    const tick = (min: number) => { const cur = t; t += min; return fmtClock(cur); };
    let n = 0;
    const next = () => ++n;
    const join = (a?: string | null, b?: string | null) => [nameOf(a), nameOf(b)].filter(Boolean).join(' / ');
    const showAux = !!opts.showAuxRoom;

    const heading = [String(week.weekRange || '').toUpperCase(), week.bibleReadingSource ? String(week.bibleReadingSource).toUpperCase() : '']
        .filter(Boolean).join(' | ');
    y += drawRow(p, y, { text: heading, bold: true, flush: true, label: 'Presidente:', name: nameOf(week.presidentId), textWidth: 270 });
    y += 4;

    y += drawRow(p, y, { time: tick(OPENING_SONG_MIN), bullet: GRAY, text: `Canción ${week.song1 || ''}`.trim() });
    y += drawRow(p, y, { time: tick(INTRO_MIN), bullet: GRAY, text: 'Palabras de introducción', duration: '1 min.' });
    y += 3;

    y += drawBar(p, y, 'Tesoros de la Biblia', GRAY, showAux);
    (week.treasuresParts || []).forEach((part: any) => {
        const reading = part.type === 'lectura_biblia';
        y += drawRow(p, y, {
            time: tick(parseMinutes(part.duration, reading ? 4 : 10)), text: `${next()}. ${cleanTitle(part.title)}`,
            duration: part.duration || '', label: reading ? 'Estudiante:' : undefined, name: nameOf(part.assigneeId),
        });
    });

    y += drawBar(p, y, 'Seamos mejores maestros', GOLD, showAux);
    (week.studentAssignments || []).forEach((asig: any) => {
        const analysis = asig.type === 'que_dirias';
        const discourse = asig.type === 'discurso_estudiante';
        y += drawRow(p, y, {
            time: tick(parseMinutes(asig.duration, 3)), text: `${next()}. ${cleanTitle(asig.title)}`, duration: asig.duration || '',
            label: analysis ? undefined : (discourse ? 'Estudiante:' : 'Estudiante/Ayudante:'),
            name: analysis || discourse ? nameOf(asig.studentId) : join(asig.studentId, asig.helperId),
        });
    });

    y += drawBar(p, y, 'Nuestra vida cristiana', BURGUNDY, showAux);
    y += drawRow(p, y, { time: tick(MIDDLE_SONG_MIN), bullet: BURGUNDY, text: `Canción ${week.song2 || ''}`.trim() });
    (week.christianLivingParts || []).forEach((part: any) => {
        y += drawRow(p, y, {
            time: tick(parseMinutes(part.duration, 15)), text: `${next()}. ${cleanTitle(part.title)}`, duration: part.duration || '',
            name: part.note || nameOf(part.assigneeId),
        });
    });
    if (week.hasCbs) {
        y += drawRow(p, y, {
            time: tick(CBS_MIN), text: `${next()}. Estudio bíblico de la congregación`, duration: '30 mins.',
            label: 'Conductor/Lector:', name: join(week.cbsConductorId, week.cbsReaderId),
        });
    }
    y += drawRow(p, y, { time: tick(CONCLUSION_MIN), bullet: BURGUNDY, text: 'Palabras de conclusión', duration: '3 mins.' });
    y += drawRow(p, y, { time: fmtClock(t), bullet: BURGUNDY, text: `Canción ${week.song3 || ''}`.trim(), label: 'Oración:', name: nameOf(week.finalPrayerId) });
    return y - y0;
};

const drawPageFrame = (p: Painter, congregation: string): number => {
    const base = MT + 20;
    p.text(congregation, MX, base, 9.5, true, BLACK);
    // el título usa tipografía con serifas, como el modelo
    p.text('Programa para la reunión de entre semana', MX + CONTENT_W, base, 15, true, BLACK, { align: 'right' }, 'times');
    p.line(MX, base + 4, MX + CONTENT_W, base + 4, GRAY, 0.9);
    p.line(MX, base + 6.6, MX + CONTENT_W, base + 6.6, GRAY, 0.9);
    p.text('S-140-S  11/23', MX, PAGE_H - 30, 8, false, GRAY);
    return base + 16;
};

// Construye el PDF completo. `jsPDFClass` es la clase `jspdf.jsPDF` (en el navegador viene de la librería cargada por CDN).
export const buildS140Pdf = (jsPDFClass: any, schedule: { weeks?: any[] }, nameOf: GetName, options: S140Options = {}) => {
    const opts: S140Options = { congregationName: 'CONG. CERRO DE LA SILLA-GPE.', showAuxRoom: false, ...options };
    const doc = new jsPDFClass({ orientation: 'portrait', unit: 'pt', format: 'letter' });
    const weeks = schedule.weeks || [];

    // Reparto: máximo dos semanas por hoja (como el modelo). Si no caben con el tamaño normal, se prueba el compacto;
    // si tampoco caben, cada semana va en su propia hoja.
    const startY = MT + 36;
    const avail = BOTTOM_LIMIT - startY;
    const heightOf = (w: any, m: Metrics) => drawWeek(new Painter(doc, true, m), 0, w, nameOf, opts);
    const pages: { weeks: any[]; metrics: Metrics }[] = [];
    weeks.forEach(w => {
        const current = pages[pages.length - 1];
        if (current && current.weeks.length === 1) {
            const prev = current.weeks[0];
            if (heightOf(prev, NORMAL) + WEEK_GAP + heightOf(w, NORMAL) <= avail) { current.weeks.push(w); return; }
            if (heightOf(prev, COMPACT) + WEEK_GAP + heightOf(w, COMPACT) <= avail) { current.weeks.push(w); current.metrics = COMPACT; return; }
        }
        pages.push({ weeks: [w], metrics: NORMAL });
    });

    pages.forEach((page, i) => {
        if (i > 0) doc.addPage();
        const painter = new Painter(doc, false, page.metrics);
        let y = drawPageFrame(painter, opts.congregationName || '');
        page.weeks.forEach((w, wi) => {
            if (wi > 0) y += WEEK_GAP;
            y += drawWeek(painter, y, w, nameOf, opts);
        });
    });
    return doc;
};
