import { create } from 'zustand'

/** `?perf` shows the diagnostics panel (docs/PERFORMANCE.md, 6). */
export const PERF_PANEL = typeof location !== 'undefined' && new URLSearchParams(location.search).has('perf')

export type PerfMode = 'manual' | 'auto'

export interface PerfReport {
  text: string
  json: string
}

interface PerfState {
  status: 'idle' | 'recording'
  mode: PerfMode
  startedAt: number
  duration: number
  report: PerfReport | null
  start: (mode: PerfMode) => void
  finish: (report: PerfReport) => void
  clear: () => void
}

export const usePerf = create<PerfState>()((set) => ({
  status: 'idle',
  mode: 'manual',
  startedAt: 0,
  duration: 0,
  report: null,
  start: (mode) => set({ status: 'recording', mode, startedAt: performance.now(), duration: mode === 'auto' ? 6000 : 5000, report: null }),
  finish: (report) => set({ status: 'idle', report }),
  clear: () => set({ report: null }),
}))
