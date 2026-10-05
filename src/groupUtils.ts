// Un "grupo" cuyo nombre es en realidad un estatus (ej. "Se cambió de congregación",
// "Falleció") no es un grupo de servicio real y no debe contarse en informes ni listas de grupos.
export const isStatusLikeGroup = (group?: string | null): boolean => {
    const n = String(group ?? '').toLowerCase();
    if (!n) return false;
    return (n.includes('congregaci') && (n.includes('cambi') || n.includes('mud'))) || n.includes('falleci') || n.includes('sacado');
};
