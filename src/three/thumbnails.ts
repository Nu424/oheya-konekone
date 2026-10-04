import { useEffect, useState } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { buildItemObject } from './ItemObject'
import { disposeObject } from './RoomMesh'

/**
 * Catalog thumbnails rendered from the real parametric models with a small offscreen renderer.
 * Rendering is queued and done one per animation frame so the UI stays responsive.
 */

const SIZE = 192
let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null

function setup() {
  if (renderer) return
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
  renderer.setPixelRatio(1)
  renderer.setSize(SIZE, SIZE)
  renderer.toneMapping = THREE.AgXToneMapping
  renderer.toneMappingExposure = 1.15
  renderer.shadowMap.enabled = false
  scene = new THREE.Scene()
  const pm = new THREE.PMREMGenerator(renderer)
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environmentIntensity = 0.7
  const key = new THREE.DirectionalLight('#fff4e6', 2.2)
  key.position.set(3, 5, 4)
  scene.add(key)
  scene.add(new THREE.HemisphereLight('#ffffff', '#c8b8a6', 0.6))
  camera = new THREE.PerspectiveCamera(28, 1, 0.01, 50)
}

const cache = new Map<string, string>()
const listeners = new Map<string, Set<(url: string) => void>>()
const queue: { key: string; type: string; params: Record<string, unknown> }[] = []
let pumping = false

function render(type: string, params: Record<string, unknown>): string {
  setup()
  const obj = buildItemObject(type, params)
  if (!obj || !renderer || !scene || !camera) return ''
  // Drop the contact shadow; thumbnails float on the card.
  obj.traverse((m) => {
    if (m.userData.contactShadow) m.visible = false
  })
  scene.add(obj)
  obj.updateMatrixWorld(true)
  const box = new THREE.Box3()
  obj.traverse((m) => {
    if (m instanceof THREE.Mesh && m.visible) box.expandByObject(m)
  })
  const sphere = box.getBoundingSphere(new THREE.Sphere())
  const dir = new THREE.Vector3(0.75, 0.62, 1).normalize()
  const dist = sphere.radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 0.92
  camera.position.copy(sphere.center).addScaledVector(dir, dist)
  camera.lookAt(sphere.center)
  camera.near = dist / 50
  camera.far = dist * 4
  camera.updateProjectionMatrix()
  renderer.setClearColor(0x000000, 0)
  renderer.render(scene, camera)
  const url = renderer.domElement.toDataURL('image/png')
  scene.remove(obj)
  disposeObject(obj)
  return url
}

function pump() {
  if (pumping) return
  pumping = true
  const step = () => {
    const job = queue.shift()
    if (!job) {
      pumping = false
      return
    }
    if (!cache.has(job.key)) {
      const url = render(job.type, job.params)
      cache.set(job.key, url)
      listeners.get(job.key)?.forEach((f) => f(url))
      listeners.delete(job.key)
    }
    requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

export function thumbnailKey(type: string, params: Record<string, unknown>) {
  return type + JSON.stringify(params)
}

/** Data URL of the item's thumbnail, rendered lazily. */
export function useThumbnail(type: string, params: Record<string, unknown> = {}) {
  const key = thumbnailKey(type, params)
  const [url, setUrl] = useState(() => cache.get(key))
  useEffect(() => {
    if (!type) return
    const hit = cache.get(key)
    if (hit) {
      setUrl(hit)
      return
    }
    setUrl(undefined)
    let set = listeners.get(key)
    if (!set) {
      set = new Set()
      listeners.set(key, set)
      queue.push({ key, type, params })
    }
    set.add(setUrl)
    pump()
    return () => {
      listeners.get(key)?.delete(setUrl)
    }
  }, [key, type, params])
  return url
}
