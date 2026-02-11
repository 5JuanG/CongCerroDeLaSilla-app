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
