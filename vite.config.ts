import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    // Для GitHub Pages: если репозиторий не в корне, укажите base path
    // Например: base: '/your-repo-name/'
    // Для корневого репозитория или других хостингов оставьте '/'
    const base = process.env.GITHUB_REPOSITORY 
      ? `/${process.env.GITHUB_REPOSITORY.split('/')[1]}/`
      : '/';
    
    return {
      base: base,
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), tailwindcss()],
      define: {
      },
    build: {
      chunkSizeWarningLimit: 800,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
            charts: ['recharts'],
            pdf: ['jspdf', 'html2canvas']
          }
        }
      }
    },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
