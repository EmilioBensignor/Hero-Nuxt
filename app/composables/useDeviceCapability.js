export function useDeviceCapability() {
  const canWebGL = ref(false)
  const isMobile = ref(false)
  const isTablet = ref(false)
  const isDesktop = ref(true)
  const objectCount = ref(15)

  function update() {
    const w = window.innerWidth
    isMobile.value = w < 768
    isTablet.value = w >= 768 && w < 1024
    isDesktop.value = w >= 1024

    if (isMobile.value) objectCount.value = 6
    else if (isTablet.value) objectCount.value = 10
    else objectCount.value = 15
  }

  function checkWebGL() {
    try {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
      canWebGL.value = !!gl
    } catch {
      canWebGL.value = false
    }
  }

  onMounted(() => {
    checkWebGL()
    update()
    window.addEventListener('resize', update)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', update)
  })

  return { canWebGL, isMobile, isTablet, isDesktop, objectCount }
}