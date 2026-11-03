import { defineConfig } from 'vite';
import {fileURLToPath} from 'node:url';
// Relative assets work at /, /repository/ and under custom domains.
export default defineConfig({ base: './', esbuild: { jsx: 'automatic' },build:{rollupOptions:{input:{web:fileURLToPath(new URL('./index.html',import.meta.url)),kobo:fileURLToPath(new URL('./kobo/index.html',import.meta.url))}}} });
