import React, { useEffect, useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { QRCodeSVG } from 'qrcode.react';
import { MONTHS } from '../constants';
import { VigilanciaConfig } from '../types';
import {
    DIAS, VigBloque, VigConfig, VigEvento, VigEventoTipo, VigPrograma,
    analizar, datesBetween, defaultConfig, emptyPrograma, formatFecha, generarRotacion,
} from '../vigilanciaLogic';

declare const db: any;

const COLECCION = 'vigilancia_complejo';
const EDITOR_KEY = 'vigilancia_editor_nombre';

interface Props {
    standalone?: boolean;
    legacyConfig?: VigilanciaConfig | null;
    legacySchedules?: any[];
}

const TIPO_LABEL: Record<VigEventoTipo, string> = {
    asamblea: 'Asamblea',
    visitaSC: 'Visita del SC',
    conmemoracion: 'Conmemoración',
    otro: 'Otro',
};
const TIPO_COLOR: Record<VigEventoTipo, string> = {
    asamblea: 'bg-purple-100 text-purple-800',
    visitaSC: 'bg-blue-100 text-blue-800',
    conmemoracion: 'bg-amber-100 text-amber-800',
    otro: 'bg-gray-100 text-gray-700',
};

const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o));
const uid = () => Math.random().toString(36).slice(2, 10);

const seedConfig = (legacy?: VigilanciaConfig | null): VigConfig => {
    const base = defaultConfig();
    if (!legacy) return base;
    const congs = legacy.congregations?.length ? legacy.congregations : base.congregaciones.map(c => c.nombre);
    return {
        ...base,
        congregaciones: congs.map(nombre => ({ nombre })),
        bloques: [
            { id: 'martes', nombre: 'Martes', dia: 2, congregaciones: [...congs], turnos: legacy.tuesdaySlots?.length ? [...legacy.tuesdaySlots] : base.bloques[0].turnos },
            { id: 'sabado', nombre: 'Sábado', dia: 6, congregaciones: [...congs], turnos: legacy.saturdaySlots?.length ? [...legacy.saturdaySlots] : base.bloques[1].turnos },
        ],
    };
};

// ───────── Componentes auxiliares (fuera del principal para no perder el foco al escribir) ─────────

const ChipsCongregaciones: React.FC<{
    todas: string[]; seleccion: string[]; onChange: (s: string[]) => void;
}> = ({ todas, seleccion, onChange }) => (
    <div className="flex flex-wrap gap-2">
        {todas.map(c => {
            const on = seleccion.includes(c);
            return (
                <button
                    key={c} type="button"
                    onClick={() => onChange(on ? seleccion.filter(x => x !== c) : [...seleccion, c])}
                    className={`px-3 py-1 rounded-full text-sm border ${on ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                >
                    {c}
                </button>
            );
        })}
    </div>
);

const TextoAlSalir: React.FC<{ value: string; onCommit: (v: string) => void; className?: string; placeholder?: string }> = ({ value, onCommit, className, placeholder }) => {
    const [v, setV] = useState(value);
    useEffect(() => setV(value), [value]);
    return (
        <input
            value={v} placeholder={placeholder} className={className || 'p-2 border rounded-md text-sm w-full'}
            onChange={e => setV(e.target.value)}
            onBlur={() => { if (v.trim() !== value) onCommit(v.trim()); }}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        />
    );
};

const BloqueEditor: React.FC<{
    bloque: VigBloque; catalogo: string[];
    onChange: (b: VigBloque) => void; onRemove: () => void;
}> = ({ bloque, catalogo, onChange, onRemove }) => {
    const [nuevoTurno, setNuevoTurno] = useState('');
    return (
        <div className="border rounded-lg p-4 bg-slate-50 space-y-3">
            <div className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[140px]">
                    <label className="block text-xs font-medium text-gray-500">Nombre del bloque</label>
                    <TextoAlSalir value={bloque.nombre} onCommit={v => v && onChange({ ...bloque, nombre: v })} />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-500">Día de reunión</label>
                    <select value={bloque.dia} onChange={e => onChange({ ...bloque, dia: Number(e.target.value) })} className="p-2 border rounded-md text-sm">
                        {DIAS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                    </select>
                </div>
                <button onClick={onRemove} className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md">Quitar bloque</button>
            </div>
            <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Congregaciones que se organizan entre sí ese día</label>
                <ChipsCongregaciones
                    todas={catalogo} seleccion={bloque.congregaciones}
                    onChange={s => onChange({ ...bloque, congregaciones: catalogo.filter(c => s.includes(c)) })}
                />
            </div>
            <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Turnos de vigilancia</label>
                <div className="flex flex-wrap gap-2 mb-2">
                    {bloque.turnos.map((t, i) => (
                        <span key={i} className="bg-white px-3 py-1 rounded-full border text-sm flex items-center gap-2">
                            {t}
                            <button onClick={() => onChange({ ...bloque, turnos: bloque.turnos.filter((_, j) => j !== i) })} className="text-red-400 hover:text-red-600 font-bold">×</button>
                        </span>
                    ))}
                </div>
                <div className="flex gap-2">
                    <input value={nuevoTurno} onChange={e => setNuevoTurno(e.target.value)} placeholder="Ej: 7:20-7:50pm" className="flex-1 p-2 border rounded-md text-sm" />
                    <button
                        onClick={() => { if (nuevoTurno.trim()) { onChange({ ...bloque, turnos: [...bloque.turnos, nuevoTurno.trim()] }); setNuevoTurno(''); } }}
                        className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm font-bold"
                    >+</button>
                </div>
            </div>
        </div>
    );
};

// ───────── Componente principal ─────────

const VigilanciaComplejo: React.FC<Props> = ({ standalone = false, legacyConfig, legacySchedules }) => {
    const [year, setYear] = useState(new Date().getFullYear());
    const [tab, setTab] = useState<'programa' | 'eventos' | 'cambios' | 'config'>('programa');
    const [configDoc, setConfigDoc] = useState<VigConfig | null>(null);
    const [configLoaded, setConfigLoaded] = useState(false);
    const [programa, setPrograma] = useState<VigPrograma>(emptyPrograma(year));
    const [error, setError] = useState('');
    const [status, setStatus] = useState('');
    const [showShare, setShowShare] = useState(false);
    const [copied, setCopied] = useState(false);
    const [editor, setEditor] = useState(() => { try { return localStorage.getItem(EDITOR_KEY) || ''; } catch { return ''; } });

    // Formulario de evento
    const [evTipo, setEvTipo] = useState<VigEventoTipo>('asamblea');
    const [evInicio, setEvInicio] = useState('');
    const [evFin, setEvFin] = useState('');
    const [evCongs, setEvCongs] = useState<string[]>([]);
    const [evNotas, setEvNotas] = useState('');
    const [evMoverA, setEvMoverA] = useState('');

    const years = useMemo(() => Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - 1 + i), []);
    const config: VigConfig = useMemo(() => configDoc || seedConfig(legacyConfig), [configDoc, legacyConfig]);
    const catalogo = useMemo(() => {
        const s = new Set<string>([...config.congregaciones.map(c => c.nombre), ...config.bloques.flatMap(b => b.congregaciones)]);
        return Array.from(s).filter(Boolean).sort((a, b) => a.localeCompare(b, 'es'));
    }, [config]);

    // Suscripciones en vivo (todos ven los cambios al instante)
    useEffect(() => {
        const onErr = (e: any) => {
            console.error('Vigilancia listener:', e);
            setError(e?.code === 'permission-denied'
                ? 'permiso'
                : `No se pudo cargar el programa: ${e?.message || e}`);
        };
        const u1 = db.collection(COLECCION).doc('config').onSnapshot((snap: any) => {
            setConfigDoc(snap.exists ? ({ ...defaultConfig(), ...snap.data() } as VigConfig) : null);
            setConfigLoaded(true);
        }, onErr);
        return () => u1();
    }, []);

    useEffect(() => {
        setPrograma(emptyPrograma(year));
        const u = db.collection(COLECCION).doc(`programa_${year}`).onSnapshot((snap: any) => {
            setPrograma(snap.exists ? ({ ...emptyPrograma(year), ...snap.data() } as VigPrograma) : emptyPrograma(year));
        }, (e: any) => {
            console.error('Vigilancia programa listener:', e);
            setError(e?.code === 'permission-denied' ? 'permiso' : `No se pudo cargar el programa: ${e?.message || e}`);
        });
        return () => u();
    }, [year]);

    const quien = () => editor.trim() || 'Anónimo';

    const flash = (m: string) => { setStatus(m); setTimeout(() => setStatus(''), 2500); };

    const mutateConfig = async (fn: (c: VigConfig) => void, texto: string) => {
        const ref = db.collection(COLECCION).doc('config');
        try {
            await db.runTransaction(async (tx: any) => {
                const snap = await tx.get(ref);
                const cur: VigConfig = snap.exists ? { ...defaultConfig(), ...snap.data() } : seedConfig(legacyConfig);
                fn(cur);
                tx.set(ref, clone({ ...cur, ultimoCambio: { at: Date.now(), quien: quien(), texto } }));
            });
            await logCambio(texto);
        } catch (e: any) {
            setError(e?.code === 'permission-denied' ? 'permiso' : `Error al guardar: ${e?.message || e}`);
        }
    };

    const mutatePrograma = async (fn: (p: VigPrograma) => void, texto: string, y = year) => {
        const ref = db.collection(COLECCION).doc(`programa_${y}`);
        try {
            await db.runTransaction(async (tx: any) => {
                const snap = await tx.get(ref);
                const cur: VigPrograma = snap.exists ? { ...emptyPrograma(y), ...snap.data() } : emptyPrograma(y);
                fn(cur);
                cur.historial = [{ at: Date.now(), quien: quien(), texto }, ...(cur.historial || [])].slice(0, 40);
                tx.set(ref, clone(cur));
            });
        } catch (e: any) {
            setError(e?.code === 'permission-denied' ? 'permiso' : `Error al guardar: ${e?.message || e}`);
        }
    };

    // El historial de cambios de configuración se guarda junto al programa del año visible.
    const logCambio = async (texto: string) => {
        const ref = db.collection(COLECCION).doc(`programa_${year}`);
        await db.runTransaction(async (tx: any) => {
            const snap = await tx.get(ref);
            const cur: VigPrograma = snap.exists ? { ...emptyPrograma(year), ...snap.data() } : emptyPrograma(year);
            cur.historial = [{ at: Date.now(), quien: quien(), texto }, ...(cur.historial || [])].slice(0, 40);
            tx.set(ref, clone(cur));
        });
    };

    const guardarEditor = (v: string) => {
        setEditor(v);
        try { localStorage.setItem(EDITOR_KEY, v); } catch { /* sin almacenamiento */ }
    };

    const analisis = useMemo(() => analizar(config, programa), [config, programa]);

    // ───────── Programa ─────────
    const setCelda = (b: VigBloque, mes: number, turnoIdx: number, valor: string) =>
        mutatePrograma(p => {
            p.asignaciones = p.asignaciones || {};
            const bl = p.asignaciones[b.id] || (p.asignaciones[b.id] = {});
            const arr = [...(bl[String(mes)] || b.turnos.map(() => ''))];
            while (arr.length < b.turnos.length) arr.push('');
            arr[turnoIdx] = valor;
            bl[String(mes)] = arr;
        }, `${b.nombre} · ${MONTHS[mes]} · ${b.turnos[turnoIdx]} → ${valor || 'vacío'}`);

    const generar = async (bloques: VigBloque[]) => {
        const tieneDatos = bloques.some(b => Object.values(programa.asignaciones?.[b.id] || {}).some(a => a.some(Boolean)));
        if (tieneDatos && !window.confirm(`Esto reemplaza lo que ya está escrito en ${bloques.length === 1 ? 'este bloque' : 'todos los bloques'} para ${year}. ¿Continuar?`)) return;
        await mutatePrograma(p => {
            p.asignaciones = p.asignaciones || {};
            bloques.forEach(b => { p.asignaciones[b.id] = generarRotacion(b); });
        }, `Generó la rotación ${year} (${bloques.map(b => b.nombre).join(', ')})`);
        flash('Rotación generada');
    };

    const importarAnterior = async () => {
        if (!legacySchedules?.length) return;
        await mutatePrograma(p => {
            p.asignaciones = p.asignaciones || {};
            config.bloques.forEach(b => {
                const legacyId = b.dia === 6 ? `saturday_${year}` : b.dia === 2 ? `tuesday_${year}` : '';
                const sch = legacySchedules.find((s: any) => s.id === legacyId);
                if (!sch) return;
                const bl: { [m: string]: string[] } = {};
                MONTHS.forEach((mes, mi) => {
                    bl[String(mi)] = b.turnos.map(t => sch.assignments?.[mes]?.[t] || '');
                });
                p.asignaciones[b.id] = bl;
            });
            const nuevos: VigEvento[] = [];
            ['tuesday_' + year, 'saturday_' + year].forEach(id => {
                const sch = legacySchedules.find((s: any) => s.id === id);
                (sch?.specialEvents || []).forEach((e: any) => {
                    nuevos.push({ id: uid(), tipo: 'otro', fechaInicio: e.date, fechaFin: e.date, congregaciones: e.congregation ? [e.congregation] : [], notas: e.description || '' });
                });
            });
            p.eventos = [...(p.eventos || []), ...nuevos];
        }, `Importó el programa anterior de ${year}`);
        flash('Programa anterior importado');
    };

    // ───────── Eventos ─────────
    const agregarEvento = async () => {
        if (!evInicio) { alert('Indica la fecha del evento.'); return; }
        if (evTipo !== 'otro' && evCongs.length === 0) { alert('Selecciona al menos una congregación.'); return; }
        const fin = evFin && evFin >= evInicio ? evFin : evInicio;
        const ev: VigEvento = { id: uid(), tipo: evTipo, fechaInicio: evInicio, fechaFin: fin, congregaciones: evCongs };
        if (evNotas.trim()) ev.notas = evNotas.trim();
        if (evTipo === 'visitaSC' && evMoverA) ev.moverA = evMoverA;
        const evYear = Number(evInicio.slice(0, 4));
        await mutatePrograma(p => { p.eventos = [...(p.eventos || []), ev]; }, `Agregó ${TIPO_LABEL[evTipo]} (${formatFecha(evInicio)})`, evYear);
        if (evYear !== year) setYear(evYear);
        setEvInicio(''); setEvFin(''); setEvCongs([]); setEvNotas(''); setEvMoverA('');
        flash('Evento agregado');
    };

    const quitarEvento = async (ev: VigEvento) => {
        if (!window.confirm(`¿Quitar ${TIPO_LABEL[ev.tipo]} del ${formatFecha(ev.fechaInicio)}?`)) return;
        await mutatePrograma(p => { p.eventos = (p.eventos || []).filter(e => e.id !== ev.id); }, `Quitó ${TIPO_LABEL[ev.tipo]} (${formatFecha(ev.fechaInicio)})`);
    };

    const setCobertura = (clave: string, valor: string, desc: string) =>
        mutatePrograma(p => {
            p.coberturas = p.coberturas || {};
            if (valor) p.coberturas[clave] = valor; else delete p.coberturas[clave];
        }, `Cobertura ${desc} → ${valor || 'sugerencia automática'}`);

    const eventosOrdenados = useMemo(() => [...(programa.eventos || [])].sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio)), [programa.eventos]);

    const eventosPorMes = useMemo(() => {
        const m: { [k: number]: string[] } = {};
        (programa.eventos || []).forEach(ev => datesBetween(ev.fechaInicio, ev.fechaFin).forEach(f => {
            if (Number(f.slice(0, 4)) !== year) return;
            const mi = Number(f.slice(5, 7)) - 1;
            (m[mi] = m[mi] || []);
            const t = `${TIPO_LABEL[ev.tipo]} ${formatFecha(f)}${ev.congregaciones.length ? ': ' + ev.congregaciones.join(', ') : ''}`;
            if (!m[mi].includes(t)) m[mi].push(t);
        }));
        return m;
    }, [programa.eventos, year]);

    // ───────── Compartir ─────────
    const enlace = `${window.location.origin}${window.location.pathname}?vigilancia=1`;
    const copiar = async () => {
        try { await navigator.clipboard.writeText(enlace); }
        catch {
            const t = document.createElement('textarea'); t.value = enlace; document.body.appendChild(t); t.select();
            document.execCommand('copy'); document.body.removeChild(t);
        }
        setCopied(true); setTimeout(() => setCopied(false), 2000);
    };

    // ───────── PDF ─────────
    const descargarPDF = () => {
        const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
        const w = doc.internal.pageSize.getWidth();
        config.bloques.forEach((b, i) => {
            if (i > 0) doc.addPage();
            doc.setFontSize(15); doc.setFont('helvetica', 'bold');
            doc.text(`Programa de Vigilancia ${year} · ${config.complejo}`, w / 2, 40, { align: 'center' });
            doc.setFontSize(12);
            doc.text(`Reuniones del ${b.nombre}`, w / 2, 58, { align: 'center' });
            autoTable(doc, {
                startY: 72,
                head: [['Turno', ...MONTHS.map(m => m.slice(0, 3))]],
                body: b.turnos.map((t, ti) => [t, ...MONTHS.map((_, mi) => programa.asignaciones?.[b.id]?.[String(mi)]?.[ti] || '')]),
                styles: { fontSize: 7, cellPadding: 3, halign: 'center', valign: 'middle' },
                headStyles: { fillColor: [30, 64, 175] },
                columnStyles: { 0: { fontStyle: 'bold', cellWidth: 62 } },
                margin: { left: 24, right: 24 },
            });
        });
        if (analisis.impactos.length || analisis.cambiosDeDia.length || analisis.sinReunion.length || eventosOrdenados.length) {
            doc.addPage();
            doc.setFontSize(14); doc.setFont('helvetica', 'bold');
            doc.text(`Cambios por eventos ${year}`, w / 2, 40, { align: 'center' });
            let y = 56;
            if (eventosOrdenados.length) {
                autoTable(doc, {
                    startY: y,
                    head: [['Evento', 'Fechas', 'Congregaciones']],
                    body: eventosOrdenados.map(ev => [
                        TIPO_LABEL[ev.tipo] + (ev.notas ? ` (${ev.notas})` : ''),
                        ev.fechaInicio === ev.fechaFin ? formatFecha(ev.fechaInicio) : `${formatFecha(ev.fechaInicio)} al ${formatFecha(ev.fechaFin)}`,
                        (ev.tipo === 'conmemoracion' ? 'Se quedan: ' : ev.tipo === 'visitaSC' ? 'Visitada: ' : 'Ausentes: ') + ev.congregaciones.join(', ')
                            + (ev.moverA ? ` · Cambia de día a ${formatFecha(ev.moverA)}` : ''),
                    ]),
                    styles: { fontSize: 8 }, headStyles: { fillColor: [100, 116, 139] }, margin: { left: 24, right: 24 },
                });
                y = (doc as any).lastAutoTable.finalY + 16;
            }
            if (analisis.sinReunion.length) {
                autoTable(doc, {
                    startY: y,
                    head: [['Reunión sin vigilancia', 'Fecha', 'Motivo']],
                    body: analisis.sinReunion.map(r => [r.bloqueNombre, formatFecha(r.fecha), r.motivo]),
                    styles: { fontSize: 8 }, headStyles: { fillColor: [180, 83, 9] }, margin: { left: 24, right: 24 },
                });
                y = (doc as any).lastAutoTable.finalY + 16;
            }
            if (analisis.impactos.length) {
                autoTable(doc, {
                    startY: y,
                    head: [['Fecha', 'Reunión / turno', 'Le tocaba a', 'Motivo', 'Cubre']],
                    body: analisis.impactos.map(i => [formatFecha(i.fecha), `${i.bloqueNombre} · ${i.turno}`, i.titular, i.motivo, i.cubre || 'Sin asignar']),
                    styles: { fontSize: 8 }, headStyles: { fillColor: [30, 64, 175] }, margin: { left: 24, right: 24 },
                });
            }
        }
        doc.save(`Programa-Vigilancia-${year}.pdf`);
    };

    // ───────── Render ─────────
    const renderBanner = () => {
        if (!error) return null;
        if (error === 'permiso') {
            return (
                <div className="bg-red-50 border border-red-300 text-red-800 p-4 rounded-lg text-sm">
                    <p className="font-semibold mb-1">Firebase no permite acceso a este programa todavía.</p>
                    <p>Falta publicar la regla para la colección <code className="bg-white px-1 rounded">vigilancia_complejo</code> en Firestore (Reglas), con acceso abierto de lectura y escritura. Mira el archivo <b>REGLAS-FIRESTORE.txt</b> que viene con la entrega.</p>
                </div>
            );
        }
        return <div className="bg-red-50 border border-red-300 text-red-800 p-3 rounded-lg text-sm">{error}</div>;
    };

    const mesesIzq = [0, 1, 2, 3, 4, 5];
    const mesesDer = [6, 7, 8, 9, 10, 11];

    const renderGrid = (b: VigBloque, meses: number[]) => (
        <div className="overflow-x-auto mb-4">
            <table className="w-full border-collapse text-sm min-w-[560px]">
                <thead>
                    <tr className="bg-gray-100">
                        <th className="p-2 border font-semibold w-28">Turno</th>
                        {meses.map(mi => (
                            <th key={mi} className="p-2 border font-semibold" title={(eventosPorMes[mi] || []).join('\n')}>
                                {MONTHS[mi]} {eventosPorMes[mi] && <span className="text-amber-500">⚠</span>}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {b.turnos.map((t, ti) => (
                        <tr key={ti}>
                            <td className="p-2 border font-medium text-center bg-gray-50">{t}</td>
                            {meses.map(mi => {
                                const val = programa.asignaciones?.[b.id]?.[String(mi)]?.[ti] || '';
                                const opciones = b.congregaciones.includes(val) || !val ? b.congregaciones : [val, ...b.congregaciones];
                                return (
                                    <td key={mi} className="p-1 border">
                                        <select value={val} onChange={e => setCelda(b, mi, ti, e.target.value)} className="w-full p-1 border rounded text-xs sm:text-sm bg-white">
                                            <option value="">--</option>
                                            {opciones.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const rentan = (ev: VigEvento) => catalogo.filter(c => !ev.congregaciones.includes(c));

    return (
        <div className={standalone ? 'min-h-screen bg-gray-100 p-3 sm:p-6' : ''}>
            <div className="space-y-5 max-w-7xl mx-auto">
                {/* Encabezado */}
                <div className="bg-white rounded-lg shadow-sm p-4 flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Vigilancia · {config.complejo}</h1>
                        <p className="text-sm text-gray-500">Los cambios se guardan solos y todos los ven al instante.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <input
                            value={editor} onChange={e => guardarEditor(e.target.value)}
                            placeholder="Tu nombre y congregación"
                            className="p-2 border rounded-md text-sm w-52"
                            title="Se anota en el historial junto a cada cambio"
                        />
                        <select value={year} onChange={e => setYear(Number(e.target.value))} className="p-2 border rounded-md text-sm">
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <button onClick={descargarPDF} className="px-3 py-2 bg-white border rounded-md text-sm font-medium hover:bg-gray-50">PDF</button>
                        <button onClick={() => setShowShare(true)} className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700">Compartir enlace</button>
                    </div>
                </div>

                {renderBanner()}
                {status && <div className="text-center text-sm font-semibold text-green-700">{status}</div>}
                {!configLoaded && !error && <div className="text-center text-gray-500 text-sm">Cargando…</div>}

                {/* Pestañas */}
                <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
                    {([
                        ['programa', 'Programa'],
                        ['eventos', `Eventos${programa.eventos?.length ? ` (${programa.eventos.length})` : ''}`],
                        ['cambios', `Cambios por eventos${analisis.impactos.length + analisis.sinReunion.length ? ` (${analisis.impactos.length + analisis.sinReunion.length})` : ''}`],
                        ['config', 'Configuración'],
                    ] as const).map(([id, label]) => (
                        <button
                            key={id} onClick={() => setTab(id)}
                            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 ${tab === id ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
                        >{label}</button>
                    ))}
                </div>

                {/* ───── Programa ───── */}
                {tab === 'programa' && (
                    <div className="space-y-5">
                        <div className="flex flex-wrap gap-2 justify-end">
                            {legacySchedules && legacySchedules.some((s: any) => String(s.id).endsWith(String(year))) && (
                                <button onClick={importarAnterior} className="px-3 py-2 bg-white border rounded-md text-sm hover:bg-gray-50">Importar programa anterior {year}</button>
                            )}
                            <button onClick={() => generar(config.bloques)} className="px-3 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700">Generar rotación de todos los bloques</button>
                        </div>
                        {config.bloques.length === 0 && <p className="text-center text-gray-500">Primero crea los bloques en Configuración.</p>}
                        {config.bloques.map(b => (
                            <div key={b.id} className="bg-white p-4 rounded-lg shadow-sm">
                                <div className="flex justify-between items-center mb-3">
                                    <h2 className="text-lg font-bold">Reuniones del {b.nombre} <span className="text-sm font-normal text-gray-500">({b.congregaciones.length} congregaciones · {b.turnos.length} turnos)</span></h2>
                                    <button onClick={() => generar([b])} className="text-sm text-green-700 hover:underline">Generar rotación</button>
                                </div>
                                {renderGrid(b, mesesIzq)}
                                {renderGrid(b, mesesDer)}
                            </div>
                        ))}
                        {(programa.historial?.length ?? 0) > 0 && (
                            <details className="bg-white p-4 rounded-lg shadow-sm">
                                <summary className="cursor-pointer text-sm font-medium text-gray-700">Historial de cambios ({programa.historial.length})</summary>
                                <ul className="mt-3 space-y-1 text-sm text-gray-600 max-h-64 overflow-y-auto">
                                    {programa.historial.map((h, i) => (
                                        <li key={i}><span className="text-gray-400">{new Date(h.at).toLocaleString('es-MX')}</span> · <b>{h.quien}</b>: {h.texto}</li>
                                    ))}
                                </ul>
                            </details>
                        )}
                    </div>
                )}

                {/* ───── Eventos ───── */}
                {tab === 'eventos' && (
                    <div className="space-y-5">
                        <div className="bg-white p-4 rounded-lg shadow-sm space-y-4">
                            <h2 className="text-lg font-bold">Agregar evento</h2>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500">Tipo</label>
                                    <select value={evTipo} onChange={e => { setEvTipo(e.target.value as VigEventoTipo); setEvCongs([]); }} className="w-full p-2 border rounded-md text-sm">
                                        <option value="asamblea">Asamblea (congregaciones que se ausentan)</option>
                                        <option value="visitaSC">Visita del Superintendente de Circuito</option>
                                        <option value="conmemoracion">Conmemoración (14 de nisán)</option>
                                        <option value="otro">Otro</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500">Fecha</label>
                                    <input type="date" value={evInicio} onChange={e => { setEvInicio(e.target.value); if (!evFin || evFin < e.target.value) setEvFin(e.target.value); }} className="w-full p-2 border rounded-md text-sm" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500">Hasta (si dura varios días)</label>
                                    <input type="date" value={evFin} min={evInicio} onChange={e => setEvFin(e.target.value)} className="w-full p-2 border rounded-md text-sm" />
                                </div>
                                {evTipo === 'visitaSC' && (
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500">Nueva fecha de las congregaciones que se reúnen ese día</label>
                                        <input type="date" value={evMoverA} onChange={e => setEvMoverA(e.target.value)} className="w-full p-2 border rounded-md text-sm" />
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">
                                    {evTipo === 'asamblea' ? 'Congregaciones que se ausentan por la asamblea (pueden ser varias)'
                                        : evTipo === 'visitaSC' ? 'Congregación que recibe la visita'
                                        : evTipo === 'conmemoracion' ? 'Congregaciones que SE QUEDAN en el complejo (las demás rentan salón)'
                                        : 'Congregaciones que se ausentan'}
                                </label>
                                <ChipsCongregaciones todas={catalogo} seleccion={evCongs} onChange={setEvCongs} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500">Notas (opcional)</label>
                                <input value={evNotas} onChange={e => setEvNotas(e.target.value)} className="w-full p-2 border rounded-md text-sm" placeholder="Ej: Asamblea de circuito en Monterrey" />
                            </div>
                            <div className="text-right">
                                <button onClick={agregarEvento} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700">Agregar evento</button>
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-lg shadow-sm">
                            <h2 className="text-lg font-bold mb-3">Eventos de {year}</h2>
                            {eventosOrdenados.length === 0 && <p className="text-sm text-gray-500">Todavía no hay eventos.</p>}
                            <ul className="divide-y">
                                {eventosOrdenados.map(ev => (
                                    <li key={ev.id} className="py-3 flex justify-between gap-3">
                                        <div className="text-sm">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TIPO_COLOR[ev.tipo]}`}>{TIPO_LABEL[ev.tipo]}</span>
                                                <b>{ev.fechaInicio === ev.fechaFin ? formatFecha(ev.fechaInicio) : `${formatFecha(ev.fechaInicio)} al ${formatFecha(ev.fechaFin)}`}</b>
                                            </div>
                                            <p className="text-gray-700 mt-1">
                                                {ev.tipo === 'conmemoracion'
                                                    ? <>Se quedan: <b>{ev.congregaciones.join(', ') || '—'}</b>. Rentan salón: {rentan(ev).join(', ') || '—'}.</>
                                                    : <>{ev.tipo === 'visitaSC' ? 'Visitada' : 'Ausentes'}: <b>{ev.congregaciones.join(', ') || '—'}</b></>}
                                            </p>
                                            {ev.tipo === 'conmemoracion' && (() => {
                                                const dow = new Date(ev.fechaInicio + 'T00:00:00').getDay();
                                                return <p className="text-amber-700">Esa semana no se celebra la reunión de {dow >= 1 && dow <= 5 ? 'entre semana' : 'fin de semana'}.</p>;
                                            })()}
                                            {ev.moverA && <p className="text-blue-700">Las congregaciones de ese día pasan al {formatFecha(ev.moverA)}.</p>}
                                            {ev.notas && <p className="text-gray-500">{ev.notas}</p>}
                                        </div>
                                        <button onClick={() => quitarEvento(ev)} className="text-red-500 hover:text-red-700 text-sm self-start">Quitar</button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}

                {/* ───── Cambios por eventos ───── */}
                {tab === 'cambios' && (
                    <div className="space-y-5">
                        {analisis.avisos.length > 0 && (
                            <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 text-sm text-amber-900">
                                <p className="font-semibold mb-1">Revisar</p>
                                <ul className="list-disc ml-5 space-y-0.5">{analisis.avisos.map((a, i) => <li key={i}>{a}</li>)}</ul>
                            </div>
                        )}
                        {analisis.sinReunion.length > 0 && (
                            <div className="bg-white p-4 rounded-lg shadow-sm">
                                <h2 className="text-lg font-bold mb-2">Reuniones que no se celebran (sin vigilancia)</h2>
                                <ul className="text-sm space-y-1">
                                    {analisis.sinReunion.map((r, i) => (
                                        <li key={i}><b>{r.bloqueNombre}</b> · {formatFecha(r.fecha)} <span className="text-gray-500">— {r.motivo}</span></li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {analisis.cambiosDeDia.length > 0 && (
                            <div className="bg-white p-4 rounded-lg shadow-sm">
                                <h2 className="text-lg font-bold mb-2">Reuniones que cambian de día</h2>
                                <ul className="text-sm space-y-1">
                                    {analisis.cambiosDeDia.map((c, i) => (
                                        <li key={i}>Las congregaciones del <b>{c.bloqueNombre}</b> pasan del {formatFecha(c.fechaOriginal)} al <b>{formatFecha(c.fechaNueva)}</b> (visita del SC).</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        <div className="bg-white p-4 rounded-lg shadow-sm">
                            <h2 className="text-lg font-bold mb-1">Turnos que hay que cubrir</h2>
                            <p className="text-xs text-gray-500 mb-3">La sugerencia reparte las coberturas entre las congregaciones disponibles, dando prioridad a las que han cubierto menos y no tienen turno ese día. Puedes cambiarla; tu elección se respeta.</p>
                            {analisis.impactos.length === 0 && <p className="text-sm text-gray-500">No hay turnos afectados. Agrega asambleas, la visita del SC o la Conmemoración en la pestaña Eventos.</p>}
                            <div className="overflow-x-auto">
                                {analisis.impactos.length > 0 && (
                                    <table className="w-full text-sm border-collapse min-w-[640px]">
                                        <thead>
                                            <tr className="bg-gray-100 text-left">
                                                <th className="p-2 border">Fecha</th><th className="p-2 border">Reunión · turno</th>
                                                <th className="p-2 border">Le tocaba a</th><th className="p-2 border">Motivo</th><th className="p-2 border">Cubre</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {analisis.impactos.map(i => (
                                                <tr key={i.clave}>
                                                    <td className="p-2 border whitespace-nowrap">{formatFecha(i.fecha)}</td>
                                                    <td className="p-2 border">{i.bloqueNombre} · {i.turno}</td>
                                                    <td className="p-2 border">{i.titular}</td>
                                                    <td className="p-2 border text-gray-600">{i.motivo}</td>
                                                    <td className="p-2 border">
                                                        <select
                                                            value={i.manual ? i.cubre || '' : ''}
                                                            onChange={e => setCobertura(i.clave, e.target.value, `${i.bloqueNombre} ${formatFecha(i.fecha)} ${i.turno}`)}
                                                            className={`p-1 border rounded w-full ${i.manual ? 'bg-blue-50' : ''}`}
                                                        >
                                                            <option value="">{i.sugerido ? `Sugerida: ${i.sugerido}` : 'Sin congregación disponible'}</option>
                                                            {catalogo.map(c => <option key={c} value={c}>{c}</option>)}
                                                        </select>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                        {Object.values(analisis.conteoCoberturas).some(v => v > 0) && (
                            <div className="bg-white p-4 rounded-lg shadow-sm">
                                <h2 className="text-lg font-bold mb-2">Coberturas por congregación en {year}</h2>
                                <div className="flex flex-wrap gap-2 text-sm">
                                    {Object.entries(analisis.conteoCoberturas).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).map(([c, n]) => (
                                        <span key={c} className="px-3 py-1 rounded-full bg-slate-100">{c}: <b>{n}</b></span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ───── Configuración ───── */}
                {tab === 'config' && (
                    <div className="space-y-5">
                        <div className="bg-white p-4 rounded-lg shadow-sm space-y-3">
                            <h2 className="text-lg font-bold">Complejo</h2>
                            <div>
                                <label className="block text-xs font-medium text-gray-500">Nombre</label>
                                <TextoAlSalir value={config.complejo} onCommit={v => v && mutateConfig(c => { c.complejo = v; }, `Renombró el complejo a ${v}`)} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Salones del Reino</label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {config.salones.map(s => (
                                        <span key={s} className="bg-slate-100 px-3 py-1 rounded-full text-sm flex items-center gap-2">
                                            {s}
                                            <button onClick={() => mutateConfig(c => { c.salones = c.salones.filter(x => x !== s); }, `Quitó el salón ${s}`)} className="text-red-400 hover:text-red-600 font-bold">×</button>
                                        </span>
                                    ))}
                                </div>
                                <NuevoTexto placeholder="Ej: Salón 5" onAdd={v => mutateConfig(c => { if (!c.salones.includes(v)) c.salones = [...c.salones, v]; }, `Agregó el salón ${v}`)} />
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-lg shadow-sm space-y-3">
                            <h2 className="text-lg font-bold">Congregaciones <span className="text-sm font-normal text-gray-500">({config.congregaciones.length})</span></h2>
                            <NuevoTexto placeholder="Nombre de la congregación" onAdd={v => mutateConfig(c => { if (!c.congregaciones.some(x => x.nombre === v)) c.congregaciones = [...c.congregaciones, { nombre: v }]; }, `Agregó la congregación ${v}`)} />
                            <ul className="divide-y">
                                {config.congregaciones.map(cg => (
                                    <li key={cg.nombre} className="py-2 flex flex-wrap items-center gap-3">
                                        <span className="flex-1 min-w-[140px] text-sm font-medium">{cg.nombre}</span>
                                        <select
                                            value={cg.salon || ''}
                                            onChange={e => mutateConfig(c => { const x = c.congregaciones.find(y => y.nombre === cg.nombre); if (x) x.salon = e.target.value; }, `Salón de ${cg.nombre}: ${e.target.value || 'sin salón'}`)}
                                            className="p-1 border rounded text-sm"
                                        >
                                            <option value="">Sin salón</option>
                                            {config.salones.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                        <button
                                            onClick={() => window.confirm(`¿Quitar ${cg.nombre} del complejo y de todos los bloques?`) && mutateConfig(c => {
                                                c.congregaciones = c.congregaciones.filter(x => x.nombre !== cg.nombre);
                                                c.bloques.forEach(b => { b.congregaciones = b.congregaciones.filter(x => x !== cg.nombre); });
                                            }, `Quitó la congregación ${cg.nombre}`)}
                                            className="text-red-500 hover:text-red-700 text-sm"
                                        >Quitar</button>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="bg-white p-4 rounded-lg shadow-sm space-y-4">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h2 className="text-lg font-bold">Bloques por día de reunión</h2>
                                    <p className="text-xs text-gray-500">Las congregaciones que se reúnen el mismo día se organizan entre sí. Cada congregación puede estar en dos bloques (entre semana y fin de semana).</p>
                                </div>
                                <button
                                    onClick={() => mutateConfig(c => { c.bloques = [...c.bloques, { id: uid(), nombre: 'Nuevo bloque', dia: 3, congregaciones: [], turnos: [] }]; }, 'Agregó un bloque')}
                                    className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm font-medium whitespace-nowrap"
                                >+ Bloque</button>
                            </div>
                            {config.bloques.map(b => (
                                <BloqueEditor
                                    key={b.id} bloque={b} catalogo={catalogo}
                                    onChange={nb => mutateConfig(c => { c.bloques = c.bloques.map(x => x.id === b.id ? nb : x); }, `Editó el bloque ${nb.nombre}`)}
                                    onRemove={() => window.confirm(`¿Quitar el bloque ${b.nombre}?`) && mutateConfig(c => { c.bloques = c.bloques.filter(x => x.id !== b.id); }, `Quitó el bloque ${b.nombre}`)}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Compartir */}
            {showShare && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4" onClick={() => setShowShare(false)}>
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold">Compartir el programa de vigilancia</h3>
                        <p className="text-sm text-gray-600">Cualquier persona con este enlace puede ver y llenar el programa, sin iniciar sesión. Todos los cambios quedan en el historial con el nombre que escriban.</p>
                        <div className="flex justify-center"><QRCodeSVG value={enlace} size={150} /></div>
                        <input readOnly value={enlace} onFocus={e => e.target.select()} className="w-full p-2 border rounded-md text-sm bg-gray-50" />
                        <div className="flex gap-2">
                            <button onClick={copiar} className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-md text-sm font-medium">{copied ? '¡Copiado!' : 'Copiar enlace'}</button>
                            <a
                                href={`https://wa.me/?text=${encodeURIComponent(`Programa de vigilancia del ${config.complejo}: ${enlace}`)}`}
                                target="_blank" rel="noreferrer"
                                className="flex-1 px-3 py-2 bg-green-600 text-white rounded-md text-sm font-medium text-center"
                            >WhatsApp</a>
                        </div>
                        <button onClick={() => setShowShare(false)} className="w-full px-3 py-2 bg-gray-100 rounded-md text-sm">Cerrar</button>
                    </div>
                </div>
            )}
        </div>
    );
};

const NuevoTexto: React.FC<{ placeholder: string; onAdd: (v: string) => void }> = ({ placeholder, onAdd }) => {
    const [v, setV] = useState('');
    const add = () => { if (v.trim()) { onAdd(v.trim()); setV(''); } };
    return (
        <div className="flex gap-2">
            <input value={v} onChange={e => setV(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder={placeholder} className="flex-1 p-2 border rounded-md text-sm" />
            <button onClick={add} className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm font-bold">+</button>
        </div>
    );
};

export default VigilanciaComplejo;
