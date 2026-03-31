import {
  createBevelledPlane,
  elementToWorldRect,
  pageToWorldCoords,
} from './useThreeUtils'

// Parámetros de física — valores del reverse engineering de Lusion
const DAMPING = 0.15
const ATTRACTION_FORCE = 5.0
const MOUSE_FORCE_COEF = 12
const STENCIL_REF = 1
const ISO_SCALE = 0.18

const ORBIT_SPEED = 0.06

const CLICK_IMPULSE = 16.0
const CLICK_TORQUE = 8.0

// Paletas de color — ciclan al hacer click
const PALETTES = [
  { black: 0x0a0a0a, white: 0xf0f0f0, accent: 0x3B5BFF },
  { black: 0x0a0a0a, white: 0xf0f0f0, accent: 0xE53935 },
  { black: 0x0a0a0a, white: 0xf0f0f0, accent: 0x7C4DFF },
  { black: 0x0a0a0a, white: 0xf0f0f0, accent: 0x00BFA5 },
]

export async function usePhysicsSandbox({ camera, scene, sandboxDivId, objectCount = 15, isMobile = false }) {
  const THREE = await import('three')
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js')
  const RAPIER = await import('@dimforge/rapier3d-compat')
  await RAPIER.init()

  const group = new THREE.Group()
  scene.add(group)

  const bodies = []
  let world = new RAPIER.World({ x: 0, y: 0, z: 0 })
  let mouseRigid = null
  let physicsMaskMesh = null
  const attractionPos = new THREE.Vector3(0, 0, 0)
  const lastMousePos = new THREE.Vector3()
  let time = 0
  let currentPalette = 0
  let colorTransition = 0
  let clickTarget = null

  // Vectores scratch — reutilizados cada frame, cero allocations
  const _scratchDir = new THREE.Vector3()
  const _scratchDelta = new THREE.Vector3()
  const _scratchRayDir = new THREE.Vector3()
  const _targetColor = new THREE.Color()

  // ── Materiales ──────────────────────────────────────────────────
  const stencilProps = {
    stencilWrite: true,
    stencilRef: STENCIL_REF,
    stencilFunc: THREE.EqualStencilFunc,
  }

  const MaterialClass = isMobile ? THREE.MeshStandardMaterial : THREE.MeshPhysicalMaterial

  const plasticBase = {
    roughness: 0.28,
    metalness: 0,
    envMapIntensity: isMobile ? 0.6 : 1.2,
    ...stencilProps,
    ...(isMobile ? {} : { clearcoat: 0.4, clearcoatRoughness: 0.15 }),
  }

  const matBlack = new MaterialClass({ color: 0x0a0a0a, ...plasticBase })
  const matWhite = new MaterialClass({ color: 0xf0f0f0, ...plasticBase })
  const matAccent = new MaterialClass({ color: PALETTES[0].accent, ...plasticBase })
  const materials = [matBlack, matWhite, matAccent]

  function pickMaterial(index) {
    const type = index % 3
    if (type === 0) return { mat: matBlack, type: 'black' }
    if (type === 1) return { mat: matWhite, type: 'white' }
    return { mat: matAccent, type: 'accent' }
  }

  // ── Stencil mask ────────────────────────────────────────────────
  function initViewMask() {
    const divWorldRect = elementToWorldRect(THREE, sandboxDivId, camera)

    const stencilMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.02, 0.02, 0.02),
      depthWrite: false,
      stencilWrite: true,
      stencilRef: STENCIL_REF,
      stencilFunc: THREE.AlwaysStencilFunc,
      stencilZPass: THREE.ReplaceStencilOp,
    })

    const width = Math.abs(divWorldRect.width)
    const height = Math.abs(divWorldRect.height)

    physicsMaskMesh = new THREE.Mesh(
      createBevelledPlane(THREE, width, height, 0.1),
      stencilMat
    )
    physicsMaskMesh.position.copy(divWorldRect.position)
    group.add(physicsMaskMesh)

    attractionPos.copy(divWorldRect.position)
  }

  // ── Crear un body de física ─────────────────────────────────────
  function createBody(position, baseGeo, index) {
    const { x, y, z } = position

    const rigidbody = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(x, y, z)
        .setLinearDamping(DAMPING)
        .setAngularDamping(0.15)
    )

    const { mat, type } = pickMaterial(index)
    let mesh

    if (baseGeo) {
      const geo = baseGeo.clone()
      geo.scale(ISO_SCALE, ISO_SCALE, ISO_SCALE)
      mesh = new THREE.Mesh(geo, mat)
      mesh.rotation.set(
        (Math.random() - 0.5) * Math.PI * 0.6,
        (Math.random() - 0.5) * Math.PI * 0.6,
        Math.random() * Math.PI * 2
      )

      // ConvexHull collider — forma real del isotipo
      const points = new Float32Array(geo.attributes.position.array)
      const colliderDesc = RAPIER.ColliderDesc.convexHull(points)
      if (colliderDesc) {
        colliderDesc.setMass(0.8)
        colliderDesc.setRestitution(0.3)
        colliderDesc.setFriction(0.3)
        world.createCollider(colliderDesc, rigidbody)
      } else {
        world.createCollider(
          RAPIER.ColliderDesc.ball(0.6).setMass(0.8).setRestitution(0.3),
          rigidbody
        )
      }
    } else {
      mesh = new THREE.Mesh(new THREE.SphereGeometry(0.6), mat)
      world.createCollider(
        RAPIER.ColliderDesc.ball(0.6).setMass(0.5).setRestitution(0.4),
        rigidbody
      )
    }

    mesh.position.set(x, y, z)
    mesh.renderOrder = 2

    return {
      rigidbody,
      mesh,
      materialType: type,
      orbitDir: Math.random() > 0.5 ? 1 : -1,
    }
  }

  // ── Inicialización ──────────────────────────────────────────────
  initViewMask()

  let baseGeo = null
  try {
    const gltf = await new Promise((res, rej) =>
      new GLTFLoader().load('/models/big-logo.glb', res, undefined, rej)
    )
    gltf.scene.traverse((c) => {
      if (c.isMesh && !baseGeo) baseGeo = c.geometry
    })
  } catch (e) {
    console.warn('GLB no cargó, usando esfera fallback:', e)
  }

  const _randomPos = new THREE.Vector3()
  for (let i = 0; i < objectCount; i++) {
    const pos = _randomPos.randomDirection().multiplyScalar(3)
    const body = createBody(pos, baseGeo, i)
    group.add(body.mesh)
    bodies.push(body)
  }

  // Settling — correr física para que se acomoden y ya estén en movimiento
  for (let i = 0; i < 90; i++) {
    world.step()
    for (const body of bodies) {
      _scratchDir.copy(attractionPos).sub(body.mesh.position)
      const dist = _scratchDir.length()
      if (dist > 0.01) {
        _scratchDir.divideScalar(dist).multiplyScalar(ATTRACTION_FORCE + dist * 1.5)
      }
      body.rigidbody.resetForces(true)
      body.rigidbody.addForce(_scratchDir)

      const dx = body.mesh.position.x - attractionPos.x
      const dy = body.mesh.position.y - attractionPos.y
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d > 0.1) {
        body.rigidbody.applyImpulse(
          { x: (-dy / d) * ORBIT_SPEED * body.orbitDir, y: (dx / d) * ORBIT_SPEED * body.orbitDir, z: 0 },
          true
        )
      }

      const t = body.rigidbody.translation()
      body.mesh.position.set(t.x, t.y, t.z)
      const r = body.rigidbody.rotation()
      body.mesh.quaternion.set(r.x, r.y, r.z, r.w)
    }
  }

  // Mouse ball — kinematic, sin visual
  mouseRigid = world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 0, 0)
  )
  world.createCollider(
    RAPIER.ColliderDesc.ball(0.6).setMass(0.6).setRestitution(0.15),
    mouseRigid
  )

  // ── Event handlers ──────────────────────────────────────────────
  function onPointerMove(event) {
    if (!world) return
    if (event.touches) event.preventDefault()

    const px = event.touches ? event.touches[0].pageX : event.pageX
    const py = event.touches ? event.touches[0].pageY : event.pageY

    const worldPos = pageToWorldCoords(THREE, px, py, camera)
    mouseRigid.setTranslation(worldPos)

    _scratchDelta.copy(worldPos).sub(lastMousePos)
    lastMousePos.copy(worldPos)

    _scratchRayDir.copy(worldPos).sub(camera.position)
    const ray = new RAPIER.Ray(camera.position, _scratchRayDir)
    const hit = world.castRay(ray, 50, true)

    if (hit) {
      const hitParent = hit.collider.parent()
      for (const body of bodies) {
        if (body.rigidbody === hitParent) {
          body.rigidbody.applyImpulse(
            {
              x: _scratchDelta.x * MOUSE_FORCE_COEF,
              y: _scratchDelta.y * MOUSE_FORCE_COEF,
              z: _scratchDelta.z * MOUSE_FORCE_COEF,
            },
            true
          )
          break
        }
      }
    }
  }

  function onClick() {
    if (!world) return

    currentPalette = (currentPalette + 1) % PALETTES.length
    colorTransition = 1.0

    for (const body of bodies) {
      const t = body.rigidbody.translation()
      const dx = t.x - attractionPos.x
      const dy = t.y - attractionPos.y
      const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.8
      body.rigidbody.applyImpulse(
        { x: Math.cos(angle) * CLICK_IMPULSE, y: Math.sin(angle) * CLICK_IMPULSE, z: 0 },
        true
      )
      body.rigidbody.applyTorqueImpulse(
        {
          x: (Math.random() - 0.5) * CLICK_TORQUE,
          y: (Math.random() - 0.5) * CLICK_TORQUE,
          z: (Math.random() - 0.5) * CLICK_TORQUE,
        },
        true
      )
    }
  }

  window.addEventListener('mousemove', onPointerMove, false)
  window.addEventListener('touchmove', onPointerMove, { passive: false })
  clickTarget = document.getElementById(sandboxDivId)
  if (clickTarget) {
    clickTarget.addEventListener('click', onClick, false)
  }

  // ── Update (llamado cada frame) ─────────────────────────────────
  function update(dt) {
    if (!world) return

    time += dt
    world.step()

    for (const body of bodies) {
      const { rigidbody, mesh, orbitDir } = body

      // Atracción al centro — base + proporcional a distancia
      _scratchDir.copy(attractionPos).sub(mesh.position)
      const dist = _scratchDir.length()
      if (dist > 0.01) {
        _scratchDir.divideScalar(dist).multiplyScalar(ATTRACTION_FORCE + dist * 1.5)
      }
      rigidbody.resetForces(true)
      rigidbody.addForce(_scratchDir)

      // Impulso tangencial — órbita circular lenta
      const dx = mesh.position.x - attractionPos.x
      const dy = mesh.position.y - attractionPos.y
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d > 0.1) {
        rigidbody.applyImpulse(
          { x: (-dy / d) * ORBIT_SPEED * orbitDir, y: (dx / d) * ORBIT_SPEED * orbitDir, z: 0 },
          true
        )
      }

      const t = rigidbody.translation()
      mesh.position.set(t.x, t.y, t.z)
      const r = rigidbody.rotation()
      mesh.quaternion.set(r.x, r.y, r.z, r.w)
    }

    if (colorTransition > 0) {
      colorTransition = Math.max(0, colorTransition - dt * 2.0)
      const palette = PALETTES[currentPalette]
      const t = 1.0 - colorTransition

      _targetColor.set(palette.black)
      matBlack.color.lerp(_targetColor, t)

      _targetColor.set(palette.white)
      matWhite.color.lerp(_targetColor, t)

      _targetColor.set(palette.accent)
      matAccent.color.lerp(_targetColor, t)
    }
  }

  // ── Resize ──────────────────────────────────────────────────────
  function resize() {
    if (physicsMaskMesh) {
      group.remove(physicsMaskMesh)
      physicsMaskMesh.geometry.dispose()
      physicsMaskMesh.material.dispose()
    }
    initViewMask()
  }

  // ── Cleanup ─────────────────────────────────────────────────────
  function dispose() {
    window.removeEventListener('mousemove', onPointerMove)
    window.removeEventListener('touchmove', onPointerMove)
    if (clickTarget) clickTarget.removeEventListener('click', onClick)

    if (world) {
      world.free()
      world = null
    }

    for (const body of bodies) {
      body.mesh.geometry.dispose()
      group.remove(body.mesh)
    }
    bodies.length = 0
    materials.forEach((m) => m.dispose())

    if (physicsMaskMesh) {
      physicsMaskMesh.geometry.dispose()
      physicsMaskMesh.material.dispose()
      group.remove(physicsMaskMesh)
    }

    scene.remove(group)
  }

  return { update, resize, dispose }
}
