import React, { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Publisher } from '../types';
import { isStatusLikeGroup } from '../groupUtils';
import {
    CONFIG_DOC, CUPO_DEFECTO, DIAS, Inscrito, Inscritos, PUNTOS_EJEMPLO, Punto, SEMANAS_COLLECTION, Turno,
    cupoLleno, fechaDia, fmtCorta, fmtFechaHora, getSemana, newId, slotKey, tituloSemana, weekIdOf,
} from '../predicacionPublicaLogic';

declare const db: any;

// Enlace compartible (página estática con su propia vista previa, redirige al formulario)
export const ENLACE_EXHIBIDORES = 'https://congcerrodelasilla-app.web.app/exhibidores/';

const fullName = (p: Publisher) => [p.Nombre, p.Apellido].filter(Boolean).join(' ').trim();

/* ----------------------------- hooks de datos ----------------------------- */
const usePuntos = () => {
    const [puntos, setPuntos] = useState<Punto[] | null>(null);
    useEffect(() => db.collection('settings').doc(CONFIG_DOC).onSnapshot(
        (d: any) => setPuntos(d.exists && Array.isArray(d.data().puntos) && d.data().puntos.length ? d.data().puntos : PUNTOS_EJEMPLO),
        () => setPuntos(PUNTOS_EJEMPLO)), []);
    return puntos;
};
const useInscritos = (weekId: string) => {
    const [ins, setIns] = useState<Inscritos>({});
    useEffect(() => db.collection(SEMANAS_COLLECTION).doc(weekId).onSnapshot(
        (d: any) => setIns(d.exists ? (d.data().inscritos || {}) : {}), () => setIns({})), [weekId]);
    return ins;
};
const useSemana = () => {
    const [now, setNow] = useState(new Date());
    useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);
    return getSemana(now);
};

const cambiarInscripcion = (weekId: string, titulo: string, punto: Punto, key: string, pub: { id: string; nombre: string; grupo: string }, accion: 'add' | 'del') => {
    const ref = db.collection(SEMANAS_COLLECTION).doc(weekId);
    return db.runTransaction(async (tx: any) => {
        const snap = await tx.get(ref);
        const lista: Inscrito[] = (snap.exists && snap.data().inscritos?.[key]) || [];
        const yaEsta = lista.some(i => i.pubId === pub.id);
        if (accion === 'add') {
            if (yaEsta) return 'ya';
            if (lista.length >= punto.cupo) return 'lleno';
            tx.set(ref, { titulo, martes: weekId, inscritos: { [key]: [...lista, { pubId: pub.id, nombre: pub.nombre, grupo: pub.grupo, ts: Date.now() }] } }, { merge: true });
            return 'ok';
        }
        tx.set(ref, { titulo, martes: weekId, inscritos: { [key]: lista.filter(i => i.pubId !== pub.id) } }, { merge: true });
        return 'quitado';
    }) as Promise<'ok' | 'ya' | 'lleno' | 'quitado'>;
};

/* ------------------------------ formulario público ------------------------------ */
type ModalInfo = { tipo: 'ok' | 'lleno' | 'conflicto' | 'error'; texto: string; detalle?: string } | null;

export const PredicacionPublicaForm: React.FC<{ publishers: Publisher[] }> = ({ publishers }) => {
    const puntos = usePuntos();
    const semana = useSemana();
    const weekId = weekIdOf(semana.tuesday);
    const inscritos = useInscritos(weekId);
    const titulo = tituloSemana(semana.tuesday);
    const [grupo, setGrupo] = useState('');
    const [pubId, setPubId] = useState('');
    const [modal, setModal] = useState<ModalInfo>(null);
    const [busy, setBusy] = useState(false);
    const [heroSrc, setHeroSrc] = useState('/exhibidores-hero.jpg');

    const activos = useMemo(() => publishers.filter(p => p.Estatus === 'Activo' && p.Grupo && !isStatusLikeGroup(p.Grupo)), [publishers]);
    const grupos = useMemo(() => Array.from(new Set(activos.map(p => String(p.Grupo)))).sort((a, b) => a.localeCompare(b, 'es', { numeric: true })), [activos]);
    const nombres = useMemo(() => activos.filter(p => p.Grupo === grupo).sort((a, b) => fullName(a).localeCompare(fullName(b), 'es')), [activos, grupo]);
    const yo = nombres.find(p => p.id === pubId) || null;
    const abierto = semana.estado === 'abierto';

    const misTurnos = useMemo(() => {
        if (!yo || !puntos) return [];
        const out: { punto: Punto; turno: Turno; dia: number }[] = [];
        puntos.forEach(p => p.turnos.forEach(t => t.dias.forEach(d => {
            if ((inscritos[slotKey(p.id, t.id, d)] || []).some(i => i.pubId === yo.id)) out.push({ punto: p, turno: t, dia: d });
        })));
        return out.sort((a, b) => a.dia - b.dia);
    }, [inscritos, puntos, yo]);

    const diaTxt = (d: number) => `${DIAS.find(x => x.n === d)?.largo} ${fechaDia(semana.tuesday, d).getDate()}`;

    const tocar = async (punto: Punto, turno: Turno, dia: number) => {
        if (!yo || busy) return;
        const key = slotKey(punto.id, turno.id, dia);
        const lista = inscritos[key] || [];
        const mio = lista.some(i => i.pubId === yo.id);
        const pub = { id: yo.id, nombre: fullName(yo), grupo: String(yo.Grupo) };
        if (!mio && cupoLleno(lista, punto.cupo)) {
            setModal({ tipo: 'lleno', texto: '¡Gracias por tu apoyo!', detalle: 'Este punto y turno ya se llenó, pero todavía hay otros puntos disponibles. Elige otro con espacio y ¡cuenta con tu ayuda!' });
            return;
        }
        if (!mio) {
            const choque = misTurnos.find(m => m.dia === dia && m.turno.hora === turno.hora);
            if (choque) { setModal({ tipo: 'conflicto', texto: 'Ya estás apuntado a esa hora', detalle: `Ese día a las ${turno.hora} ya estás en "${choque.punto.nombre}". Quítate de ahí primero si quieres cambiar.` }); return; }
        }
        setBusy(true);
        try {
            const r = await cambiarInscripcion(weekId, titulo, punto, key, pub, mio ? 'del' : 'add');
            if (r === 'ok') setModal({ tipo: 'ok', texto: '¡Gracias por apoyar!', detalle: `${diaTxt(dia)}, ${turno.hora}\n${punto.nombre}` });
            else if (r === 'lleno') setModal({ tipo: 'lleno', texto: '¡Gracias por tu apoyo!', detalle: 'Alguien más tomó el último espacio hace un momento, pero todavía hay otros puntos disponibles.' });
        } catch (e) {
            setModal({ tipo: 'error', texto: 'No se pudo guardar', detalle: 'Revisa tu conexión e inténtalo de nuevo.' });
        } finally { setBusy(false); }
    };

    if (!puntos) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500" /></div>;

    return (
        <div className="min-h-screen bg-slate-100">
            <div className="relative h-52 sm:h-64 bg-blue-900 overflow-hidden">
                <img src={heroSrc} alt="Predicación pública con exhibidores" className="w-full h-full object-cover opacity-80"
                    onError={() => heroSrc !== '/exhibidores-hero.svg' && setHeroSrc('/exhibidores-hero.svg')} />
                <div className="absolute inset-0 bg-gradient-to-t from-blue-950/90 via-blue-900/30 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 max-w-3xl mx-auto">
                    <p className="text-blue-200 text-xs font-bold tracking-widest uppercase">Cong. Cerro de la Silla</p>
                    <h1 className="text-white text-xl sm:text-3xl font-extrabold leading-tight">Predicación pública con exhibidores</h1>
                </div>
            </div>

            <div className="max-w-3xl mx-auto p-4 space-y-4 -mt-3 relative">
                <div className="bg-white rounded-2xl shadow p-4">
                    <p className="font-bold text-slate-800 text-sm sm:text-base">{titulo}</p>
                    {abierto && <p className="text-sm text-emerald-700 mt-1">Inscripciones abiertas hasta el {fmtFechaHora(semana.cierra)}. ¡Se agradece mucho tu apoyo!</p>}
                    {semana.estado === 'pronto' && <p className="text-sm text-amber-700 mt-1">El programa de esta semana se abrirá el {fmtFechaHora(semana.abre)}.</p>}
                    {semana.estado === 'cerrado' && <p className="text-sm text-slate-600 mt-1">Las inscripciones de esta semana ya cerraron. ¡Gracias por tu apoyo! El nuevo programa abrirá el {fmtFechaHora(semana.proxAbre)}.</p>}
                </div>

                {abierto && (
                    <div className="bg-white rounded-2xl shadow p-4 grid sm:grid-cols-2 gap-3">
                        <label className="text-sm font-semibold text-slate-700">Tu grupo de predicación
                            <select value={grupo} onChange={e => { setGrupo(e.target.value); setPubId(''); }} className="mt-1 w-full border border-slate-300 rounded-lg p-2.5 bg-white font-normal">
                                <option value="">Selecciona tu grupo…</option>
                                {grupos.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                        </label>
                        <label className="text-sm font-semibold text-slate-700">Tu nombre
                            <select value={pubId} disabled={!grupo} onChange={e => setPubId(e.target.value)} className="mt-1 w-full border border-slate-300 rounded-lg p-2.5 bg-white font-normal disabled:bg-slate-100">
                                <option value="">{grupo ? 'Selecciona tu nombre…' : 'Primero elige tu grupo'}</option>
                                {nombres.map(p => <option key={p.id} value={p.id}>{fullName(p)}</option>)}
                            </select>
                        </label>
                    </div>
                )}

                {abierto && yo && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                        <p className="font-bold text-emerald-900 text-sm">Hola, {yo.Nombre}. {misTurnos.length ? 'Tus turnos de esta semana:' : 'Aún no tienes turnos esta semana. Toca un día para apuntarte.'}</p>
                        {misTurnos.length > 0 && <ul className="mt-1 text-sm text-emerald-800 list-disc pl-5">{misTurnos.map(m => <li key={slotKey(m.punto.id, m.turno.id, m.dia)}>{diaTxt(m.dia)}, {m.turno.hora} — {m.punto.nombre}</li>)}</ul>}
                    </div>
                )}

                {abierto && !yo && <p className="text-center text-sm text-slate-500">Elige tu grupo y tu nombre para ver los puntos disponibles.</p>}

                {(yo || !abierto) && puntos.map(p => (
                    <div key={p.id} className="bg-white rounded-2xl shadow overflow-hidden">
                        <div className="bg-blue-600 text-white px-4 py-2.5 font-bold text-sm sm:text-base">📍 {p.nombre}</div>
                        <div className="p-3 space-y-3">
                            {p.turnos.map(t => (
                                <div key={t.id}>
                                    <p className="text-xs font-bold text-slate-500 mb-1.5">{t.hora} · hasta {p.cupo} hermanos</p>
                                    <div className="grid grid-cols-5 gap-1.5">
                                        {DIAS.map(d => {
                                            if (!t.dias.includes(d.n)) return <div key={d.n} />;
                                            const lista = inscritos[slotKey(p.id, t.id, d.n)] || [];
                                            const mio = !!yo && lista.some(i => i.pubId === yo.id);
                                            const lleno = cupoLleno(lista, p.cupo);
                                            const cls = mio ? 'bg-emerald-500 text-white border-emerald-600'
                                                : lleno ? 'bg-slate-200 text-slate-400 border-slate-200'
                                                : 'bg-white text-slate-700 border-blue-300 hover:bg-blue-50';
                                            return (
                                                <button key={d.n} disabled={!abierto || !yo || busy} onClick={() => tocar(p, t, d.n)}
                                                    className={`rounded-xl border-2 py-1.5 text-center transition disabled:cursor-default ${cls}`}>
                                                    <span className="block text-[11px] font-semibold">{d.corto}</span>
                                                    <span className="block text-base font-extrabold leading-none">{fechaDia(semana.tuesday, d.n).getDate()}</span>
                                                    <span className="block text-[11px]">{mio ? '✓ tú' : lleno ? 'Completo' : `${lista.length}/${p.cupo}`}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <details className="mt-1.5 text-xs text-slate-600">
                                        <summary className="cursor-pointer text-blue-600">Ver quiénes van</summary>
                                        <ul className="mt-1 space-y-0.5">
                                            {DIAS.filter(d => t.dias.includes(d.n)).map(d => {
                                                const l = inscritos[slotKey(p.id, t.id, d.n)] || [];
                                                return <li key={d.n}><b>{d.largo}:</b> {l.length ? l.map(i => i.nombre).join(', ') : <span className="text-slate-400">nadie aún</span>}</li>;
                                            })}
                                        </ul>
                                    </details>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
                <p className="text-center text-xs text-slate-400 pb-6">Cong. Cerro de la Silla · Predicación pública con exhibidores</p>
            </div>

            {modal && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4" onClick={() => setModal(null)}>
                    <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="text-5xl mb-2">{modal.tipo === 'ok' ? '🎉' : modal.tipo === 'lleno' ? '🤝' : modal.tipo === 'conflicto' ? '⏰' : '⚠️'}</div>
                        <h2 className="text-xl font-extrabold text-slate-800">{modal.texto}</h2>
                        {modal.detalle && <p className="mt-2 text-slate-600 text-sm whitespace-pre-line">{modal.detalle}</p>}
                        {modal.tipo === 'ok' && <p className="mt-2 text-xs text-slate-400">Si no puedes asistir, toca de nuevo el día para quitarte.</p>}
                        <button onClick={() => setModal(null)} className="mt-5 w-full bg-blue-600 text-white font-bold py-2.5 rounded-xl hover:bg-blue-700">
                            {modal.tipo === 'lleno' ? 'Ver otros puntos' : 'Entendido'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

/* ------------------------------ panel de administración ------------------------------ */
export const PredicacionPublicaAdmin: React.FC<{ canEdit?: boolean }> = ({ canEdit = true }) => {
    const puntosDb = usePuntos();
    const actual = useSemana();
    const [tab, setTab] = useState<'programa' | 'puntos'>('programa');
    const [offset, setOffset] = useState(0); // semanas hacia atrás
    const tuesday = useMemo(() => new Date(actual.tuesday.getFullYear(), actual.tuesday.getMonth(), actual.tuesday.getDate() - 7 * offset), [actual.tuesday, offset]);
    const weekId = weekIdOf(tuesday);
    const inscritos = useInscritos(weekId);
    const titulo = tituloSemana(tuesday);
    const [draft, setDraft] = useState<Punto[] | null>(null);
    const [msg, setMsg] = useState('');
    const puntos = puntosDb || [];

    useEffect(() => { if (puntosDb && !draft) setDraft(JSON.parse(JSON.stringify(puntosDb))); }, [puntosDb, draft]);

    const quitar = async (punto: Punto, t: Turno, dia: number, i: Inscrito) => {
        if (!canEdit || !window.confirm(`¿Quitar a ${i.nombre} de este turno?`)) return;
        await cambiarInscripcion(weekId, titulo, punto, slotKey(punto.id, t.id, dia), { id: i.pubId, nombre: i.nombre, grupo: i.grupo }, 'del');
    };

    const guardarPuntos = async () => {
        if (!draft) return;
        const limpio = draft.filter(p => p.nombre.trim()).map(p => ({ ...p, nombre: p.nombre.trim(), cupo: Math.max(1, Number(p.cupo) || CUPO_DEFECTO), turnos: p.turnos.filter(t => t.hora.trim() && t.dias.length) }));
        await db.collection('settings').doc(CONFIG_DOC).set({ puntos: limpio });
        setMsg('Puntos guardados. Ya se ven en el formulario.'); setTimeout(() => setMsg(''), 3000);
    };
    const upd = (fn: (d: Punto[]) => void) => setDraft(prev => { const c = JSON.parse(JSON.stringify(prev || [])); fn(c); return c; });

    const mensajeWA = `*${titulo}*\n\nHermanos, ya está abierto el programa para apuntarse a la predicación pública con exhibidores. Elijan su punto y turno aquí:\n${ENLACE_EXHIBIDORES}\n\nPueden apuntarse hasta el lunes a las 8 pm. ¡Se agradece mucho su apoyo! 🙏`;

    const descargarPDF = () => {
        const doc = new jsPDF({ unit: 'mm', format: 'letter' });
        doc.setFontSize(13); doc.setFont('helvetica', 'bold');
        doc.text(doc.splitTextToSize(titulo.toUpperCase(), 190), 12, 14);
        let y = 26;
        puntos.forEach(p => p.turnos.forEach(t => {
            const filas = DIAS.filter(d => t.dias.includes(d.n)).map(d => {
                const l = inscritos[slotKey(p.id, t.id, d.n)] || [];
                return [`${d.largo}, ${fechaDia(tuesday, d.n).getDate()} de ${fmtCorta(fechaDia(tuesday, d.n)).split(' de ')[1]}`, ...Array.from({ length: p.cupo }, (_, k) => l[k]?.nombre || '')];
            });
            autoTable(doc, {
                startY: y, margin: { left: 12, right: 12 }, pageBreak: 'avoid', theme: 'grid',
                head: [[{ content: p.nombre, colSpan: p.cupo + 1, styles: { halign: 'center', fillColor: [165, 190, 240], textColor: 0 } }],
                       [{ content: 'CAPITÁN / ' + t.hora, colSpan: p.cupo + 1, styles: { halign: 'center', fillColor: [205, 220, 245], textColor: 0, fontStyle: 'normal' } }]],
                body: filas, styles: { fontSize: 9, cellPadding: 1.6, textColor: 0, lineColor: [160, 160, 160], lineWidth: 0.2 },
                columnStyles: { 0: { cellWidth: 42, fontStyle: 'bold' } },
            });
            y = (doc as any).lastAutoTable.finalY + 6;
        }));
        doc.save(`Predicacion-exhibidores-${weekId}.pdf`);
    };

    if (!puntosDb || !draft) return <div className="p-8 text-center text-slate-500">Cargando…</div>;

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-xl shadow p-4 flex flex-col sm:flex-row gap-4 items-center">
                <QRCodeSVG value={ENLACE_EXHIBIDORES} size={110} />
                <div className="flex-1 w-full">
                    <h2 className="font-bold text-slate-800">Enlace para los hermanos</h2>
                    <p className="text-xs text-slate-500 mb-2">Se abre solo cada sábado a las 12:00 y cierra el lunes a las 8 pm. No requiere inicio de sesión.</p>
                    <input readOnly value={ENLACE_EXHIBIDORES} className="w-full border rounded p-2 text-sm bg-slate-50" onFocus={e => e.target.select()} />
                    <div className="flex gap-2 mt-2 flex-wrap">
                        <button onClick={() => { navigator.clipboard?.writeText(ENLACE_EXHIBIDORES); setMsg('Enlace copiado'); setTimeout(() => setMsg(''), 2000); }} className="px-3 py-1.5 bg-slate-700 text-white rounded text-sm">Copiar enlace</button>
                        <a href={`https://wa.me/?text=${encodeURIComponent(mensajeWA)}`} target="_blank" rel="noreferrer" className="px-3 py-1.5 bg-green-600 text-white rounded text-sm">Enviar por WhatsApp</a>
                    </div>
                </div>
            </div>
            {msg && <div className="bg-emerald-100 text-emerald-800 text-sm rounded p-2">{msg}</div>}

            <div className="flex gap-2">
                {(['programa', 'puntos'] as const).map(t => (
                    <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab === t ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border'}`}>{t === 'programa' ? 'Programa de la semana' : 'Puntos y turnos'}</button>
                ))}
            </div>

            {tab === 'programa' && (
                <div className="space-y-3">
                    <div className="flex flex-wrap gap-2 items-center">
                        <select value={offset} onChange={e => setOffset(Number(e.target.value))} className="border rounded p-2 text-sm bg-white">
                            {[0, 1, 2, 3, 4, 5, 6, 7].map(o => { const d = new Date(actual.tuesday.getFullYear(), actual.tuesday.getMonth(), actual.tuesday.getDate() - 7 * o); return <option key={o} value={o}>{o === 0 ? 'Semana en curso de llenado · ' : ''}{fmtCorta(d)} al {fmtCorta(fechaDia(d, 6))}</option>; })}
                        </select>
                        <button onClick={descargarPDF} className="px-3 py-2 bg-blue-600 text-white rounded text-sm font-semibold">Descargar PDF</button>
                    </div>
                    {puntos.map(p => (
                        <div key={p.id} className="bg-white rounded-xl shadow overflow-hidden">
                            <div className="bg-blue-100 text-blue-900 font-bold px-3 py-2 text-sm">{p.nombre}</div>
                            {p.turnos.map(t => (
                                <div key={t.id} className="px-3 py-2 border-t text-sm">
                                    <p className="text-xs font-bold text-slate-500">{t.hora}</p>
                                    {DIAS.filter(d => t.dias.includes(d.n)).map(d => {
                                        const l = inscritos[slotKey(p.id, t.id, d.n)] || [];
                                        return (
                                            <div key={d.n} className="flex flex-wrap items-center gap-1 py-0.5">
                                                <span className="w-28 font-semibold text-slate-700">{d.largo} {fechaDia(tuesday, d.n).getDate()}</span>
                                                {l.length === 0 && <span className="text-slate-300 text-xs">—</span>}
                                                {l.map(i => (
                                                    <span key={i.pubId} className="bg-slate-100 rounded-full pl-2 pr-1 py-0.5 text-xs flex items-center gap-1">{i.nombre}
                                                        {canEdit && <button onClick={() => quitar(p, t, d.n, i)} className="text-red-500 font-bold px-1" title="Quitar">×</button>}</span>
                                                ))}
                                                <span className={`text-xs ml-auto ${l.length >= p.cupo ? 'text-red-500 font-bold' : 'text-slate-400'}`}>{l.length}/{p.cupo}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            )}

            {tab === 'puntos' && (
                <div className="space-y-3">
                    <p className="text-xs text-slate-500">Los puntos y turnos se repiten cada semana. Para agregar un turno en la tarde, agrega un turno nuevo con su horario y días. El cupo es por punto, turno y día.</p>
                    {draft.map((p, pi) => (
                        <div key={p.id} className="bg-white rounded-xl shadow p-3 space-y-2">
                            <div className="flex gap-2">
                                <input value={p.nombre} placeholder="Nombre del punto (calles)" onChange={e => upd(d => { d[pi].nombre = e.target.value; })} className="flex-1 border rounded p-2 text-sm" />
                                <label className="text-xs text-slate-500 flex items-center gap-1">Cupo<input type="number" min={1} max={12} value={p.cupo} onChange={e => upd(d => { d[pi].cupo = Number(e.target.value); })} className="w-14 border rounded p-2 text-sm" /></label>
                                <button onClick={() => window.confirm('¿Eliminar este punto?') && upd(d => { d.splice(pi, 1); })} className="text-red-500 font-bold px-2">🗑</button>
                            </div>
                            {p.turnos.map((t, ti) => (
                                <div key={t.id} className="flex flex-wrap items-center gap-2 bg-slate-50 rounded p-2">
                                    <input value={t.hora} placeholder="7 am a 9 am" onChange={e => upd(d => { d[pi].turnos[ti].hora = e.target.value; })} className="border rounded p-1.5 text-sm w-32" />
                                    {DIAS.map(dd => (
                                        <label key={dd.n} className="text-xs flex items-center gap-1"><input type="checkbox" checked={t.dias.includes(dd.n)} onChange={e => upd(d => { const s = new Set(d[pi].turnos[ti].dias); e.target.checked ? s.add(dd.n) : s.delete(dd.n); d[pi].turnos[ti].dias = Array.from(s).sort(); })} />{dd.corto}</label>
                                    ))}
                                    {p.turnos.length > 1 && <button onClick={() => upd(d => { d[pi].turnos.splice(ti, 1); })} className="text-red-500 text-xs ml-auto">Quitar turno</button>}
                                </div>
                            ))}
                            <button onClick={() => upd(d => { d[pi].turnos.push({ id: newId(), hora: '6 pm a 8 pm', dias: [3, 4, 5] }); })} className="text-blue-600 text-xs font-semibold">+ Agregar turno</button>
                        </div>
                    ))}
                    <div className="flex gap-2 flex-wrap">
                        <button onClick={() => upd(d => { d.push({ id: newId(), nombre: '', cupo: CUPO_DEFECTO, turnos: [{ id: 't1', hora: '7 am a 9 am', dias: [2, 3, 4, 5, 6] }] }); })} className="px-3 py-2 bg-slate-200 rounded text-sm font-semibold">+ Agregar punto</button>
                        {canEdit && <button onClick={guardarPuntos} className="px-4 py-2 bg-emerald-600 text-white rounded text-sm font-bold">Guardar puntos</button>}
                    </div>
                </div>
            )}
        </div>
    );
};

export const PredicacionPublicaView: React.FC<{ canEdit?: boolean }> = ({ canEdit }) => (
    <div className="p-2 sm:p-4 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-800 mb-3">Predicación pública con exhibidores</h1>
        <PredicacionPublicaAdmin canEdit={canEdit} />
    </div>
);
