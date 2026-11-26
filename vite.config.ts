import { defineConfig } from 'vite';

// GitHub Pages serves the site from /TypingGlyph/, local dev stays at /.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/TypingGlyph/' : '/',
}));
