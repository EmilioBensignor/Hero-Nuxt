import { updateCameraIntrinsics } from './useThreeUtils'
import { usePhysicsSandbox } from './usePhysicsSandbox'

const FRUSTUM_SIZE = 12

export function useHeroScene(canvasRef, sandboxDivRef, objectCount) {
  const isReady = ref(false)
  const isLoading = ref(true)

  let renderer = null
  let camera = null
  let scene = null
  let clock = null
  let sandbox = null

  async function init() {
    if (!canvasRef.value || !sandboxDivRef.value) return

    const THREE = await import('three')
    const { RGBELoader } = await import('three/addons/loaders/RGBELoader.js')

    renderer = new THREE.WebGLRenderer({
      antialias: true,
      canvas: canvasRef.value,
      stencil: true,
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(window.innerWidth, window.innerHeight)

    camera = new THREE.OrthographicCamera()
    camera.near = 0
    camera.far = 1000
    camera.position.z = 10
    updateCameraIntrinsics(camera, FRUSTUM_SIZE)

    scene = new THREE.Scene()
    scene.background = new THREE.Color(
      window.getComputedStyle(document.body).backgroundColor
    )

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0)
    dirLight.position.set(3, 5, 8)
    scene.add(dirLight)

    // HDR — reflejos en materiales
    new RGBELoader().load('/hdri/quarry_01_1k.hdr', (texture) => {
      texture.mapping = THREE.EquirectangularReflectionMapping
      scene.environment = texture
    })

    sandbox = await usePhysicsSandbox({
      camera,
      scene,
      sandboxDivId: sandboxDivRef.value.id,
      objectCount: objectCount.value,
    })

    clock = new THREE.Clock()
    renderer.setAnimationLoop(() => {
      const dt = clock.getDelta()
      sandbox.update(dt)
      renderer.render(scene, camera)
    })

    isLoading.value = false
    isReady.value = true
  }

  let resizeTimer = null

  function onResize() {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => {
      if (!renderer || !camera) return
      renderer.setSize(window.innerWidth, window.innerHeight)
      updateCameraIntrinsics(camera, FRUSTUM_SIZE)
      sandbox?.resize()
    }, 150)
  }

  onMounted(async () => {
    // Esperar un tick para que el DOM esté listo con dimensiones
    await nextTick()
    await init()
    window.addEventListener('resize', onResize)
  })

  function dispose() {
    clearTimeout(resizeTimer)
    window.removeEventListener('resize', onResize)

    if (renderer) {
      renderer.setAnimationLoop(null)
      renderer.dispose()
      renderer = null
    }

    sandbox?.dispose()
    sandbox = null
  }

  onUnmounted(() => {
    dispose()
  })

  return { isReady, isLoading, dispose }
}
