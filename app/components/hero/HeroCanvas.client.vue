<script setup>
const props = defineProps({
  objectCount: { type: Number, default: 15 },
})

const canvas = ref(null)
const sandboxDiv = ref(null)

const { dispose } = useHeroScene(
  canvas,
  sandboxDiv,
  toRef(props, 'objectCount')
)

onUnmounted(() => dispose())
</script>

<template>
  <canvas
    ref="canvas"
    class="hero-canvas"
    role="img"
    aria-label="Animación interactiva 3D"
  />
  <div
    id="physics-sandbox-div"
    ref="sandboxDiv"
    class="hero-sandbox"
    aria-hidden="true"
  />
</template>

<style scoped>
.hero-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.hero-sandbox {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
</style>