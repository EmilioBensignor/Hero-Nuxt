export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  app: {
    head: {
      htmlAttrs: { lang: 'es' },
      title: 'Motix',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Motix — Estudio de diseño interactivo' },
      ],
    },
  },

  vite: {
    optimizeDeps: {
      // Excluir Rapier WASM del bundle SSR
      exclude: ['@dimforge/rapier3d-compat'],
      include: [
        'three',
        'three/addons/loaders/RGBELoader.js',
        'three/addons/loaders/GLTFLoader.js',
      ],
    },
  },

  // Cache de assets estáticos (GLB, HDR)
  nitro: {
    routeRules: {
      '/models/**': { headers: { 'cache-control': 'public, max-age=31536000, immutable' } },
      '/hdri/**': { headers: { 'cache-control': 'public, max-age=31536000, immutable' } },
    },
  },
})