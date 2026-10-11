import { create } from 'zustand'
import { temporal } from 'zundo'
import { clampOpening, uid } from '../model/geometry'
import { parseLayout } from '../model/io'
import type { Item, Layout, Opening, OpeningType, Room } from '../model/schema'
import { defaultLayout, TEMPLATES } from '../model/templates'
import { DoorOpening, WindowOpening, ClosetOpening } from '../model/schema'

const STORAGE_KEY = 'oheya-konekone:layout:v1'

export type ViewMode = 'orbit' | 'top' | 'walk'
/** How `select` combines with what is already selected. */
export type SelectMode = 'replace' | 'toggle' | 'add'

interface DocState {
  layout: Layout
}

interface Actions {
  setLayout(layout: Layout): void
  updateRoom(patch: Partial<Room>): void
  addOpening(type: OpeningType): string
  updateOpening(id: string, patch: Partial<Opening>): void
  removeOpening(id: string): void
  addItem(item: Omit<Item, 'id'> & { id?: string }): string
  updateItem(id: string, patch: Partial<Item>): void
  updateItemParams(id: string, patch: Record<string, unknown>): void
  /** Patch several items in one step (an item moving together with what stands on it). */
  patchItems(patches: ReadonlyMap<string, Partial<Item>>): void
  addItems(items: Item[]): void
  removeItem(id: string): void
  setMeta(patch: Partial<Layout['meta']>): void
}

function loadInitial(): Layout {
  // ?template=<id> opens a template (handy for sharing and testing).
  const tpl = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('template') : null
  const t = tpl ? TEMPLATES.find((x) => x.id === tpl) : undefined
  if (t) return t.layout()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const r = parseLayout(JSON.parse(raw))
      if (r.ok) return r.layout
    }
  } catch {
    // ignore broken storage
  }
  return defaultLayout()
}

let forceRecord = false

const OPENING_SCHEMAS = { door: DoorOpening, window: WindowOpening, closet: ClosetOpening }

export const useDoc = create<DocState & Actions>()(
  temporal(
    (set, get) => ({
      layout: loadInitial(),

      setLayout: (layout) => set({ layout }),

      updateRoom: (patch) =>
        set(({ layout }) => {
          const room = { ...layout.room, ...patch }
          room.openings = room.openings.map((o) => clampOpening(room, o))
          return { layout: { ...layout, room } }
        }),

      addOpening: (type) => {
        const { room } = get().layout
        const id = uid(type)
        // Pick the wall with the most free space.
        const walls = ['north', 'south', 'west', 'east'] as const
        const free = walls.map((w) => {
          const len = w === 'north' || w === 'south' ? room.width : room.depth
          const used = room.openings.filter((o) => o.wall === w).reduce((s, o) => s + o.width, 0)
          return { w, len, free: len - used }
        })
        free.sort((a, b) => b.free - a.free)
        const wall = free[0].w
        const base = OPENING_SCHEMAS[type].parse({ id, type, wall, offset: 0 }) as Opening
        const opening = clampOpening(room, { ...base, offset: Math.max(0, (free[0].len - base.width) / 2) })
        set(({ layout }) => ({ layout: { ...layout, room: { ...layout.room, openings: [...layout.room.openings, opening] } } }))
        return id
      },

      updateOpening: (id, patch) =>
        set(({ layout }) => ({
          layout: {
            ...layout,
            room: {
              ...layout.room,
              openings: layout.room.openings.map((o) =>
                o.id === id ? clampOpening(layout.room, { ...o, ...patch } as Opening) : o,
              ),
            },
          },
        })),

      removeOpening: (id) =>
        set(({ layout }) => ({
          layout: { ...layout, room: { ...layout.room, openings: layout.room.openings.filter((o) => o.id !== id) } },
        })),

      addItem: (item) => {
        const id = item.id ?? uid(item.type)
        set(({ layout }) => ({ layout: { ...layout, items: [...layout.items, { ...item, id }] } }))
        return id
      },

      updateItem: (id, patch) =>
        set(({ layout }) => ({
          layout: { ...layout, items: layout.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) },
        })),

      updateItemParams: (id, patch) =>
        set(({ layout }) => ({
          layout: {
            ...layout,
            items: layout.items.map((i) => (i.id === id ? { ...i, params: { ...i.params, ...patch } } : i)),
          },
        })),

      patchItems: (patches) => {
        if (!patches.size) return
        set(({ layout }) => ({
          layout: { ...layout, items: layout.items.map((i) => (patches.has(i.id) ? { ...i, ...patches.get(i.id) } : i)) },
        }))
      },

      addItems: (items) => set(({ layout }) => ({ layout: { ...layout, items: [...layout.items, ...items] } })),

      removeItem: (id) =>
        set(({ layout }) => ({ layout: { ...layout, items: layout.items.filter((i) => i.id !== id) } })),

      setMeta: (patch) => set(({ layout }) => ({ layout: { ...layout, meta: { ...layout.meta, ...patch } } })),
    }),
    {
      limit: 200,
      partialize: (s) => ({ layout: s.layout }),
      equality: (a, b) => a.layout === b.layout,
      // Coalesce rapid changes (slider drags) into one undo step.
      handleSet: (handleSet) => {
        let timer: ReturnType<typeof setTimeout> | undefined
        let pending = false
        return (state) => {
          if (!pending || forceRecord) {
            forceRecord = false
            handleSet(state)
            pending = true
          }
          clearTimeout(timer)
          timer = setTimeout(() => (pending = false), 400)
        }
      },
    },
  ),
)

// Autosave (debounced).
let saveTimer: ReturnType<typeof setTimeout> | undefined
useDoc.subscribe((s, prev) => {
  if (s.layout === prev.layout) return
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s.layout))
    } catch {
      // storage full / disabled
    }
  }, 300)
})

/**
 * Gestures (dragging an item) update the layout continuously; record them as one undo step.
 */
let gestureSnapshot: Layout | null = null
export function beginGesture() {
  if (gestureSnapshot) return
  gestureSnapshot = useDoc.getState().layout
  useDoc.temporal.getState().pause()
}
export function endGesture() {
  if (!gestureSnapshot) return
  const t = useDoc.temporal.getState()
  const final = useDoc.getState().layout
  if (final !== gestureSnapshot) {
    useDoc.setState({ layout: gestureSnapshot })
    t.resume()
    forceRecord = true
    useDoc.setState({ layout: final })
  } else t.resume()
  gestureSnapshot = null
}

export const undo = () => useDoc.temporal.getState().undo()
export const redo = () => useDoc.temporal.getState().redo()

interface UiState {
  view: ViewMode
  /** Selected item ids in the order they were picked; the last one is the primary (docs/MULTISELECT.md). */
  selection: string[]
  /** Item currently being dragged (for guides / camera lock). */
  dragging: string | null
  /** Hold Alt to disable snapping; this toggles it persistently. */
  snap: boolean
  /** Time of day (hours) for lighting. */
  hour: number
  /** Circulation check overlay. */
  flow: boolean
  /** Red outlines around every overlapping item (the selected / dragged ones always show theirs). */
  overlaps: boolean
  /** Path-traced photo mode and its progress. */
  photo: boolean
  photoSamples: number
  panel: 'room' | 'catalog' | null
  jsonOpen: boolean
  helpOpen: boolean
  toast: { id: number; text: string; tone?: 'info' | 'error' } | null
  setView(v: ViewMode): void
  select(ids: string | string[] | null, mode?: SelectMode): void
  setDragging(id: string | null): void
  setSnap(v: boolean): void
  setHour(h: number): void
  setFlow(v: boolean): void
  setOverlaps(v: boolean): void
  setPhoto(v: boolean): void
  setPhotoSamples(n: number): void
  setPanel(p: UiState['panel']): void
  setJsonOpen(v: boolean): void
  setHelpOpen(v: boolean): void
  notify(text: string, tone?: 'info' | 'error'): void
}

/** Per-viewer display preferences (best effort: storage may be unavailable). */
function readPref(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(`oheya-konekone:pref:${key}`)
    return v === null ? fallback : v === '1'
  } catch {
    return fallback
  }
}
function writePref(key: string, value: boolean) {
  try {
    localStorage.setItem(`oheya-konekone:pref:${key}`, value ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export const useUi = create<UiState>()((set) => ({
  view: 'orbit',
  selection: [],
  dragging: null,
  snap: true,
  hour: 14,
  flow: false,
  overlaps: readPref('overlaps', true),
  photo: false,
  photoSamples: 0,
  // Start with the panel closed on phones so the room is visible.
  panel: typeof window !== 'undefined' && window.innerWidth < 760 ? null : 'room',
  jsonOpen: false,
  helpOpen: false,
  toast: null,
  setView: (view) => set({ view }),
  select: (ids, mode = 'replace') =>
    set((s) => {
      const list = ids === null ? [] : typeof ids === 'string' ? [ids] : ids
      if (mode === 'replace') return { selection: [...new Set(list)] }
      let next = s.selection
      for (const id of list) {
        // Toggling removes; adding (or re-picking) moves the id to the end, making it the primary.
        if (mode === 'toggle' && next.includes(id)) next = next.filter((x) => x !== id)
        else next = [...next.filter((x) => x !== id), id]
      }
      return { selection: next }
    }),
  setDragging: (dragging) => set({ dragging }),
  setSnap: (snap) => set({ snap }),
  setHour: (hour) => set({ hour }),
  setFlow: (flow) => set({ flow }),
  setOverlaps: (overlaps) => {
    writePref('overlaps', overlaps)
    set({ overlaps })
  },
  setPhoto: (photo) => set(photo ? { photo, selection: [], flow: false, photoSamples: 0 } : { photo }),
  setPhotoSamples: (photoSamples) => set({ photoSamples }),
  setPanel: (panel) => set({ panel }),
  setJsonOpen: (jsonOpen) => set({ jsonOpen }),
  setHelpOpen: (helpOpen) => set({ helpOpen }),
  notify: (text, tone = 'info') => set({ toast: { id: Date.now(), text, tone } }),
}))

/** The primary selected id (the last one picked), or null. */
export const primaryOf = (selection: readonly string[]) => selection[selection.length - 1] ?? null

// Drop selected ids that no longer exist (after undo, delete or loading another layout).
useDoc.subscribe((s, prev) => {
  if (s.layout.items === prev.layout.items) return
  const ui = useUi.getState()
  if (!ui.selection.length) return
  const alive = new Set(s.layout.items.map((i) => i.id))
  if (ui.selection.some((id) => !alive.has(id))) useUi.setState({ selection: ui.selection.filter((id) => alive.has(id)) })
})
