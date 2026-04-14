import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

function normalizeBasePath(input?: string) {
  if (!input || input === '/') {
    return '/';
  }

  const trimmed = input.trim();
  const leading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return leading.endsWith('/') ? leading : `${leading}/`;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const base = normalizeBasePath(env.VITE_BASE_PATH);

  return {
    base,
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'pwa-icon.svg', 'pwa-maskable.svg'],
        manifest: {
          name: 'FoodSnap',
          short_name: 'FoodSnap',
          description: 'Ultra-fast manual food logging for later AI macro and kcal analysis.',
          theme_color: '#0e0d13',
          background_color: '#0e0d13',
          display: 'standalone',
          orientation: 'portrait',
          scope: base,
          start_url: base,
          icons: [
            {
              src: 'pwa-icon.svg',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'any'
            },
            {
              src: 'pwa-maskable.svg',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'maskable'
            }
          ],
          shortcuts: [
            {
              name: 'Take food photo',
              short_name: 'Photo',
              description: 'Jump straight into the food photo flow.',
              url: `${base}?launch=photo`,
              icons: [
                {
                  src: 'pwa-icon.svg',
                  sizes: 'any',
                  type: 'image/svg+xml',
                  purpose: 'any'
                }
              ]
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,webmanifest,png,ico}']
        }
      })
    ]
  };
});
