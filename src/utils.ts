export const compressImage = (file: File, targetWidth: number = 1024): Promise<Blob> => {
    console.log(`[Compression] Starting for: ${file.name}, Size: ${file.size} bytes`);
    console.time('compressImage');

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        console.timeLog('compressImage', 'FileReader started');
        reader.readAsDataURL(file);

        reader.onload = event => {
            if (!event.target?.result) {
                console.timeEnd('compressImage');
                return reject(new Error('No se pudo leer el archivo de imagen.'));
            }
            console.timeLog('compressImage', 'FileReader loaded');

            const img = new Image();
            img.src = event.target.result as string;

            img.onload = () => {
                console.timeLog('compressImage', 'Image Object loaded', `Original Dim: ${img.width}x${img.height}`);

                const canvas = document.createElement('canvas');
                const scaleFactor = targetWidth / img.width;
                canvas.width = targetWidth;
                canvas.height = img.height * scaleFactor;
                console.log(`[Compression] Target Dim: ${canvas.width}x${canvas.height}`);

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    console.timeEnd('compressImage');
                    return reject(new Error('No se pudo obtener el contexto del canvas.'));
                }

                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                console.timeLog('compressImage', 'Canvas drawn');

                canvas.toBlob((blob) => {
                    if (blob) {
                        console.log(`[Compression] Finished. New Size: ${blob.size} bytes`);
                        console.timeEnd('compressImage');
                        resolve(blob);
                    } else {
                        console.timeEnd('compressImage');
                        reject(new Error('Error al comprimir la imagen (toBlob devolvió null).'));
                    }
                }, 'image/webp', 0.85);
            };
            img.onerror = error => {
                console.timeEnd('compressImage');
                reject(error);
            };
        };
        reader.onerror = error => {
            console.timeEnd('compressImage');
            reject(error);
        };
    });
};

export const downloadFile = async (url: string, fileName: string, onError?: (error: any) => void) => {
    try {
        // Al intentar descargar desde Firebase Storage, si no se ha configurado CORS, 
        // fetch() fallará. Intentamos el método robusto primero.
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
        console.error("Download failed, attempting fallback (open in new tab):", error);

        // Fallback: Si falla fetch (por CORS), abrimos en una nueva pestaña
        // Esto permite al usuario ver el archivo y guardarlo manualmente.
        window.open(url, '_blank');

        if (onError) onError(error);
    }
};

export const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

export const getPreviousMonthAndYear = () => {
    const now = new Date();
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const monthIndex = prevDate.getMonth();
    const year = prevDate.getFullYear();
    // Service year ends in August. September (index 8) starts the next service year.
    const serviceYear = monthIndex >= 8 ? year + 1 : year;
    return { monthIndex, year, serviceYear };
};

export const getCalculatedStatus = (pub: any, serviceReports: any[], MONTHS: string[]) => {
    try {
        if (!pub || !Array.isArray(serviceReports) || !Array.isArray(MONTHS)) {
            return 'activo';
        }

        const manualStatus = String(pub.Estatus || '').toLowerCase().trim();
        
        // Si el estatus manual indica que ya no es parte de la congregación activa, lo mantenemos.
        if (['se cambió de congregación', 'falleció', 'sacado de la congregación'].includes(manualStatus)) {
            return manualStatus;
        }

        const { monthIndex, year } = getPreviousMonthAndYear();
        const monthsToCheck: { month: string; year: number }[] = [];
        let mIdx = monthIndex;
        let yr = year;

        for (let i = 0; i < 6; i++) {
            const monthName = MONTHS[mIdx];
            if (monthName) {
                monthsToCheck.push({ month: monthName, year: yr });
            }
            mIdx--;
            if (mIdx < 0) {
                mIdx = 11;
                yr--;
            }
        }

        if (monthsToCheck.length === 0) return 'activo';

        const missedCount = monthsToCheck.filter(({ month, year: y }) => {
            return !serviceReports.some(r => 
                r && 
                r.idPublicador === pub.id && 
                r.anioCalendario === y && 
                r.mes === month && 
                r.participacion === true
            );
        }).length;

        if (missedCount >= 6) return 'inactivo';
        if (missedCount > 0) return 'irregular';
        return 'activo';
    } catch (error) {
        console.error("Error calculating status for publisher:", pub?.id, error);
        return 'activo'; // Default safe value
    }
};
