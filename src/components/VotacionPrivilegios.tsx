import React, { useEffect, useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Publisher } from '../types';
import { ASSIGNMENT_ROLES, normalizeRoles } from '../assignmentRoles';

declare const db: any;
declare const firebase: any;

// ─────────────────────────────────────────────────────────────────────────────
// Votación de ancianos para el checklist de varones.
//  - VotacionPrivilegiosForm  → formulario público (enlace ?votacion=1), cada anciano
//                               elige su nombre y opina por cada hermano.
//  - VotacionPrivilegiosAdmin → panel de resultados (solo dentro de la app, con sesión).
// Datos: colección `votacion_privilegios`, un documento por anciano (id = id del anciano).
// ─────────────────────────────────────────────────────────────────────────────

const COLLECTION = 'votacion_privilegios';
export const VOTACION_PARAM = 'votacion';

export const ROLE_SHORT: Record<string, string> = {
    'Presidente': 'PRES',
    'Acomodador PP': 'A PP',
    'Acomodador Puerta del Auditorio': 'A PA',
    'Acomodador de Auditorio': 'A AUD',
    'Micrófonos': 'MIC',
    'Vigilante': 'VIG',
    'Lector de la Atalaya': 'LEC',
    'Conductor de la Atalaya': 'COND',
    'Capitán para Predicación': 'CAP',
    'Oración': 'ORA',
    'Califica para Discursar': 'DIS',
};

type PubVote = { roles: string[]; obs: string; reviewed: boolean };
export type ElderDoc = {
    id: string;
    elderId: string;
    elderName: string;
    submitted: boolean;
    votes: Record<string, PubVote>;
    updatedAt?: any;
    submittedAt?: any;
};

const fullName = (p: Publisher) => [p.Nombre, p.Apellido].filter(Boolean).join(' ').trim();

const isActiveMale = (p: Publisher) =>
    String(p.Sexo || '').trim().toLowerCase() === 'hombre' && p.Estatus === 'Activo';

const isActiveElder = (p: Publisher) => p.Privilegio === 'Anciano' && p.Estatus === 'Activo';

const sortPublishers = (list: Publisher[]) =>
    [...list].sort((a, b) =>
        String(a.Grupo || 'zzz').localeCompare(String(b.Grupo || 'zzz'), 'es') ||
        fullName(a).localeCompare(fullName(b), 'es'));

const formatDate = (ts: any) => {
    try {
        const d = ts?.toDate ? ts.toDate() : null;
        return d ? d.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : '';
    } catch { return ''; }
};

// ── Regla de conteo ──────────────────────────────────────────────────────────
// Cuentan solo los ancianos que ENVIARON su votación y que REVISARON a ese hermano
// (un anciano no vota por sí mismo). Califica si a favor >= mitad de los que votaron.
export const tallyPublisher = (docs: ElderDoc[], pubId: string) => {
    const counted = docs.filter(d => d.submitted && d.elderId !== pubId && d.votes?.[pubId]?.reviewed);
    const perRole: Record<string, { favor: number; total: number; ok: boolean }> = {};
    ASSIGNMENT_ROLES.forEach(role => {
        const favor = counted.filter(d => (d.votes[pubId].roles || []).includes(role)).length;
        perRole[role] = { favor, total: counted.length, ok: counted.length > 0 && favor * 2 >= counted.length };
    });
    return { counted, perRole };
};

// Lee todas las respuestas (requiere sesión iniciada). Si falla, devuelve lista vacía.
export const loadVotacionDocs = async (): Promise<ElderDoc[]> => {
    try {
        const snap = await db.collection(COLLECTION).get();
        return snap.docs.map((d: any) => ({ ...d.data(), id: d.id }));
    } catch (err) {
        console.warn('Votación: no se pudieron leer las respuestas', err);
        return [];
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// FORMULARIO PÚBLICO (para cada anciano)
// ═════════════════════════════════════════════════════════════════════════════
export const VotacionPrivilegiosForm: React.FC<{ publishers: Publisher[] }> = ({ publishers }) => {
    const elders = useMemo(() => sortPublishers(publishers.filter(isActiveElder)), [publishers]);
    const brothers = useMemo(() => sortPublishers(publishers.filter(isActiveMale)), [publishers]);

    const [elderId, setElderId] = useState('');
    const [votes, setVotes] = useState<Record<string, PubVote>>({});
    const [loadingDoc, setLoadingDoc] = useState(false);
    const [wasSubmitted, setWasSubmitted] = useState(false);
    const [submittedAt, setSubmittedAt] = useState<any>(null);
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
    const [search, setSearch] = useState('');
    const [groupFilter, setGroupFilter] = useState('todos');
    const [onlyPending, setOnlyPending] = useState(false);
    const [openId, setOpenId] = useState<string | null>(null);

    const elder = elders.find(e => e.id === elderId) || null;

    // Cargar lo que este anciano ya había guardado
    useEffect(() => {
        if (!elderId) return;
        let cancelled = false;
        setLoadingDoc(true);
        setMessage(null);
        setDirty(false);
        db.collection(COLLECTION).doc(elderId).get()
            .then((snap: any) => {
                if (cancelled) return;
                const data = snap.exists ? snap.data() : null;
                setVotes(data?.votes || {});
                setWasSubmitted(!!data?.submitted);
                setSubmittedAt(data?.submittedAt || null);
            })
            .catch((err: any) => {
                console.error('Votación: no se pudo leer', err);
                if (!cancelled) {
                    setVotes({});
                    setWasSubmitted(false);
                }
            })
            .finally(() => { if (!cancelled) setLoadingDoc(false); });
        return () => { cancelled = true; };
    }, [elderId]);

    // Aviso si intenta salir con cambios sin guardar
    useEffect(() => {
        const handler = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [dirty]);

    const visibleBrothers = useMemo(() => brothers.filter(b => b.id !== elderId), [brothers, elderId]);
    const groups = useMemo(
        () => Array.from(new Set(visibleBrothers.map(b => b.Grupo || 'Sin grupo'))).sort((a, b) => a.localeCompare(b, 'es')),
        [visibleBrothers]
    );
    const reviewedCount = visibleBrothers.filter(b => votes[b.id]?.reviewed).length;

    const filtered = visibleBrothers.filter(b => {
        if (groupFilter !== 'todos' && (b.Grupo || 'Sin grupo') !== groupFilter) return false;
        if (onlyPending && votes[b.id]?.reviewed) return false;
        if (search.trim() && !fullName(b).toLowerCase().includes(search.trim().toLowerCase())) return false;
        return true;
    });

    const updateVote = (pubId: string, patch: Partial<PubVote>) => {
        setVotes(prev => {
            const cur: PubVote = prev[pubId] || { roles: [], obs: '', reviewed: false };
            return { ...prev, [pubId]: { ...cur, ...patch, reviewed: true } };
        });
        setDirty(true);
        setMessage(null);
    };

    const toggleRole = (pubId: string, role: string) => {
        const cur = votes[pubId]?.roles || [];
        updateVote(pubId, { roles: cur.includes(role) ? cur.filter(r => r !== role) : [...cur, role] });
    };

    const save = async (submit: boolean) => {
        if (!elder) return;
        if (submit && reviewedCount < visibleBrothers.length) {
            const missing = visibleBrothers.length - reviewedCount;
            const ok = window.confirm(
                `Te faltan ${missing} hermano(s) por revisar. Los que no revises NO contarán en el resultado (ni a favor ni en contra).\n\n¿Enviar de todos modos?`
            );
            if (!ok) return;
        }
        setSaving(true);
        setMessage(null);
        try {
            const clean: Record<string, PubVote> = {};
            Object.entries(votes).forEach(([id, v]) => {
                clean[id] = { roles: v.roles || [], obs: (v.obs || '').trim(), reviewed: !!v.reviewed };
            });
            const isSubmitted = submit || wasSubmitted;
            const payload: any = {
                elderId: elder.id,
                elderName: fullName(elder),
                submitted: isSubmitted,
                votes: clean,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            };
            if (submit) payload.submittedAt = firebase.firestore.FieldValue.serverTimestamp();
            else if (submittedAt) payload.submittedAt = submittedAt;
            await db.collection(COLLECTION).doc(elder.id).set(payload);
            setWasSubmitted(isSubmitted);
            setDirty(false);
            setMessage({
                type: 'ok',
                text: submit
                    ? '¡Gracias! Tu opinión fue enviada. Si quieres cambiar algo, puedes entrar otra vez, corregirlo y volver a enviar.'
                    : 'Avance guardado. Puedes continuar después con el mismo enlace.',
            });
        } catch (err) {
            console.error('Votación: error al guardar', err);
            setMessage({ type: 'error', text: 'No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 pb-32">
            <div className="max-w-3xl mx-auto p-4">
                <header className="bg-white rounded-xl shadow p-5 mb-4">
                    <h1 className="text-2xl font-bold text-blue-700">Opinión de los ancianos</h1>
                    <p className="text-slate-600 text-sm mt-1">
                        Checklist de varones · Congregación Cerro de la Silla
                    </p>
                    <ol className="text-sm text-slate-600 mt-3 list-decimal list-inside space-y-1">
                        <li>Elige tu nombre.</li>
                        <li>Por cada hermano, marca los privilegios que consideras que se le pueden asignar.</li>
                        <li>Si quieres, anota en qué puede mejorar.</li>
                        <li>Pulsa <b>Enviar mi opinión</b>. Puedes guardar avance y continuar después.</li>
                    </ol>
                    <p className="text-xs text-slate-500 mt-3">
                        Una casilla sin marcar significa que no estás a favor de ese privilegio. Los hermanos que no revises
                        no cuentan en el resultado.
                    </p>
                </header>

                <div className="bg-white rounded-xl shadow p-5 mb-4">
                    <label htmlFor="elder-select" className="block text-sm font-semibold text-slate-700 mb-1">
                        ¿Quién eres? (anciano)
                    </label>
                    <select
                        id="elder-select"
                        value={elderId}
                        onChange={e => {
                            if (dirty && !window.confirm('Tienes cambios sin guardar. ¿Cambiar de anciano y perderlos?')) return;
                            setElderId(e.target.value);
                            setVotes({});
                            setOpenId(null);
                        }}
                        className="w-full p-3 border rounded-lg bg-white"
                    >
                        <option value="">— Selecciona tu nombre —</option>
                        {elders.map(e => <option key={e.id} value={e.id}>{fullName(e)}</option>)}
                    </select>
                    {elders.length === 0 && (
                        <p className="text-sm text-amber-700 mt-2">
                            No hay ancianos activos en la lista de publicadores (Privilegio = Anciano).
                        </p>
                    )}
                    {wasSubmitted && elder && (
                        <p className="text-sm text-green-700 mt-2">
                            ✓ Ya enviaste tu opinión{submittedAt ? ` (${formatDate(submittedAt)})` : ''}. Si cambias algo, vuelve a enviarla.
                        </p>
                    )}
                </div>

                {elder && loadingDoc && <p className="text-center text-slate-500 py-8">Cargando…</p>}

                {elder && !loadingDoc && (
                    <>
                        <div className="bg-white rounded-xl shadow p-4 mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <input
                                type="search"
                                placeholder="Buscar hermano…"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="p-2 border rounded-lg"
                            />
                            <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)} className="p-2 border rounded-lg bg-white">
                                <option value="todos">Todos los grupos</option>
                                {groups.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                            <label className="flex items-center gap-2 text-sm text-slate-700">
                                <input type="checkbox" checked={onlyPending} onChange={e => setOnlyPending(e.target.checked)} />
                                Solo los que me faltan
                            </label>
                        </div>

                        <div className="space-y-3">
                            {filtered.map(b => {
                                const v = votes[b.id];
                                const isOpen = openId === b.id;
                                const has = normalizeRoles(b.asignacionesDisponibles);
                                return (
                                    <div key={b.id} className={`bg-white rounded-xl shadow border-l-4 ${v?.reviewed ? 'border-green-500' : 'border-slate-300'}`}>
                                        <button
                                            type="button"
                                            onClick={() => setOpenId(isOpen ? null : b.id)}
                                            className="w-full text-left p-4 flex items-center justify-between gap-3"
                                        >
                                            <div className="min-w-0">
                                                <p className="font-semibold text-slate-800 truncate">{fullName(b)}</p>
                                                <p className="text-xs text-slate-500">
                                                    {b.Grupo || 'Sin grupo'}{b.Privilegio ? ` · ${b.Privilegio}` : ''}
                                                    {has.length > 0 && ` · Ya tiene: ${has.map(r => ROLE_SHORT[r] || r).join(', ')}`}
                                                </p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                {v?.reviewed
                                                    ? <span className="text-xs font-bold text-green-700">✓ {v.roles.length} marcado(s)</span>
                                                    : <span className="text-xs text-slate-400">Pendiente</span>}
                                                <span className="block text-slate-400">{isOpen ? '▲' : '▼'}</span>
                                            </div>
                                        </button>

                                        {isOpen && (
                                            <div className="px-4 pb-4 border-t">
                                                <p className="text-sm font-semibold text-slate-700 mt-3 mb-2">
                                                    ¿Qué privilegios se le pueden asignar?
                                                </p>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    {ASSIGNMENT_ROLES.map(role => (
                                                        <label key={role} className="flex items-center gap-2 p-2 rounded-lg border cursor-pointer hover:bg-slate-50">
                                                            <input
                                                                type="checkbox"
                                                                className="h-5 w-5"
                                                                checked={(v?.roles || []).includes(role)}
                                                                onChange={() => toggleRole(b.id, role)}
                                                            />
                                                            <span className="text-sm">{role}</span>
                                                            {has.includes(role) && <span className="ml-auto text-[10px] text-blue-600 font-semibold">ya lo tiene</span>}
                                                        </label>
                                                    ))}
                                                </div>
                                                <label className="block text-sm font-semibold text-slate-700 mt-4 mb-1">
                                                    Observaciones (¿en qué puede mejorar?)
                                                </label>
                                                <textarea
                                                    rows={3}
                                                    value={v?.obs || ''}
                                                    onChange={e => updateVote(b.id, { obs: e.target.value })}
                                                    className="w-full p-2 border rounded-lg text-sm"
                                                    placeholder="Opcional"
                                                />
                                                {!v?.reviewed && (
                                                    <button
                                                        type="button"
                                                        onClick={() => updateVote(b.id, {})}
                                                        className="mt-3 text-sm text-slate-600 border rounded-lg px-3 py-2 hover:bg-slate-50"
                                                    >
                                                        Ninguno por ahora (marcar como revisado)
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            {filtered.length === 0 && <p className="text-center text-slate-500 py-6">No hay hermanos con ese filtro.</p>}
                        </div>
                    </>
                )}
            </div>

            {elder && !loadingDoc && (
                <div className="fixed bottom-0 inset-x-0 bg-white border-t shadow-lg p-3">
                    <div className="max-w-3xl mx-auto">
                        {message && (
                            <p className={`text-sm mb-2 ${message.type === 'ok' ? 'text-green-700' : 'text-red-600'}`}>{message.text}</p>
                        )}
                        <div className="flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-green-500"
                                        style={{ width: `${visibleBrothers.length ? (reviewedCount / visibleBrothers.length) * 100 : 0}%` }}
                                    />
                                </div>
                                <p className="text-xs text-slate-500 mt-1">
                                    Revisados {reviewedCount} de {visibleBrothers.length}{dirty ? ' · cambios sin guardar' : ''}
                                </p>
                            </div>
                            <button
                                onClick={() => save(false)}
                                disabled={saving || !dirty}
                                className="px-3 py-2 rounded-lg border text-sm font-semibold disabled:opacity-40"
                            >
                                {wasSubmitted ? 'Guardar cambios' : 'Guardar avance'}
                            </button>
                            <button
                                onClick={() => save(true)}
                                disabled={saving}
                                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold disabled:opacity-40"
                            >
                                {saving ? 'Guardando…' : 'Enviar mi opinión'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ═════════════════════════════════════════════════════════════════════════════
// PANEL DE RESULTADOS (dentro de la app)
// ═════════════════════════════════════════════════════════════════════════════
export const VotacionPrivilegiosAdmin: React.FC<{ publishers: Publisher[]; onClose: () => void }> = ({ publishers, onClose }) => {
    const [docs, setDocs] = useState<ElderDoc[]>([]);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [groupFilter, setGroupFilter] = useState('todos');
    const [expanded, setExpanded] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [confirm, setConfirm] = useState<null | 'apply' | 'reset'>(null);
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState('');

    useEffect(() => {
        const unsub = db.collection(COLLECTION).onSnapshot(
            (snap: any) => setDocs(snap.docs.map((d: any) => ({ ...d.data(), id: d.id }))),
            (err: any) => {
                console.error('Votación: listener falló', err);
                setError('No se pudieron leer los votos. Revisa las reglas de Firestore (ver instrucciones).');
            }
        );
        return () => unsub();
    }, []);

    const elders = useMemo(() => sortPublishers(publishers.filter(isActiveElder)), [publishers]);
    const brothers = useMemo(() => sortPublishers(publishers.filter(isActiveMale)), [publishers]);
    const groups = useMemo(
        () => Array.from(new Set(brothers.map(b => b.Grupo || 'Sin grupo'))).sort((a, b) => a.localeCompare(b, 'es')),
        [brothers]
    );

    const docByElder = useMemo(() => {
        const m: Record<string, ElderDoc> = {};
        docs.forEach(d => { m[d.elderId] = d; });
        return m;
    }, [docs]);
    const submittedCount = elders.filter(e => docByElder[e.id]?.submitted).length;

    const link = `${window.location.origin}${window.location.pathname}?${VOTACION_PARAM}=1`;

    const rows = useMemo(() => brothers.map(b => ({ b, ...tallyPublisher(docs, b.id) })), [brothers, docs]);
    const filteredRows = rows.filter(r => {
        if (groupFilter !== 'todos' && (r.b.Grupo || 'Sin grupo') !== groupFilter) return false;
        if (search.trim() && !fullName(r.b).toLowerCase().includes(search.trim().toLowerCase())) return false;
        return true;
    });

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            window.prompt('Copia este enlace:', link);
        }
    };

    const shareWhatsApp = () => {
        const text = `Hermanos ancianos: por favor llenen su opinión sobre los privilegios de los varones (checklist). Elijan su nombre y pulsen "Enviar mi opinión":\n${link}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    };

    // Privilegios que calificaron y todavía no tiene marcados el hermano
    const pendingApply = useMemo(() => {
        return rows
            .map(r => {
                const has = normalizeRoles(r.b.asignacionesDisponibles);
                const add = ASSIGNMENT_ROLES.filter(role => r.perRole[role].ok && !has.includes(role));
                return { b: r.b, has, add };
            })
            .filter(x => x.add.length > 0);
    }, [rows]);

    const applyResults = async () => {
        setBusy(true);
        try {
            for (let i = 0; i < pendingApply.length; i += 400) {
                const batch = db.batch();
                pendingApply.slice(i, i + 400).forEach(x => {
                    batch.update(db.collection('publishers').doc(x.b.id), {
                        asignacionesDisponibles: [...x.has, ...x.add],
                    });
                });
                await batch.commit();
            }
            setNotice(`Listo: se agregaron ${pendingApply.reduce((n, x) => n + x.add.length, 0)} privilegio(s) en ${pendingApply.length} hermano(s). No se quitó ninguno.`);
        } catch (err) {
            console.error(err);
            setNotice('No se pudo aplicar el resultado. Inténtalo de nuevo.');
        } finally {
            setBusy(false);
            setConfirm(null);
        }
    };

    const resetRound = async () => {
        setBusy(true);
        try {
            const snap = await db.collection(COLLECTION).get();
            const batch = db.batch();
            snap.docs.forEach((d: any) => batch.delete(d.ref));
            await batch.commit();
            setNotice('Se borraron todas las respuestas. Puedes iniciar una nueva ronda con el mismo enlace.');
        } catch (err) {
            console.error(err);
            setNotice('No se pudieron borrar las respuestas.');
        } finally {
            setBusy(false);
            setConfirm(null);
        }
    };

    const downloadPDF = () => {
        const doc = new jsPDF({ orientation: 'landscape' });
        const pageW = doc.internal.pageSize.getWidth();
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('DECISIÓN DEL CUERPO DE ANCIANOS - PRIVILEGIOS DE VARONES', pageW / 2, 14, { align: 'center' });
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(
            `Generado el ${new Date().toLocaleDateString('es-MX')} · Ancianos que respondieron: ${submittedCount} de ${elders.length} · Califica con la mitad o más a favor`,
            pageW / 2, 20, { align: 'center' }
        );

        const head = [['Nombre', 'Grupo', ...ASSIGNMENT_ROLES.map(r => ROLE_SHORT[r] || r)]];
        const body = rows
            .filter(r => r.counted.length > 0)
            .map(r => [
                fullName(r.b),
                r.b.Grupo || 'Sin grupo',
                ...ASSIGNMENT_ROLES.map(role => `${r.perRole[role].favor}/${r.perRole[role].total}`),
            ]);

        autoTable(doc, {
            head,
            body,
            startY: 25,
            theme: 'grid',
            headStyles: { fillColor: [44, 62, 80], textColor: 255, fontSize: 8, halign: 'center' },
            styles: { fontSize: 8, cellPadding: 1.8, halign: 'center' },
            columnStyles: { 0: { halign: 'left', cellWidth: 55 }, 1: { halign: 'left', cellWidth: 30 } },
            didParseCell: (data: any) => {
                if (data.section !== 'body' || data.column.index < 2) return;
                const role = ASSIGNMENT_ROLES[data.column.index - 2];
                const name = data.row.raw?.[0];
                const r = rows.find(x => fullName(x.b) === name);
                if (!r) return;
                data.cell.styles.fillColor = r.perRole[role].ok ? [198, 239, 206] : [255, 220, 220];
            },
            margin: { left: 10, right: 10 },
        });

        let y = (doc as any).lastAutoTable?.finalY || 30;
        doc.setFontSize(7);
        doc.setTextColor(100);
        doc.text(
            ASSIGNMENT_ROLES.map(r => `${ROLE_SHORT[r]}: ${r}`).join('  |  '),
            10, y + 6, { maxWidth: pageW - 20 }
        );
        doc.setTextColor(0);

        const withNotes = rows
            .map(r => ({
                name: fullName(r.b),
                notes: docs
                    .filter(d => d.submitted && d.elderId !== r.b.id && (d.votes?.[r.b.id]?.obs || '').trim())
                    .map(d => d.votes[r.b.id].obs.trim()),
            }))
            .filter(x => x.notes.length > 0);

        if (withNotes.length > 0) {
            doc.addPage('a4', 'portrait');
            doc.setFontSize(13);
            doc.setFont('helvetica', 'bold');
            doc.text('OBSERVACIONES (en qué puede mejorar cada hermano)', doc.internal.pageSize.getWidth() / 2, 14, { align: 'center' });
            autoTable(doc, {
                head: [['Hermano', 'Observaciones']],
                body: withNotes.map(x => [x.name, x.notes.map(n => `• ${n}`).join('\n')]),
                startY: 20,
                theme: 'grid',
                headStyles: { fillColor: [44, 62, 80], textColor: 255 },
                styles: { fontSize: 9, cellPadding: 2, overflow: 'linebreak' },
                columnStyles: { 0: { cellWidth: 55 } },
            });
        }
        doc.save('Decision_Cuerpo_de_Ancianos_Privilegios.pdf');
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-100 overflow-auto">
            <div className="max-w-7xl mx-auto p-4">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold text-blue-700">Decisión del Cuerpo de Ancianos · Checklist de varones</h2>
                    <button onClick={onClose} className="px-4 py-2 bg-white border rounded-lg font-semibold">Cerrar</button>
                </div>

                {error && <p className="bg-red-50 text-red-700 border border-red-200 rounded-lg p-3 mb-4 text-sm">{error}</p>}
                {notice && <p className="bg-green-50 text-green-800 border border-green-200 rounded-lg p-3 mb-4 text-sm">{notice}</p>}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                    <div className="bg-white rounded-xl shadow p-4 lg:col-span-2">
                        <h3 className="font-bold text-slate-800 mb-2">Enlace para los ancianos</h3>
                        <input readOnly value={link} onFocus={e => e.currentTarget.select()} className="w-full p-2 border rounded-lg text-sm bg-slate-50" />
                        <div className="flex flex-wrap gap-2 mt-3">
                            <button onClick={copyLink} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold">
                                {copied ? '¡Copiado!' : 'Copiar enlace'}
                            </button>
                            <button onClick={shareWhatsApp} className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold">
                                Compartir por WhatsApp
                            </button>
                        </div>
                        <p className="text-xs text-slate-500 mt-3">
                            Regla: cada anciano marca, por hermano, los privilegios que apoya. Califica si a favor ≥ mitad de los
                            ancianos que enviaron y revisaron a ese hermano (mayoría, o mitad y mitad). Un anciano no vota por sí mismo.
                        </p>
                    </div>

                    <div className="bg-white rounded-xl shadow p-4">
                        <h3 className="font-bold text-slate-800 mb-2">Respuestas: {submittedCount} de {elders.length}</h3>
                        <ul className="text-sm space-y-1 max-h-40 overflow-auto">
                            {elders.map(e => {
                                const d = docByElder[e.id];
                                return (
                                    <li key={e.id} className="flex justify-between gap-2">
                                        <span className="truncate">{fullName(e)}</span>
                                        {d?.submitted
                                            ? <span className="text-green-700 shrink-0">✓ {formatDate(d.submittedAt)}</span>
                                            : d ? <span className="text-amber-600 shrink-0">en proceso</span>
                                                : <span className="text-slate-400 shrink-0">pendiente</span>}
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow p-4 mb-4 flex flex-wrap items-center gap-3">
                    <input type="search" placeholder="Buscar hermano…" value={search} onChange={e => setSearch(e.target.value)} className="p-2 border rounded-lg" />
                    <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)} className="p-2 border rounded-lg bg-white">
                        <option value="todos">Todos los grupos</option>
                        {groups.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                    <div className="flex flex-wrap gap-2 ml-auto">
                        <button onClick={downloadPDF} disabled={submittedCount === 0} className="px-3 py-2 bg-orange-600 text-white rounded-lg text-sm font-semibold disabled:opacity-40">
                            Descargar PDF
                        </button>
                        <button onClick={() => setConfirm('apply')} disabled={pendingApply.length === 0 || busy} className="px-3 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold disabled:opacity-40">
                            Aplicar al checklist ({pendingApply.length})
                        </button>
                        <button onClick={() => setConfirm('reset')} disabled={docs.length === 0 || busy} className="px-3 py-2 bg-white border border-red-400 text-red-600 rounded-lg text-sm font-semibold disabled:opacity-40">
                            Nueva ronda
                        </button>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow overflow-auto">
                    <table className="min-w-full text-sm">
                        <thead className="bg-slate-800 text-white">
                            <tr>
                                <th className="text-left p-2 sticky left-0 bg-slate-800">Hermano</th>
                                <th className="p-2">Votaron</th>
                                {ASSIGNMENT_ROLES.map(r => <th key={r} className="p-2 text-center" title={r}>{ROLE_SHORT[r]}</th>)}
                                <th className="p-2">Obs.</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRows.map(({ b, counted, perRole }) => {
                                const has = normalizeRoles(b.asignacionesDisponibles);
                                const notes = docs.filter(d => d.submitted && d.elderId !== b.id && (d.votes?.[b.id]?.obs || '').trim());
                                const isOpen = expanded === b.id;
                                return (
                                    <React.Fragment key={b.id}>
                                        <tr className="border-t">
                                            <td className="p-2 sticky left-0 bg-white font-medium whitespace-nowrap">
                                                {fullName(b)}
                                                <span className="block text-[11px] text-slate-400">{b.Grupo || 'Sin grupo'}</span>
                                            </td>
                                            <td className="p-2 text-center text-slate-600">{counted.length}</td>
                                            {ASSIGNMENT_ROLES.map(role => {
                                                const t = perRole[role];
                                                const holds = has.includes(role);
                                                const cls = t.total === 0
                                                    ? 'text-slate-300'
                                                    : t.ok ? 'bg-green-100 text-green-800 font-semibold' : 'bg-red-50 text-red-700';
                                                return (
                                                    <td key={role} className={`p-2 text-center ${cls}`} title={holds ? 'Ya lo tiene marcado en Publicadores' : undefined}>
                                                        {t.total === 0 ? '—' : `${t.ok ? '✓' : '✗'} ${t.favor}/${t.total}`}
                                                        {holds && <span className="text-blue-600"> ●</span>}
                                                    </td>
                                                );
                                            })}
                                            <td className="p-2 text-center">
                                                {notes.length > 0
                                                    ? <button onClick={() => setExpanded(isOpen ? null : b.id)} className="text-blue-600 underline">{notes.length}</button>
                                                    : <span className="text-slate-300">—</span>}
                                            </td>
                                        </tr>
                                        {isOpen && (
                                            <tr className="bg-slate-50">
                                                <td colSpan={ASSIGNMENT_ROLES.length + 3} className="p-3">
                                                    <p className="font-semibold text-slate-700 mb-1">En qué puede mejorar {b.Nombre}:</p>
                                                    <ul className="space-y-1">
                                                        {notes.map(d => (
                                                            <li key={d.id} className="text-slate-700">
                                                                <b>{d.elderName}:</b> {d.votes[b.id].obs}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                    ✓ califica · ✗ no califica · — sin votos · ● ya lo tiene marcado en Publicadores. "A favor/votaron" cuenta solo ancianos que enviaron y revisaron al hermano.
                </p>
            </div>

            {confirm && (
                <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                        {confirm === 'apply' ? (
                            <>
                                <h3 className="text-lg font-bold mb-2">Aplicar al checklist</h3>
                                <p className="text-sm text-slate-600">
                                    Se marcarán {pendingApply.reduce((n, x) => n + x.add.length, 0)} privilegio(s) que calificaron en {pendingApply.length} hermano(s)
                                    en la ficha de Publicadores. <b>No se quita ningún privilegio</b> que ya tengan.
                                </p>
                            </>
                        ) : (
                            <>
                                <h3 className="text-lg font-bold mb-2 text-red-600">Nueva ronda</h3>
                                <p className="text-sm text-slate-600">
                                    Se borrarán TODAS las respuestas de los ancianos. Esto no se puede deshacer. (Descarga el PDF antes si quieres conservar el resultado.)
                                </p>
                            </>
                        )}
                        <div className="flex justify-end gap-2 mt-5">
                            <button onClick={() => setConfirm(null)} className="px-4 py-2 border rounded-lg">Cancelar</button>
                            <button
                                onClick={confirm === 'apply' ? applyResults : resetRound}
                                disabled={busy}
                                className={`px-4 py-2 rounded-lg text-white font-semibold ${confirm === 'apply' ? 'bg-purple-600' : 'bg-red-600'} disabled:opacity-50`}
                            >
                                {busy ? 'Procesando…' : 'Confirmar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VotacionPrivilegiosForm;
