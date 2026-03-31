export function pageToWorldCoords(THREE, pageX, pageY, camera) {
  const ndcX = (pageX / window.innerWidth) * 2 - 1
  const ndcY = -(pageY / window.innerHeight) * 2 + 1

  const nearRelativeToCam = camera.near + camera.position.z
  const farRelativeToCam = -camera.far - camera.position.z
  const t = THREE.MathUtils.inverseLerp(farRelativeToCam, nearRelativeToCam, -camera.position.z)

  const screenPos = new THREE.Vector3(ndcX, ndcY, -t)
  screenPos.unproject(camera)
  return screenPos
}

export function pagePixelsToWorldUnit(camera, pagePixels) {
  const camViewHeight = camera.top - camera.bottom
  return pagePixels * (camViewHeight / window.innerHeight)
}

export function updateCameraIntrinsics(camera, frustum) {
  const aspect = window.innerWidth / window.innerHeight
  const horizontal = (frustum * aspect) / 2
  const vertical = frustum / 2
  camera.left = -horizontal
  camera.right = horizontal
  camera.top = vertical
  camera.bottom = -vertical
  camera.updateMatrixWorld()
  camera.updateProjectionMatrix()
}

export function createBevelledPlane(THREE, width, height, radius) {
  const x = width / 2
  const y = height / 2

  const shape = new THREE.Shape()
  shape.moveTo(-x + radius, y)
  shape.lineTo(x - radius, y)
  shape.quadraticCurveTo(x, y, x, y - radius)
  shape.lineTo(x, -y + radius)
  shape.quadraticCurveTo(x, -y, x - radius, -y)
  shape.lineTo(-x + radius, -y)
  shape.quadraticCurveTo(-x, -y, -x, -y + radius)
  shape.lineTo(-x, y - radius)
  shape.quadraticCurveTo(-x, y, -x + radius, y)

  const geometry = new THREE.ShapeGeometry(shape)
  geometry.computeBoundingBox()

  const bbox = geometry.boundingBox
  const rangeX = bbox.max.x - bbox.min.x
  const rangeY = bbox.max.y - bbox.min.y

  const uvs = new Float32Array(geometry.attributes.position.count * 2)
  for (let i = 0; i < geometry.attributes.position.count; i++) {
    uvs[i * 2] = (geometry.attributes.position.getX(i) - bbox.min.x) / rangeX
    uvs[i * 2 + 1] = (geometry.attributes.position.getY(i) - bbox.min.y) / rangeY
  }
  geometry.attributes.uv = new THREE.BufferAttribute(uvs, 2)

  return geometry
}

export function getElementPageCoords(elementId, anchor = { x: 0.5, y: 0.5 }) {
  const element = document.getElementById(elementId)
  if (!element) return { x: 0, y: 0, width: 0, height: 0 }
  const rect = element.getBoundingClientRect()
  return {
    x: rect.left + rect.width * anchor.x,
    y: rect.top + rect.height * anchor.y,
    width: rect.width,
    height: rect.height,
  }
}

export function elementToWorldRect(THREE, elementId, camera, anchor = { x: 0.5, y: 0.5 }) {
  const coords = getElementPageCoords(elementId, anchor)
  const position = pageToWorldCoords(THREE, coords.x, coords.y, camera)
  const width = pagePixelsToWorldUnit(camera, coords.width)
  const height = pagePixelsToWorldUnit(camera, coords.height)
  return { position, width, height }
}
