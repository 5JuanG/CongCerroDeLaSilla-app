import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carga las variables de entorno del proceso
  // El tercer parámetro '' permite cargar todas las variables sin el prefijo VITE_.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    define: {
      // Expone la API_KEY al código del lado del cliente de forma segura.
      'process.env.API_KEY': JSON.stringify(env.API_KEY)
    },
    plugins: [react()],
    build: {
      rollupOptions: {
        external: [
          '@google/genai'
        ]
      }
    }
  };
});
