import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const WEB_PORT = Number(process.env['WEB_PORT'] ?? 8080);

/** Веб-приложение — docs/03-АРХИТЕКТУРА.md § 2, § 4. */
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  // Контракт задаёт локальный адрес http://localhost:8080
  // (docs/12-ЭКСПЛУАТАЦИЯ.md § 0.3). WEB_PORT позволяет уступить порт, если
  // он занят посторонним приложением: умолчание остаётся контрактным.
  server: { host: '127.0.0.1', port: WEB_PORT, strictPort: true },
  preview: { host: '127.0.0.1', port: WEB_PORT, strictPort: true },
});
