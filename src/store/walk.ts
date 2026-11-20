import { create } from 'zustand'

/** Settings of the first-person walk mode, remembered per viewer (best effort). */
export interface WalkSettings {
  /** Bump into walls and furniture. */
  collide: boolean
  /** Body height in cm; the eyes are 10 cm below. */
  height: number
  /** Walking speed in m/s (Shift doubles it). */
  speed: number
  /** Mouse look sensitivity (1 = default). */
  sensitivity: number
}

const KEY = 'oheya-konekone:pref:walk'
const DEFAULTS: WalkSettings = { collide: true, height: 165, speed: 1.4, sensitivity: 1 }

function load(): WalkSettings {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<WalkSettings>) } : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

interface WalkState extends WalkSettings {
  /** The mouse is captured (pointer lock): moving it looks around. */
  locked: boolean
  /** Bumped to send the walker back to the entrance. */
  resetToken: number
  set(patch: Partial<WalkSettings>): void
  setLocked(v: boolean): void
  reset(): void
}

export const useWalk = create<WalkState>()((set, get) => ({
  ...load(),
  locked: false,
  resetToken: 0,
  set: (patch) => {
    set(patch)
    const { collide, height, speed, sensitivity } = get()
    try {
      localStorage.setItem(KEY, JSON.stringify({ collide, height, speed, sensitivity }))
    } catch {
      /* ignore */
    }
  },
  setLocked: (locked) => set({ locked }),
  reset: () => set((s) => ({ resetToken: s.resetToken + 1 })),
}))

/** Eye height in mm for a body height in cm. */
export const eyeHeight = (heightCm: number) => (heightCm - 10) * 10

/** When the pointer lock ended last (ms): the Esc that released it should not also leave the walk mode. */
export let lastUnlock = 0
export function markUnlock() {
  lastUnlock = performance.now()
}
