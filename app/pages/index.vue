<template>
  <main>
    <HeroCanvas v-if="canWebGL" :object-count="objectCount" :is-mobile="isMobile" />
    <HeroFallback v-else />
  </main>
</template>

<script setup>
const { canWebGL, isMobile, objectCount } = useDeviceCapability()
</script>

<style scoped>
main {
  width: 100%;
  height: 100%;
}
</style>
