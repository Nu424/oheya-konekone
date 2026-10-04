import { create } from 'zustand'
import { temporal } from 'zundo'
import { clampOpening, uid } from '../model/geometry'
import { parseLayout } from '../model/io'
import type { Item, Layout, Opening, OpeningType, Room } from '../model/schema'
import { defaultLayout } from '../model/templates'
import { DoorOpening, WindowOpening, ClosetOpening } from '../model/schema'

const STORAGE_KEY = 'oheya-konekone:layout:v1'

export type ViewMode = 'orbit' | 'top' | 'walk'
export type Selection = { kind: 'item'; id: string } | { kind: 'opening'; id: string } | null

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
  removeItem(id: string): void
  setMeta(patch: Partial<Layout['meta']>): void
}

function loadInitial(): Layout {
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
          if (!pending) {
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

export const undo = () => useDoc.temporal.getState().undo()
export const redo = () => useDoc.temporal.getState().redo()

interface UiState {
  view: ViewMode
  selection: Selection
  panel: 'room' | 'catalog' | null
  jsonOpen: boolean
  toast: { id: number; text: string; tone?: 'info' | 'error' } | null
  setView(v: ViewMode): void
  select(s: Selection): void
  setPanel(p: UiState['panel']): void
  setJsonOpen(v: boolean): void
  notify(text: string, tone?: 'info' | 'error'): void
}

export const useUi = create<UiState>()((set) => ({
  view: 'orbit',
  selection: null,
  panel: 'room',
  jsonOpen: false,
  toast: null,
  setView: (view) => set({ view }),
  select: (selection) => set({ selection }),
  setPanel: (panel) => set({ panel }),
  setJsonOpen: (jsonOpen) => set({ jsonOpen }),
  notify: (text, tone = 'info') => set({ toast: { id: Date.now(), text, tone } }),
}))
