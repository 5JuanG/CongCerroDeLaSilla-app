import React, { forwardRef } from 'react';
import { LMMeetingSchedule } from '../types';

// Clon del formato S-140-S (Programa para la reunión de entre semana).
// Colores tomados del modelo: gris #575A5D (Tesoros de la Biblia), dorado #BE8900 (Seamos mejores maestros),
// vino #7E0024 (Nuestra vida cristiana). Hoja carta, dos semanas por página.

const GRAY = '#575A5D';
const GOLD = '#BE8900';
const BURGUNDY = '#7E0024';

// La congregación no usa sala auxiliar en este programa. Poner en true para mostrar también la columna "Sala auxiliar".
export const S140_SHOW_AUX_ROOM = false;
const CONGREGATION_NAME = 'CONG. CERRO DE LA SILLA-GPE.';

// Duración (min) de lo que no trae tiempo en la guía; sirve solo para calcular la hora de cada parte.
const OPENING_SONG_MIN = 5;
const INTRO_MIN = 1;
const MIDDLE_SONG_MIN = 5;
const CBS_MIN = 30;
const CONCLUSION_MIN = 3;

const BODY_FONT = "Calibri, Carlito, 'Segoe UI', Arial, sans-serif";
const TITLE_FONT = "Cambria, Georgia, 'Times New Roman', serif";

// Anchos de columna (px a 96 dpi, suman 664 = ancho útil de la hoja carta con márgenes de 0.79")
const COL = { time: 40, text: 293, gap1: 12, aux: 145, gap2: 12, main: 162 };

const parseMinutes = (d?: string | null, fallback = 0): number => {
    const m = String(d ?? '').match(/\d+/);
    return m ? Number(m[0]) : fallback;
};

const startMinutes = (time?: string): number => {
    const [h, m] = String(time || '19:30').split(':').map(Number);
    return (Number.isFinite(h) ? h : 19) * 60 + (Number.isFinite(m) ? m : 30);
};

const fmtClock = (mins: number): string => {
    const h = Math.floor(mins / 60) % 12 || 12;
    return `${h}:${String(mins % 60).padStart(2, '0')}`;
};

const Cols: React.FC = () => (
    <colgroup>
        <col style={{ width: COL.time }} />
        <col style={{ width: COL.text }} />
        <col style={{ width: COL.gap1 }} />
        <col style={{ width: COL.aux }} />
        <col style={{ width: COL.gap2 }} />
        <col style={{ width: COL.main }} />
    </colgroup>
);

const cell: React.CSSProperties = { padding: '1px 0', height: 19, verticalAlign: 'middle', fontSize: '10pt', color: '#000', whiteSpace: 'nowrap' };
const smallLabel: React.CSSProperties = { fontSize: '6.5pt', fontWeight: 700, color: GRAY, textAlign: 'right' };

interface RowProps {
    time?: string;
    bulletColor?: string;     // si viene, la fila es de viñeta (Canción, Palabras de introducción...)
    text: React.ReactNode;
    duration?: string;
    labelInText?: string;     // etiqueta pegada al final de la columna de texto ("Estudiante:", "Estudiante/Ayudante:")
    labelCol?: string;        // etiqueta antes del nombre en el auditorio ("Presidente:", "Oración:", "Conductor/Lector:")
    name?: React.ReactNode;
}

// Fila con la etiqueta pequeña al final de la columna de texto (Estudiante:, Estudiante/Ayudante:)
const PartRow: React.FC<RowProps> = ({ time, text, duration, labelInText, labelCol, name, bulletColor }) => (
    <tr>
        <td style={{ ...cell, fontSize: '8pt', fontWeight: 700, color: GRAY }}>{time || ''}</td>
        <td style={{ ...cell, position: 'relative', whiteSpace: 'normal', paddingRight: labelInText ? (labelInText.includes('Ayudante') ? 88 : 58) : 0 }}>
            <span style={{ display: 'inline-block', width: 12, color: bulletColor || 'transparent' }}>{bulletColor ? '•' : ''}</span>
            {text}
            {duration ? <span style={{ fontSize: '8pt', marginLeft: 6, whiteSpace: 'nowrap' }}>({duration})</span> : null}
            {labelInText ? <span style={{ ...smallLabel, position: 'absolute', right: 0, top: 6 }}>{labelInText}</span> : null}
        </td>
        <td style={cell}></td>
        <td style={{ ...cell, ...smallLabel }}>{labelCol || ''}</td>
        <td style={cell}></td>
        <td style={cell}>{name}</td>
    </tr>
);

const SectionBar: React.FC<{ title: string; color: string; shorter?: boolean }> = ({ title, color, shorter }) => (
    <tr>
        <td colSpan={3} style={{ padding: '0 0 0 0', height: 17, verticalAlign: 'middle' }}>
            <div style={{
                background: color, color: '#fff', fontWeight: 700, fontSize: '8.5pt', textTransform: 'uppercase',
                padding: '1px 4px', marginLeft: -4, width: (shorter ? 329 : 341), lineHeight: '15px', letterSpacing: '0.2px',
            }}>{title}</div>
        </td>
        <td style={{ ...cell, ...smallLabel, textAlign: 'left', paddingLeft: 0 }}>{S140_SHOW_AUX_ROOM ? 'Sala auxiliar' : ''}</td>
        <td style={cell}></td>
        <td style={{ ...cell, fontSize: '6.5pt', fontWeight: 700, color: GRAY }}>Auditorio principal</td>
    </tr>
);

interface WeekProps {
    week: any;
    getPublisherName: (id: string | null | undefined) => string;
    midweekTime?: string;
}

const WeekBlock: React.FC<WeekProps> = ({ week, getPublisherName, midweekTime }) => {
    let t = startMinutes(midweekTime);
    const tick = (min: number) => { const cur = t; t += min; return fmtClock(cur); };
    let n = 0;
    const next = () => ++n;

    const heading = [String(week.weekRange || '').toUpperCase(), week.bibleReadingSource ? String(week.bibleReadingSource).toUpperCase() : '']
        .filter(Boolean).join(' | ');

    const names = (a?: string | null, b?: string | null) => [getPublisherName(a), getPublisherName(b)].filter(Boolean).join(' / ');

    const rows: React.ReactNode[] = [];

    rows.push(
        <tr key="head">
            <td colSpan={3} style={{ ...cell, fontWeight: 700, paddingLeft: 0 }}>{heading}</td>
            <td style={{ ...cell, ...smallLabel }}>Presidente:</td>
            <td style={cell}></td>
            <td style={cell}>{getPublisherName(week.presidentId)}</td>
        </tr>,
        <tr key="sp1"><td colSpan={6} style={{ height: 10, padding: 0 }}></td></tr>,
    );

    rows.push(<PartRow key="song1" time={tick(OPENING_SONG_MIN)} bulletColor={GRAY} text={<>Canción {week.song1 || ''}</>} />);
    rows.push(<PartRow key="intro" time={tick(INTRO_MIN)} bulletColor={GRAY} text="Palabras de introducción" duration="1 min." />);
    rows.push(<tr key="sp2"><td colSpan={6} style={{ height: 6, padding: 0 }}></td></tr>);

    // TESOROS DE LA BIBLIA
    rows.push(<SectionBar key="bar1" title="Tesoros de la Biblia" color={GRAY} />);
    (week.treasuresParts || []).forEach((part: any, i: number) => {
        const fallback = part.type === 'lectura_biblia' ? 4 : 10;
        const isReading = part.type === 'lectura_biblia';
        rows.push(
            <PartRow key={`t${i}`} time={tick(parseMinutes(part.duration, fallback))} text={`${next()}. ${part.title || ''}`}
                duration={part.duration || ''} labelInText={isReading ? 'Estudiante:' : undefined} name={getPublisherName(part.assigneeId)} />
        );
    });

    // SEAMOS MEJORES MAESTROS
    rows.push(<SectionBar key="bar2" title="Seamos mejores maestros" color={GOLD} />);
    (week.studentAssignments || []).forEach((asig: any, i: number) => {
        const isAnalysis = asig.type === 'que_dirias';
        const isDiscourse = asig.type === 'discurso_estudiante';
        const label = isAnalysis ? undefined : (isDiscourse ? 'Estudiante:' : 'Estudiante/Ayudante:');
        rows.push(
            <PartRow key={`s${i}`} time={tick(parseMinutes(asig.duration, 3))} text={`${next()}. ${asig.title || ''}`}
                duration={asig.duration || ''} labelInText={label}
                name={isAnalysis || isDiscourse ? getPublisherName(asig.studentId) : names(asig.studentId, asig.helperId)} />
        );
    });

    // NUESTRA VIDA CRISTIANA
    rows.push(<SectionBar key="bar3" title="Nuestra vida cristiana" color={BURGUNDY} shorter />);
    rows.push(<PartRow key="song2" time={tick(MIDDLE_SONG_MIN)} bulletColor={BURGUNDY} text={<>Canción {week.song2 || ''}</>} />);
    (week.christianLivingParts || []).forEach((part: any, i: number) => {
        rows.push(
            <PartRow key={`c${i}`} time={tick(parseMinutes(part.duration, 15))} text={`${next()}. ${part.title || ''}`}
                duration={part.duration || ''} name={part.note || getPublisherName(part.assigneeId)} />
        );
    });
    if (week.hasCbs) {
        rows.push(
            <PartRow key="cbs" time={tick(CBS_MIN)} text={`${next()}. Estudio bíblico de la congregación`} duration="30 mins."
                labelCol="Conductor/Lector:" name={names(week.cbsConductorId, week.cbsReaderId)} />
        );
    }
    rows.push(<PartRow key="concl" time={tick(CONCLUSION_MIN)} bulletColor={BURGUNDY} text="Palabras de conclusión" duration="3 mins." />);
    rows.push(<PartRow key="song3" time={fmtClock(t)} bulletColor={BURGUNDY} text={<>Canción {week.song3 || ''}</>}
        labelCol="Oración:" name={getPublisherName(week.finalPrayerId)} />);

    return (
        <table style={{ width: 664, tableLayout: 'fixed', borderCollapse: 'collapse', fontFamily: BODY_FONT }}>
            <Cols />
            <tbody>{rows}</tbody>
        </table>
    );
};

const PageHeader: React.FC = () => (
    <table style={{ width: 664, tableLayout: 'fixed', borderCollapse: 'collapse', borderBottom: `4px double ${GRAY}`, marginBottom: 10 }}>
        <tbody>
            <tr>
                <td style={{ width: 190, fontFamily: BODY_FONT, fontWeight: 700, fontSize: '9.5pt', verticalAlign: 'bottom', paddingBottom: 3, color: '#000' }}>
                    {CONGREGATION_NAME}
                </td>
                <td style={{ fontFamily: TITLE_FONT, fontWeight: 700, fontSize: '15pt', textAlign: 'right', verticalAlign: 'bottom', paddingBottom: 1, color: '#000', whiteSpace: 'nowrap' }}>
                    Programa para la reunión de entre semana
                </td>
            </tr>
        </tbody>
    </table>
);

interface SchedulePDFViewProps {
    schedule: LMMeetingSchedule;
    getPublisherName: (id: string | null | undefined) => string;
    midweekTime?: string;
}

// Cada <div data-s140-page> es una hoja carta completa (816 x 1056 px a 96 dpi) con dos semanas.
const SchedulePDFView = forwardRef<HTMLDivElement, SchedulePDFViewProps>(({ schedule, getPublisherName, midweekTime }, ref) => {
    const weeks = schedule.weeks || [];
    const pages: any[][] = [];
    for (let i = 0; i < weeks.length; i += 2) pages.push(weeks.slice(i, i + 2));

    return (
        <div ref={ref} style={{ background: '#fff', width: 816 }}>
            {pages.map((pageWeeks, pageIndex) => (
                <div key={pageIndex} data-s140-page="1"
                    style={{ position: 'relative', width: 816, height: 1056, boxSizing: 'border-box', padding: '67px 76px 0 76px', background: '#fff', overflow: 'hidden' }}>
                    <PageHeader />
                    {pageWeeks.map((week, wi) => (
                        <div key={wi} style={{ marginTop: wi === 0 ? 0 : 30 }}>
                            <WeekBlock week={week} getPublisherName={getPublisherName} midweekTime={midweekTime} />
                        </div>
                    ))}
                    <div style={{ position: 'absolute', left: 76, bottom: 38, fontFamily: BODY_FONT, fontSize: '8pt', color: GRAY }}>S-140-S&nbsp; 11/23</div>
                </div>
            ))}
        </div>
    );
});

export default SchedulePDFView;
