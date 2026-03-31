# Hero-Nuxt

Prototipo del hero 3D de Motix — Nuxt 4 + Three.js + Rapier3D.

## Stack

- **Framework**: Nuxt 4.4 (Vue 3, Vite)
- **3D**: Three.js 0.183, cámara ortográfica, materiales MeshPhysicalMaterial
- **Física**: Rapier3D (WASM, import dinámico para evitar SSR)
- **Assets**: GLB (isotipo), HDR (environment map)

## Estructura

```
app/
  app.vue                        — root layout, CSS global
  pages/index.vue                — decide HeroCanvas vs HeroFallback
  components/hero/
    HeroCanvas.client.vue        — canvas 3D (client-only)
    HeroFallback.vue             — fallback mobile/no-WebGL
  composables/
    useDeviceCapability.js       — detección de dispositivo y WebGL
    useHeroScene.js              — escena Three.js, renderer, loop
    usePhysicsSandbox.js         — mundo Rapier, materiales, interacción
    useThreeUtils.js             — coordenadas y geometría
```

## Comandos

```bash
npm install          # Instalar dependencias
npm run dev          # Dev server en http://localhost:3000
npm run build        # Build de producción
npm run preview      # Preview del build
npm run generate     # Generación estática
```

## Convenciones

- **Idioma UI**: Español
- **Idioma código**: Inglés (nombres de variables, funciones)
- **Comentarios**: Español, solo cuando explican POR QUÉ o comportamiento no obvio
- **Separadores de sección**: Usar `// ── Título ──` para estructurar archivos largos
- **Imports dinámicos**: Three.js y Rapier se importan dinámicamente dentro de funciones async para evitar SSR

## Notas técnicas

- Rapier WASM está excluido de `optimizeDeps` en Vite (ver nuxt.config.ts)
- El stencil buffer recorta los isotipos al área del sandbox div
- Los vectores scratch (`_scratchDir`, etc.) se reutilizan cada frame para evitar allocations
- El settling loop corre 90 iteraciones de física al init para que los objetos arranquen ya posicionados
- `HeroCanvas` es `.client.vue` — nunca se renderiza en SSR
- El resize del renderer tiene debounce de 150ms para evitar layout thrashing en mobile
