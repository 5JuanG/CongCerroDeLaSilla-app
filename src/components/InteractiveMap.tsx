
import React, { useState, useRef, useEffect } from 'react';
import { TerritoryMarker, TerritoryRecord, TerritoryMap, ModalInfo } from '../types';
import { DEFAULT_MAP_ERROR } from '../constants';
import { ZONES, TERRITORY_COUNT, DEFAULT_ZONE_BY_TERRITORY, getMarkerZone } from '../zonas';

// Estado de zoom/desplazamiento del mapa: escala (k) y traslación en píxeles.
type MapView = { k: number; tx: number; ty: number };
type Gesture =
    | { mode: 'pan'; startX: number; startY: number; startTx: number; startTy: number; startK: number }
    | { mode: 'pinch'; startDist: number; startK: number; startCx: number; startCy: number; startTx: number; startTy: number };

const MAX_ZOOM = 6;          // acercamiento máximo respecto al mapa ajustado a pantalla
const PAN_THRESHOLD = 6;     // píxeles que debe moverse el dedo para considerarse arrastre (y no un toque)
const NUMBERS_ZOOM = 2;      // en celular, los números de los pines aparecen a partir de este zoom
const PIN_MOBILE = 10;       // tamaño (px en pantalla) de los pines en celular, alejado
const PIN_MOBILE_ZOOMED = 16; // tamaño de los pines en celular con zoom (con número)
const PIN_DESKTOP = 20;      // tamaño de los pines en pantallas grandes
const WRITE_TIMEOUT_MS = 12000; // tiempo máximo esperando la confirmación de Firestore antes de liberar la modal
const WRITE_TIMEOUT_TAG = 'WRITE_TIMEOUT';

// Firestore solo resuelve una escritura cuando el servidor la confirma; con mala señal
// puede tardar indefinidamente y dejar la modal congelada. Esto la libera tras un tiempo
// límite (la escritura sigue su curso en segundo plano y se aplica en cuanto haya conexión).
const withTimeout = <T,>(p: Promise<T>, ms: number = WRITE_TIMEOUT_MS): Promise<T> =>
    new Promise<T>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error(WRITE_TIMEOUT_TAG)), ms);
        p.then(
            v => { clearTimeout(t); resolve(v); },
            e => { clearTimeout(t); reject(e); }
        );
    });
const isWriteTimeout = (e: unknown) => (e as Error)?.message === WRITE_TIMEOUT_TAG;

interface InteractiveMapProps {
    maps: TerritoryMap[];
    markers: TerritoryMarker[];
    records: TerritoryRecord[];
    onSaveMarker?: (marker: Omit<TerritoryMarker, 'id'> & { id?: string }) => Promise<void>;
    onDeleteMarker?: (id: string) => Promise<void>;
    onSaveRecord?: (record: Omit<TerritoryRecord, 'id'>) => Promise<void>;
    onDeleteRecord?: (record: Partial<TerritoryRecord>) => Promise<void>;
    onResetCompletedMarkers?: () => Promise<void>;
    canManage: boolean;
    onShowModal: (info: ModalInfo) => void;
    currentServiceYear: number;
}

const InteractiveMap: React.FC<InteractiveMapProps> = ({ 
    maps, markers, records, onSaveMarker, onDeleteMarker, onSaveRecord, onDeleteRecord, onResetCompletedMarkers, canManage, onShowModal, currentServiceYear 
}) => {
    const [editingMarker, setEditingMarker] = useState<Partial<TerritoryMarker> | null>(null);
    const [editingRecord, setEditingRecord] = useState<Partial<TerritoryRecord> | null>(null);
    // All records found for the selected territory, across every service year
    // (not just the currently selected one). This lets the user find and fix
    // records that were mistakenly saved under the wrong service year — those
    // are otherwise invisible because the rest of the app filters by the
    // currently selected service year.
    const [territoryRecordOptions, setTerritoryRecordOptions] = useState<TerritoryRecord[]>([]);
    // Snapshot of the record as it was BEFORE editing, so we know whether the
    // vuelta number changed and whether we need to delete the old document
    // (otherwise changing the vuelta number creates a duplicate/orphan record
    // instead of correcting the existing one).
    const [originalEditingRecord, setOriginalEditingRecord] = useState<Partial<TerritoryRecord> | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    // Tracks which marker is currently being dragged, and its live x/y while
    // dragging, so we can render it moving smoothly before committing the
    // final position on mouse/touch release.
    const [draggingMarkerId, setDraggingMarkerId] = useState<string | null>(null);
    const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
    // When true (the default), pins cannot be dragged out of place — a tap
    // still opens the assignment form as usual. This prevents accidental
    // moves while working on assignments. The person managing territories
    // must explicitly unlock to reposition a pin, then can lock it again.
    const [pinsLocked, setPinsLocked] = useState(true);
    // Distinguishes a real drag from a simple click/tap, so a click still
    // opens the edit modal instead of being swallowed by the drag handler.
    const dragMovedRef = useRef(false);

    const globalMap = maps.find(m => m.territoryId === 'global');

    // ───────── Vista por zonas ─────────
    // null = mapa global; 1..8 = mapa de esa zona (imagen "zona-N" de Mapas de Territorio).
    const [selectedZone, setSelectedZone] = useState<number | null>(null);
    // Pin (manzana) concreto de la zona que se va a ubicar tocando el mapa (solo quien administra).
    const [placingMarkerId, setPlacingMarkerId] = useState<string | null>(null);
    // Territorio al que se le va a AGREGAR un pin nuevo (otra manzana) tocando el mapa de la zona.
    const [addingTerrNum, setAddingTerrNum] = useState<number | null>(null);
    const activeMap = selectedZone === null ? globalMap : maps.find(m => m.territoryId === `zona-${selectedZone}`);
    const showViewport = !!activeMap;

    // ───────── Zoom y desplazamiento ─────────
    const [view, setView] = useState<MapView>({ k: 1, tx: 0, ty: 0 });
    const [dims, setDims] = useState({ w: 0, winH: typeof window !== 'undefined' ? window.innerHeight : 800 });
    // Proporción alto/ancho de cada imagen, para calcular el tamaño del mapa sin depender del DOM.
    const [ratios, setRatios] = useState<Record<string, number>>({});
    const [isMobile, setIsMobile] = useState(
        () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(max-width: 639px)').matches
    );
    const viewportRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
    const gestureRef = useRef<Gesture | null>(null);
    // true si el gesto actual fue un arrastre del mapa o un pellizco (no un toque).
    const panMovedRef = useRef(false);

    const imgRatio = (activeMap && ratios[activeMap.mapUrl]) || 0.75;
    const vw = dims.w;                       // ancho visible del mapa
    const contentH = vw * imgRatio;          // alto del mapa a escala 1
    // El alto visible se limita al 80% de la pantalla para poder seguir haciendo scroll en la página.
    const vh = vw > 0 ? Math.min(contentH, Math.max(220, dims.winH * 0.8)) : 0;
    const minK = contentH > 0 ? Math.min(1, vh / contentH) : 1; // escala que muestra el mapa completo

    // Mantiene el mapa dentro del área visible (o centrado si es más pequeño que ella).
    const clampView = (v: MapView): MapView => {
        if (vw <= 0 || contentH <= 0) return v;
        const k = Math.min(MAX_ZOOM, Math.max(minK, v.k));
        const cw = vw * k;
        const ch = contentH * k;
        const tx = cw <= vw ? (vw - cw) / 2 : Math.min(0, Math.max(vw - cw, v.tx));
        const ty = ch <= vh ? (vh - ch) / 2 : Math.min(0, Math.max(vh - ch, v.ty));
        return { k, tx, ty };
    };

    // Cambia la escala manteniendo fijo el punto (px, py) del área visible.
    const zoomAt = (v: MapView, newK: number, px: number, py: number): MapView => {
        const k = Math.min(MAX_ZOOM, Math.max(minK, newK));
        const cx = (px - v.tx) / v.k;
        const cy = (py - v.ty) / v.k;
        return clampView({ k, tx: px - cx * k, ty: py - cy * k });
    };

    const fitKey = `${selectedZone ?? 'g'}|${activeMap?.mapUrl ?? ''}|${vw > 0 ? 1 : 0}|${activeMap && ratios[activeMap.mapUrl] ? 1 : 0}`;
    // Al cambiar de mapa (o cuando se conocen sus medidas) se ajusta para verlo completo.
    useEffect(() => {
        setView(clampView({ k: minK, tx: 0, ty: 0 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fitKey]);
    // Si cambia el tamaño de la ventana, solo se vuelve a encuadrar (sin perder el zoom).
    useEffect(() => {
        setView(v => clampView(v));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [vw, vh, contentH]);

    useEffect(() => {
        const el = viewportRef.current;
        if (!el) return;
        const update = () => {
            const w = el.clientWidth;
            const h = window.innerHeight;
            setDims(prev => (prev.w === w && prev.winH === h ? prev : { w, winH: h }));
        };
        update();
        if (typeof ResizeObserver !== 'undefined') {
            const ro = new ResizeObserver(update);
            ro.observe(el);
            return () => ro.disconnect();
        }
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, [showViewport]);

    // Zoom con Ctrl + rueda (o pellizco en el trackpad). Sin Ctrl la rueda sigue haciendo scroll en la página.
    useEffect(() => {
        const el = viewportRef.current;
        if (!el) return;
        const onWheel = (e: WheelEvent) => {
            if (!(e.ctrlKey || e.metaKey)) return;
            e.preventDefault();
            const rect = el.getBoundingClientRect();
            const px = e.clientX - rect.left;
            const py = e.clientY - rect.top;
            setView(v => zoomAt(v, v.k * Math.exp(-e.deltaY * 0.004), px, py));
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showViewport, vw, vh, contentH]);

    useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return;
        const mq = window.matchMedia('(max-width: 639px)');
        const onChange = () => setIsMobile(mq.matches);
        mq.addEventListener?.('change', onChange);
        return () => mq.removeEventListener?.('change', onChange);
    }, []);

    const clampPercent = (value: number) => Math.min(100, Math.max(0, value));

    const getRelativePosition = (clientX: number, clientY: number) => {
        const rect = contentRef.current!.getBoundingClientRect();
        return {
            x: clampPercent(((clientX - rect.left) / rect.width) * 100),
            y: clampPercent(((clientY - rect.top) / rect.height) * 100),
        };
    };

    const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!canManage || !contentRef.current) return;
        // Si el gesto fue un arrastre del mapa o un pellizco, no es un toque.
        if (panMovedRef.current) return;
        // Only treat this as "add a new marker on empty space" if the click
        // landed on the map container or its background image directly —
        // never on a marker (or anything rendered on top of it). This avoids
        // accidentally resetting the edit modal to a blank marker when a
        // click on a pin also bubbles up here.
        const target = e.target as HTMLElement;
        const isBackground = target === e.currentTarget || target === contentRef.current || target.tagName === 'IMG';
        if (!isBackground) return;

        const { x, y } = getRelativePosition(e.clientX, e.clientY);

        if (selectedZone !== null) {
            // En el mapa de una zona, tocar el fondo solo sirve para ubicar el pin
            // del territorio elegido; los pines nuevos se crean en la vista Global.
            if (placingMarkerId !== null) placeZonePin(placingMarkerId, x, y);
            else if (addingTerrNum !== null) addZonePin(addingTerrNum, x, y);
            return;
        }

        setEditingMarker({ x, y, status: 'available', terrNum: 0 });
        setEditingRecord(null);
        setOriginalEditingRecord(null);
        setTerritoryRecordOptions([]);
    };

    const selectZone = (zone: number | null) => {
        setSelectedZone(zone);
        setPlacingMarkerId(null);
        setAddingTerrNum(null);
    };

    // Guarda la posición de UN pin en el mapa de la zona (campos zoneX/zoneY de ese pin).
    // Antes se movían todos los pines del mismo territorio al mismo punto, por eso las
    // manzanas de un territorio quedaban encimadas como si fuera un solo pin.
    const placeZonePin = async (markerId: string, x: number, y: number) => {
        if (!onSaveMarker || selectedZone === null) return;
        const target = markers.find(m => m.id === markerId);
        setPlacingMarkerId(null);
        if (!target) return;
        try {
            await withTimeout(onSaveMarker({ ...target, zoneX: x, zoneY: y }));
        } catch (error) {
            showWriteError(error, 'No se pudo ubicar el pin en el mapa de la zona.');
        }
    };

    // Agrega un pin nuevo (otra manzana) a un territorio, directamente desde el mapa de la zona.
    // Hereda estatus/asignado del pin hermano; la posición en el mapa global queda junto al
    // hermano (se puede arrastrar después desde la vista Global con los pines desbloqueados).
    const addZonePin = async (terrNum: number, x: number, y: number) => {
        if (!onSaveMarker || selectedZone === null) return;
        setAddingTerrNum(null);
        const siblings = markers.filter(m => m.terrNum === terrNum);
        const base = siblings.find(m => getMarkerZone(m) === selectedZone) || siblings[0];
        if (!base) {
            onShowModal({ type: 'error', title: 'Error', message: `El Territorio ${terrNum} aún no tiene ningún pin. Colócalo primero en la vista Global.` });
            return;
        }
        try {
            await withTimeout(onSaveMarker({
                terrNum,
                status: base.status,
                ...(base.assigneeName ? { assigneeName: base.assigneeName } : {}),
                zona: selectedZone,
                x: clampPercent(base.x + 1.5),
                y: clampPercent(base.y + 1.5),
                zoneX: x,
                zoneY: y,
                lastUpdated: null,
            }));
            onShowModal({
                type: 'success',
                title: 'Pin agregado',
                message: `Se agregó un pin al Territorio ${terrNum}. En la vista Global aparece junto a los demás pines de ese territorio; desbloquéalo (🔓) y arrástralo a su manzana.`,
            });
        } catch (error) {
            showWriteError(error, 'No se pudo agregar el pin.');
        }
    };

    const resetView = () => setView(clampView({ k: minK, tx: 0, ty: 0 }));
    const zoomByButton = (factor: number) => setView(v => zoomAt(v, v.k * factor, vw / 2, vh / 2));

    const onViewportPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const rect = viewportRef.current!.getBoundingClientRect();
        if (pointersRef.current.size === 1) {
            panMovedRef.current = false;
            gestureRef.current = { mode: 'pan', startX: e.clientX, startY: e.clientY, startTx: view.tx, startTy: view.ty, startK: view.k };
        } else if (pointersRef.current.size === 2) {
            panMovedRef.current = true;
            const [a, b] = Array.from(pointersRef.current.values());
            gestureRef.current = {
                mode: 'pinch',
                startDist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
                startK: view.k,
                startCx: (a.x + b.x) / 2 - rect.left,
                startCy: (a.y + b.y) / 2 - rect.top,
                startTx: view.tx,
                startTy: view.ty,
            };
        }
    };

    const onViewportPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!pointersRef.current.has(e.pointerId)) return;
        pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const g = gestureRef.current;
        if (!g) return;
        const rect = viewportRef.current!.getBoundingClientRect();
        if (g.mode === 'pan' && pointersRef.current.size === 1) {
            const dx = e.clientX - g.startX;
            const dy = e.clientY - g.startY;
            if (!panMovedRef.current) {
                if (Math.hypot(dx, dy) < PAN_THRESHOLD) return;
                panMovedRef.current = true;
                try { viewportRef.current!.setPointerCapture(e.pointerId); } catch { /* noop */ }
            }
            setView(clampView({ k: g.startK, tx: g.startTx + dx, ty: g.startTy + dy }));
        } else if (g.mode === 'pinch' && pointersRef.current.size === 2) {
            const [a, b] = Array.from(pointersRef.current.values());
            const dist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
            const mx = (a.x + b.x) / 2 - rect.left;
            const my = (a.y + b.y) / 2 - rect.top;
            const k = Math.min(MAX_ZOOM, Math.max(minK, g.startK * (dist / g.startDist)));
            // Punto del mapa que estaba bajo el centro del pellizco al empezar: debe seguir bajo los dedos.
            const cx = (g.startCx - g.startTx) / g.startK;
            const cy = (g.startCy - g.startTy) / g.startK;
            setView(clampView({ k, tx: mx - cx * k, ty: my - cy * k }));
        }
    };

    const onViewportPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!pointersRef.current.delete(e.pointerId)) return;
        const remaining = Array.from(pointersRef.current.values());
        if (remaining.length === 1) {
            // Se levantó un dedo del pellizco: el otro sigue moviendo el mapa sin saltos.
            gestureRef.current = { mode: 'pan', startX: remaining[0].x, startY: remaining[0].y, startTx: view.tx, startTy: view.ty, startK: view.k };
        } else if (remaining.length === 0) {
            gestureRef.current = null;
        }
    };

    const handleMarkerPointerDown = (e: React.PointerEvent<HTMLDivElement>, marker: TerritoryMarker) => {
        if (!canManage) return;
        dragMovedRef.current = false;
        // While pins are locked, don't start a drag at all. The event keeps
        // bubbling to the map so it can still be panned/pinched even when the
        // finger lands on a pin; a plain tap is resolved in pointerUp below.
        if (pinsLocked) return;
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        setDraggingMarkerId(marker.id);
        setDragPosition(
            selectedZone === null
                ? { x: marker.x, y: marker.y }
                : { x: marker.zoneX as number, y: marker.zoneY as number }
        );
    };

    const handleMarkerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (pinsLocked || !draggingMarkerId || !contentRef.current) return;
        dragMovedRef.current = true;
        setDragPosition(getRelativePosition(e.clientX, e.clientY));
    };

    const handleMarkerPointerUp = async (e: React.PointerEvent<HTMLDivElement>, marker: TerritoryMarker) => {
        if (!canManage) return;

        if (pinsLocked) {
            // Toque simple sobre un pin fijo: abre el formulario, salvo que el gesto
            // haya sido un arrastre del mapa o un pellizco.
            if (!panMovedRef.current) handleSelectMarker(marker);
            return;
        }

        e.stopPropagation();

        const wasDragged = dragMovedRef.current;
        const finalPosition = dragPosition;
        setDraggingMarkerId(null);
        setDragPosition(null);

        if (wasDragged && finalPosition && onSaveMarker) {
            try {
                // En la vista global se mueve x/y; en el mapa de una zona, zoneX/zoneY.
                await onSaveMarker(
                    selectedZone === null
                        ? { ...marker, x: finalPosition.x, y: finalPosition.y }
                        : { ...marker, zoneX: finalPosition.x, zoneY: finalPosition.y }
                );
            } catch (error) {
                onShowModal({ type: 'error', title: 'Error', message: 'No se pudo mover el marcador.' });
            }
        } else if (!wasDragged) {
            // A plain click/tap with no movement: open the edit modal as before.
            handleSelectMarker(marker);
        }
    };

    const handleSelectMarker = (marker: TerritoryMarker) => {
        if (!canManage) return;
        setEditingMarker(marker);

        // Show every record for this territory regardless of service year, so
        // a record misfiled under the wrong year (e.g. a new "vuelta 1" that
        // was accidentally saved as "vuelta 13" of the old year) is still
        // visible and selectable here instead of silently hidden.
        const allTerrRecords = records
            .filter(r => r.terrNum === marker.terrNum)
            .sort((a, b) => (b.serviceYear - a.serviceYear) || (b.vueltaNum - a.vueltaNum));
        setTerritoryRecordOptions(allTerrRecords);

        const currentYearRecord = allTerrRecords.find(r => r.serviceYear === currentServiceYear);
        const latestRecord = currentYearRecord || allTerrRecords[0];

        if (latestRecord) {
            setEditingRecord(latestRecord);
            setOriginalEditingRecord(latestRecord);
        } else {
            const blankRecord = { 
                terrNum: marker.terrNum, 
                vueltaNum: 1, 
                serviceYear: currentServiceYear,
                asignadoA: '',
                assignedDate: '',
                completedDate: ''
            };
            setEditingRecord(blankRecord);
            setOriginalEditingRecord(null);
        }
    };

    const handlePickRecordOption = (record: TerritoryRecord) => {
        setEditingRecord(record);
        setOriginalEditingRecord(record);
    };

    const handleAddBlankRecordForCurrentYear = () => {
        setEditingRecord({
            terrNum: editingMarker?.terrNum,
            vueltaNum: 1,
            serviceYear: currentServiceYear,
            asignadoA: '',
            assignedDate: '',
            completedDate: ''
        });
        setOriginalEditingRecord(null);
    };

    const closeMarkerModal = () => {
        setEditingMarker(null);
        setEditingRecord(null);
        setOriginalEditingRecord(null);
        setTerritoryRecordOptions([]);
    };

    const showWriteError = (error: unknown, fallbackMessage: string) => {
        if (isWriteTimeout(error)) {
            onShowModal({
                type: 'error',
                title: 'Sin confirmación del servidor',
                message: 'El cambio quedó guardado en este dispositivo pero el servidor no lo confirmó (¿conexión lenta?). Mantén la página abierta unos segundos o recárgala y verifica que el cambio se vea reflejado.',
            });
        } else {
            onShowModal({ type: 'error', title: 'Error', message: fallbackMessage });
        }
    };

    const handleDeleteRecordOnly = async () => {
        if (!originalEditingRecord?.id || !onDeleteRecord) return;
        if (!window.confirm(`¿Eliminar solo el registro (Vuelta ${originalEditingRecord.vueltaNum}, Año ${originalEditingRecord.serviceYear}) de este territorio?\n\nEl marcador en el mapa NO se eliminará. Esta acción no se puede deshacer.`)) return;

        setIsDeleting(true);
        try {
            await withTimeout(onDeleteRecord(originalEditingRecord));
            const remaining = territoryRecordOptions.filter(r => r.id !== originalEditingRecord.id);
            setTerritoryRecordOptions(remaining);
            const next = remaining.find(r => r.serviceYear === currentServiceYear) || remaining[0];
            if (next) {
                setEditingRecord(next);
                setOriginalEditingRecord(next);
            } else {
                handleAddBlankRecordForCurrentYear();
            }
            onShowModal({ type: 'success', title: 'Eliminado', message: 'Registro eliminado con éxito.' });
        } catch (error) {
            showWriteError(error, 'No se pudo eliminar el registro.');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleDeleteMarker = async () => {
        if (!onDeleteMarker || !editingMarker?.id) return;

        const markerId = editingMarker.id;
        const terrNum = editingMarker.terrNum;
        // Los registros de asignación (S-13) se enlazan por NÚMERO de territorio, no por pin.
        // Si el territorio tiene más pines (otras manzanas), el registro es compartido y NO debe
        // borrarse junto con este pin, porque los demás pines lo siguen usando.
        const otherPins = markers.filter(m => m.terrNum === terrNum && m.id !== markerId).length;
        const recordToDelete = otherPins === 0 && originalEditingRecord?.id ? originalEditingRecord : null;

        const confirmMsg = otherPins > 0
            ? `¿Eliminar este pin del Territorio ${terrNum}?\n\nEse territorio tiene ${otherPins} ${otherPins === 1 ? 'pin más' : 'pines más'} (otras manzanas). Su registro de asignación (S-13) NO se borrará y los demás pines no cambian. Esta acción no se puede deshacer.`
            : recordToDelete
                ? `¿Eliminar el marcador del Territorio ${terrNum}?\n\nEs el único pin de ese territorio, así que también se eliminará su registro de asignación (S-13) del año de servicio actual. Esta acción no se puede deshacer.`
                : `¿Eliminar el marcador del Territorio ${terrNum}? Esta acción no se puede deshacer.`;

        if (!window.confirm(confirmMsg)) return;

        setIsDeleting(true);
        try {
            // Ambas escrituras se lanzan a la vez y se espera una sola confirmación con tiempo límite.
            const ops: Promise<void>[] = [onDeleteMarker(markerId)];
            if (recordToDelete && onDeleteRecord) ops.push(onDeleteRecord(recordToDelete));
            await withTimeout(Promise.all(ops));

            closeMarkerModal();
            onShowModal({ type: 'success', title: 'Eliminado', message: 'Marcador eliminado con éxito.' });
        } catch (error) {
            if (isWriteTimeout(error)) closeMarkerModal();
            showWriteError(error, 'No se pudo eliminar el marcador.');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleSave = async () => {
        if (!onSaveMarker || !onSaveRecord || !editingMarker || !editingMarker.terrNum) return;

        setIsSaving(true);
        try {
            let finalStatus = editingMarker.status || 'available';
            if (editingRecord) {
                if (editingRecord.assignedDate && !editingRecord.completedDate) {
                    finalStatus = 'assigned';
                } else if (editingRecord.completedDate) {
                    finalStatus = 'completed';
                }
            }

            // Toda la secuencia corre como una sola operación con tiempo límite: si el servidor
            // tarda, la modal se libera pero las escrituras siguen su curso en segundo plano.
            await withTimeout((async () => {
                if (editingRecord && editingRecord.vueltaNum) {
                    // If we were editing an existing record and the vuelta number
                    // AND/OR the service year was changed, saving would create a NEW
                    // record for that combination (App.tsx matches by
                    // terrNum+vueltaNum+serviceYear, not by id) and leave the old one
                    // behind as an orphan. To "move"/correct the record properly,
                    // delete the old one first.
                    const keyChanged = originalEditingRecord?.id && (
                        originalEditingRecord.vueltaNum !== editingRecord.vueltaNum ||
                        originalEditingRecord.serviceYear !== editingRecord.serviceYear
                    );

                    if (keyChanged && onDeleteRecord) {
                        await onDeleteRecord(originalEditingRecord as Partial<TerritoryRecord>);
                    }

                    await onSaveRecord(editingRecord as Omit<TerritoryRecord, 'id'>);
                }

                await onSaveMarker({ ...(editingMarker as any), status: finalStatus });
            })());

            closeMarkerModal();
            onShowModal({ type: 'success', title: 'Éxito', message: 'Marcador y registro actualizados.' });
        } catch (error) {
            if (isWriteTimeout(error)) closeMarkerModal();
            showWriteError(error, 'No se pudo completar la operación.');
        } finally {
            setIsSaving(false);
        }
    };

    if (!globalMap) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                <span className="text-4xl mb-4">🗺️</span>
                <p className="text-gray-500 text-center max-w-md">No se ha subido un mapa global interactivo.</p>
            </div>
        );
    }

    // ───────── Datos de la vista actual ─────────
    const hasZonePos = (m: TerritoryMarker) => typeof m.zoneX === 'number' && typeof m.zoneY === 'number';
    const zoneMarkers = selectedZone === null ? [] : markers.filter(m => getMarkerZone(m) === selectedZone);
    const pins: { marker: TerritoryMarker; x: number; y: number }[] =
        selectedZone === null
            ? markers.map(m => ({ marker: m, x: m.x, y: m.y }))
            : zoneMarkers.filter(hasZonePos).map(m => ({ marker: m, x: m.zoneX as number, y: m.zoneY as number }));
    // Pines de la zona que aún no tienen posición en este mapa (uno por manzana, no por territorio).
    const unplacedMarkers = zoneMarkers
        .filter(m => !hasZonePos(m))
        .sort((a, b) => (a.terrNum - b.terrNum) || String(a.id).localeCompare(String(b.id)));
    const pinLabel = (m: TerritoryMarker) => {
        const sibs = markers.filter(k => k.terrNum === m.terrNum).sort((a, b) => String(a.id).localeCompare(String(b.id)));
        return sibs.length > 1 ? `Territorio ${m.terrNum} · pin ${sibs.findIndex(k => k.id === m.id) + 1} de ${sibs.length}` : `Territorio ${m.terrNum}`;
    };
    const zoneTerrNums = Array.from(new Set(zoneMarkers.map(m => m.terrNum))).sort((a, b) => a - b);
    // Territorios que pertenecen a la zona pero todavía no tienen pin en el mapa global.
    const missingPinTerrs =
        selectedZone === null
            ? []
            : Array.from({ length: TERRITORY_COUNT }, (_, i) => i + 1).filter(
                  n => DEFAULT_ZONE_BY_TERRITORY[n] === selectedZone && !markers.some(m => m.terrNum === n)
              );
    const zoneCount = (status: TerritoryMarker['status']) => zoneMarkers.filter(m => m.status === status).length;
    const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
    const pillClass = (active: boolean) =>
        `whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
            active ? 'bg-blue-600 text-white border-blue-600 shadow' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
        }`;
    const ctrlClass =
        'w-9 h-9 rounded-lg bg-white/95 shadow-md border border-slate-200 text-slate-700 text-lg font-black leading-none active:scale-95 flex items-center justify-center';
    const pinSize = isMobile ? (view.k >= NUMBERS_ZOOM ? PIN_MOBILE_ZOOMED : PIN_MOBILE) : PIN_DESKTOP;
    const showPinNumber = !isMobile || view.k >= NUMBERS_ZOOM;
    const pinHit = Math.max(pinSize + 8, 24); // área táctil un poco mayor que el pin visible

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-4 rounded-lg shadow-sm border gap-4">
                <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-800">
                        {selectedZone === null ? 'Mapa Territorial Interactivo' : `Mapa de la Zona ${selectedZone}`}
                    </h3>
                    <p className="text-sm text-gray-500">
                        {canManage
                            ? (pinsLocked
                                ? 'Haz clic en un pin para registrar el trabajo. Los pines están fijos: desbloquéalos para corregir su ubicación.'
                                : 'Modo edición de posición: arrastra un pin para moverlo, o haz clic en él para registrar el trabajo.')
                            : 'Vista rápida del estado de los territorios.'}
                        {' '}Pellizca o usa + / − para acercar y arrastra para moverte por el mapa.
                    </p>
                </div>
                <div className="flex flex-wrap gap-3 items-center">
                    {canManage && (
                        <button
                            onClick={() => setPinsLocked(prev => !prev)}
                            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-black rounded-xl shadow-md transition-all hover:scale-105 active:scale-95 ${
                                pinsLocked
                                    ? 'bg-slate-100 text-slate-600 border border-slate-200'
                                    : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'
                            }`}
                            title={pinsLocked ? 'Los pines están fijos. Haz clic para poder moverlos.' : 'Los pines se pueden mover. Haz clic para volver a fijarlos.'}
                        >
                            {pinsLocked ? '🔒 Pines Fijados' : '🔓 Editando Posición'}
                        </button>
                    )}
                    {canManage && onResetCompletedMarkers && (
                        <button
                            onClick={async () => {
                                const completedCount = markers.filter(m => m.status === 'completed').length;
                                if (completedCount === 0) {
                                    onShowModal({
                                        type: 'info',
                                        title: 'Información',
                                        message: 'No hay marcadores completados (verdes) para reiniciar.'
                                    });
                                    return;
                                }

                                if (window.confirm(`¿Estás seguro de que deseas iniciar una nueva vuelta?\n\nEsto cambiará automáticamente los ${completedCount} marcadores completados (verdes) a disponibles (grises), sin tocar los asignados o rezagados, y sin alterar los registros del S-13.`)) {
                                    try {
                                        await onResetCompletedMarkers();
                                        onShowModal({
                                            type: 'success',
                                            title: 'Éxito',
                                            message: `Se han reiniciado ${completedCount} marcadores a disponibles.`
                                        });
                                    } catch (e) {
                                        onShowModal({
                                            type: 'error',
                                            title: 'Error',
                                            message: 'Hubo un problema al reiniciar los marcadores.'
                                        });
                                    }
                                }
                            }}
                            className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-black rounded-xl shadow-md transition-all hover:scale-105 active:scale-95"
                        >
                            🔄 Iniciar Nueva Vuelta
                        </button>
                    )}
                    <div className="flex flex-wrap gap-3 text-[10px] font-bold bg-slate-50 p-2 rounded-lg border">
                        <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-gray-400"></span> Disp.</div>
                        <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500"></span> Asig.</div>
                        <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500"></span> Comp.</div>
                        <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span> Resagado</div>
                    </div>
                </div>
            </div>

            <div className="bg-white p-3 rounded-lg shadow-sm border">
                <div className="flex gap-2 overflow-x-auto pb-1">
                    <button onClick={() => selectZone(null)} className={pillClass(selectedZone === null)}>🌎 Global</button>
                    {ZONES.map(z => (
                        <button key={z} onClick={() => selectZone(z)} className={pillClass(selectedZone === z)}>Zona {z}</button>
                    ))}
                </div>
            </div>

            {selectedZone !== null && (
                <div className="bg-white p-3 rounded-lg shadow-sm border space-y-2 text-sm">
                    <div className="text-gray-700">
                        <span className="font-bold">Zona {selectedZone}:</span>{' '}
                        {zoneMarkers.length === 0
                            ? 'no tiene territorios asignados (se asignan en la pestaña Zonas).'
                            : `${plural(zoneTerrNums.length, 'territorio', 'territorios')} · ${plural(zoneMarkers.length, 'pin', 'pines')} · ${plural(zoneCount('completed'), 'completado', 'completados')} · ${plural(zoneCount('assigned'), 'asignado', 'asignados')} · ${plural(zoneCount('delayed'), 'rezagado', 'rezagados')}`}
                    </div>
                    {missingPinTerrs.length > 0 && (
                        <div className="text-xs text-amber-700">
                            Sin pin en el mapa global: {missingPinTerrs.join(', ')}. Colócalos primero en la vista Global.
                        </div>
                    )}
                    {canManage && placingMarkerId !== null ? (
                        <div className="flex items-center justify-between gap-3 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                            <span className="text-blue-800 font-semibold text-xs sm:text-sm">
                                Toca el mapa donde va el {pinLabel(markers.find(m => m.id === placingMarkerId) || ({ terrNum: 0, id: '' } as TerritoryMarker))}.
                            </span>
                            <button onClick={() => setPlacingMarkerId(null)} className="text-xs font-bold text-blue-700 underline whitespace-nowrap">Cancelar</button>
                        </div>
                    ) : canManage && addingTerrNum !== null ? (
                        <div className="flex items-center justify-between gap-3 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                            <span className="text-green-800 font-semibold text-xs sm:text-sm">Toca el mapa donde va el pin NUEVO del Territorio {addingTerrNum}.</span>
                            <button onClick={() => setAddingTerrNum(null)} className="text-xs font-bold text-green-700 underline whitespace-nowrap">Cancelar</button>
                        </div>
                    ) : (
                        <>
                            {unplacedMarkers.length > 0 && (
                                canManage ? (
                                    <div>
                                        <div className="text-xs text-gray-500 mb-1">Por ubicar en este mapa — elige un pin y toca el mapa:</div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {unplacedMarkers.map(m => (
                                                <button
                                                    key={m.id}
                                                    onClick={() => setPlacingMarkerId(m.id)}
                                                    className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-blue-100 text-slate-700 text-xs font-bold border border-slate-200"
                                                >
                                                    {pinLabel(m)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-xs text-gray-500">Aún sin ubicar en este mapa: {Array.from(new Set(unplacedMarkers.map(m => m.terrNum))).join(', ')}.</div>
                                )
                            )}
                            {canManage && zoneTerrNums.length > 0 && (
                                <div>
                                    <div className="text-xs text-gray-500 mb-1">➕ Agregar otro pin (otra manzana) a un territorio — elígelo y toca el mapa:</div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {zoneTerrNums.map(n => (
                                            <button
                                                key={n}
                                                onClick={() => setAddingTerrNum(n)}
                                                className="px-2.5 py-1 rounded-full bg-green-50 hover:bg-green-100 text-green-800 text-xs font-bold border border-green-200"
                                            >
                                                + Territorio {n}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {!activeMap ? (
                <div className="flex flex-col items-center justify-center p-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300 text-center">
                    <span className="text-4xl mb-4">🗺️</span>
                    <p className="text-gray-500 max-w-md">Aún no se ha subido el mapa de la Zona {selectedZone}.</p>
                    {canManage && (
                        <p className="text-xs text-gray-400 mt-2 max-w-md">
                            Súbelo en «Mapas de Territorio» → Zonas de Predicación → Zona {selectedZone}.
                        </p>
                    )}
                </div>
            ) : (
                <div className="relative overflow-hidden rounded-xl shadow-2xl border-4 border-white bg-slate-100">
                    <div
                        ref={viewportRef}
                        className={`relative overflow-hidden select-none ${
                            canManage && (selectedZone === null || placingMarkerId !== null || addingTerrNum !== null) ? 'cursor-crosshair' : 'cursor-grab'
                        }`}
                        style={{ height: vw > 0 ? vh : 240, touchAction: 'none' }}
                        onPointerDown={onViewportPointerDown}
                        onPointerMove={onViewportPointerMove}
                        onPointerUp={onViewportPointerEnd}
                        onPointerCancel={onViewportPointerEnd}
                        onClick={handleMapClick}
                    >
                        <div
                            ref={contentRef}
                            className="absolute left-0 top-0"
                            style={{
                                width: vw > 0 ? vw : '100%',
                                height: vw > 0 ? contentH : undefined,
                                transformOrigin: '0 0',
                                transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.k})`,
                                willChange: 'transform',
                            }}
                        >
                            <img
                                key={activeMap.mapUrl}
                                src={activeMap.mapUrl}
                                alt={selectedZone === null ? 'Mapa Global' : `Mapa Zona ${selectedZone}`}
                                className="w-full h-full block select-none"
                                draggable={false}
                                onLoad={(e) => {
                                    const img = e.currentTarget;
                                    if (img.naturalWidth > 0) {
                                        const r = img.naturalHeight / img.naturalWidth;
                                        const url = activeMap.mapUrl;
                                        setRatios(prev => (Math.abs((prev[url] ?? 0) - r) < 0.001 ? prev : { ...prev, [url]: r }));
                                    }
                                }}
                                onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_MAP_ERROR; }}
                            />
                        </div>

                        {/* Los pines se dibujan en una capa aparte, hermana de la capa con el
                            transform de zoom (no dentro de ella). Antes cada pin llevaba su propio
                            transform: scale(1/k) para "cancelar" el scale(k) del mapa y así no
                            crecer con el zoom; matemáticamente el resultado final era correcto,
                            pero a mucho zoom (k alto, 1/k muy chico) el navegador puede rasterizar
                            ese texto en una capa intermedia diminuta antes de recomponerlo, dejando
                            el número borroso o invisible. Calculando la posición en píxeles de
                            pantalla directamente (sin transform anidado) el pin y su número se
                            pintan siempre a tamaño real y nítido, a cualquier nivel de zoom. */}
                        <div className="absolute left-0 top-0 pointer-events-none" style={{ width: vw, height: vh }}>
                            {pins.map(({ marker, x, y }) => {
                                const isDraggingThis = draggingMarkerId === marker.id;
                                const displayX = isDraggingThis && dragPosition ? dragPosition.x : x;
                                const displayY = isDraggingThis && dragPosition ? dragPosition.y : y;
                                const screenX = view.tx + (displayX / 100) * vw * view.k;
                                const screenY = view.ty + (displayY / 100) * contentH * view.k;
                                return (
                                    <div
                                        key={marker.id}
                                        className={`absolute flex items-center justify-center pointer-events-auto ${isDraggingThis ? 'z-20' : 'z-10'} ${
                                            canManage ? (pinsLocked ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing') : ''
                                        }`}
                                        style={{
                                            left: screenX,
                                            top: screenY,
                                            width: pinHit,
                                            height: pinHit,
                                            marginLeft: -pinHit / 2,
                                            marginTop: -pinHit / 2,
                                        }}
                                        onPointerDown={(e) => handleMarkerPointerDown(e, marker)}
                                        onPointerMove={handleMarkerPointerMove}
                                        onPointerUp={(e) => handleMarkerPointerUp(e, marker)}
                                        onClick={(e) => e.stopPropagation()}
                                        title={`Territorio ${marker.terrNum}${canManage ? (pinsLocked ? ' (clic para registrar trabajo — posición fija)' : ' (clic para registrar trabajo, arrastra para mover)') : ''}`}
                                    >
                                        <div
                                            className={`rounded-full border-[0.5px] border-white/60 shadow-md flex items-center justify-center font-bold text-white ${!canManage ? 'opacity-90' : ''} ${
                                                isDraggingThis ? 'scale-150 shadow-xl' : 'transition-transform active:scale-[2.5]'
                                            } ${
                                                marker.status === 'completed' ? 'bg-green-500' :
                                                marker.status === 'assigned' ? 'bg-red-500' :
                                                marker.status === 'delayed' ? 'bg-orange-500 animate-pulse' :
                                                'bg-gray-500'
                                            }`}
                                            style={{ width: pinSize, height: pinSize, fontSize: pinSize >= 20 ? 9 : 8 }}
                                        >
                                            {showPinNumber && <span style={{ lineHeight: 1 }}>{marker.terrNum}</span>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="absolute top-2 right-2 flex flex-col gap-1 z-30">
                        <button type="button" aria-label="Acercar" title="Acercar" onClick={() => zoomByButton(1.5)} className={ctrlClass}>+</button>
                        <button type="button" aria-label="Alejar" title="Alejar" onClick={() => zoomByButton(1 / 1.5)} className={ctrlClass}>−</button>
                        <button type="button" aria-label="Ver mapa completo" title="Ver mapa completo" onClick={resetView} className={ctrlClass}>⤢</button>
                    </div>
                </div>
            )}

            {canManage && editingMarker && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-[100] p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 bg-slate-50 border-b">
                            <h3 className="text-xl font-black text-slate-800">Gestionar Marcador</h3>
                        </div>
                        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Territorio #</label>
                                    <input
                                        type="number"
                                        value={editingMarker.terrNum || ''}
                                        onChange={e => {
                                            const num = parseInt(e.target.value);
                                            setEditingMarker({ ...editingMarker, terrNum: num });
                                            const allTerrRecords = records
                                                .filter(r => r.terrNum === num)
                                                .sort((a, b) => (b.serviceYear - a.serviceYear) || (b.vueltaNum - a.vueltaNum));
                                            setTerritoryRecordOptions(allTerrRecords);
                                            const latest = allTerrRecords.find(r => r.serviceYear === currentServiceYear) || allTerrRecords[0];
                                            setEditingRecord(latest || { terrNum: num, vueltaNum: 1, serviceYear: currentServiceYear });
                                            setOriginalEditingRecord(latest || null);
                                        }}
                                        className="w-full p-3 bg-slate-100 rounded-xl border-none focus:ring-2 focus:ring-blue-500 font-bold transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Estado Marker</label>
                                    <select
                                        value={editingMarker.status}
                                        onChange={e => setEditingMarker({ ...editingMarker, status: e.target.value as any })}
                                        className="w-full p-3 bg-slate-100 rounded-xl border-none focus:ring-2 focus:ring-blue-500 font-bold transition-all"
                                    >
                                        <option value="available">Disponible</option>
                                        <option value="assigned">Asignado</option>
                                        <option value="completed">Completado</option>
                                        <option value="delayed">Resagado</option>
                                    </select>
                                </div>
                            </div>

                            {territoryRecordOptions.length > 1 && (
                                <div className="pt-2">
                                    <label className="block text-sm font-bold text-slate-700 mb-1">
                                        Se encontraron {territoryRecordOptions.length} registros para este territorio
                                    </label>
                                    <select
                                        value={originalEditingRecord?.id || 'new'}
                                        onChange={e => {
                                            const selected = territoryRecordOptions.find(r => r.id === e.target.value);
                                            if (selected) {
                                                handlePickRecordOption(selected);
                                            } else {
                                                handleAddBlankRecordForCurrentYear();
                                            }
                                        }}
                                        className="w-full p-3 bg-amber-50 rounded-xl border border-amber-200 focus:ring-2 focus:ring-blue-500 font-bold transition-all text-sm"
                                    >
                                        {territoryRecordOptions.map(r => (
                                            <option key={r.id} value={r.id}>
                                                Vuelta {r.vueltaNum} — Año {r.serviceYear}{r.asignadoA ? ` — ${r.asignadoA}` : ''}
                                            </option>
                                        ))}
                                        <option value="new">+ Nuevo registro (Año {currentServiceYear})</option>
                                    </select>
                                    <p className="text-xs text-slate-500 mt-1">Si ves un registro con un año incorrecto, selecciónalo aquí para corregirlo o eliminarlo.</p>
                                </div>
                            )}

                            {editingRecord && (
                                <div className="space-y-4 pt-4 border-t border-slate-100">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-1">Vuelta #</label>
                                            <input
                                                type="number"
                                                value={editingRecord.vueltaNum || 1}
                                                onChange={e => setEditingRecord({ ...editingRecord, vueltaNum: parseInt(e.target.value) })}
                                                className="w-full p-3 bg-slate-100 rounded-xl border-none focus:ring-2 focus:ring-blue-500 font-bold transition-all"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-1">Año de Servicio</label>
                                            <input
                                                type="number"
                                                value={editingRecord.serviceYear || currentServiceYear}
                                                onChange={e => setEditingRecord({ ...editingRecord, serviceYear: parseInt(e.target.value) })}
                                                className="w-full p-3 bg-slate-100 rounded-xl border-none focus:ring-2 focus:ring-blue-500 font-bold transition-all"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 gap-4">
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-1">Asignado a</label>
                                            <input
                                                type="text"
                                                placeholder="Nombre del hermano"
                                                value={editingRecord.asignadoA || ''}
                                                onChange={e => setEditingRecord({ ...editingRecord, asignadoA: e.target.value })}
                                                className="w-full p-3 bg-slate-100 rounded-xl border-none focus:ring-2 focus:ring-blue-500 font-bold transition-all text-sm"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-1">Fecha Asignación</label>
                                            <input
                                                type="date"
                                                value={editingRecord.assignedDate || ''}
                                                onChange={e => setEditingRecord({ ...editingRecord, assignedDate: e.target.value })}
                                                className="w-full p-3 bg-slate-100 rounded-xl border-none focus:ring-2 focus:ring-blue-500 font-bold transition-all text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-1">Fecha Completado</label>
                                            <input
                                                type="date"
                                                value={editingRecord.completedDate || ''}
                                                onChange={e => setEditingRecord({ ...editingRecord, completedDate: e.target.value })}
                                                className="w-full p-3 bg-slate-100 rounded-xl border-none focus:ring-2 focus:ring-blue-500 font-bold transition-all text-sm"
                                            />
                                        </div>
                                    </div>
                                    {originalEditingRecord?.id && onDeleteRecord && (
                                        <button
                                            onClick={handleDeleteRecordOnly}
                                            disabled={isSaving || isDeleting}
                                            className="w-full py-2 bg-amber-50 text-amber-700 font-bold rounded-xl border border-amber-200 hover:bg-amber-100 active:scale-95 transition-all disabled:opacity-60 text-sm"
                                        >
                                            {isDeleting ? 'Eliminando...' : '🗑️ Eliminar solo este registro (mantiene el pin)'}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="p-6 bg-slate-50 border-t flex flex-col gap-2">
                            <button onClick={handleSave} disabled={isSaving || isDeleting} className="w-full py-3 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-200 disabled:opacity-60">
                                {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                            </button>
                            {editingMarker.id && onDeleteMarker && (
                                <button onClick={handleDeleteMarker} disabled={isSaving || isDeleting} className="w-full py-3 bg-red-50 text-red-600 font-black rounded-xl border border-red-200 hover:bg-red-100 active:scale-95 transition-all disabled:opacity-60">
                                    {isDeleting ? 'Eliminando...' : '🗑️ Eliminar Marcador'}
                                </button>
                            )}
                            <button onClick={closeMarkerModal} className="w-full py-3 bg-white text-slate-600 font-bold rounded-xl border border-slate-200">{isSaving || isDeleting ? 'Cerrar' : 'Cancelar'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InteractiveMap;
