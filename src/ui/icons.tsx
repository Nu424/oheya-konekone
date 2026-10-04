import type { SVGProps } from 'react'

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

const make = (d: React.ReactNode) => (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    {d}
  </svg>
)

export const Icon = {
  undo: make(<path d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />),
  redo: make(<path d="m15 14 5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />),
  cube: make(
    <>
      <path d="M12 3 3.5 7.5v9L12 21l8.5-4.5v-9L12 3Z" />
      <path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" />
    </>,
  ),
  top: make(
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M4 10h6v10M14 4v6h6" />
    </>,
  ),
  walk: make(
    <>
      <circle cx="13" cy="4.5" r="1.8" />
      <path d="m9 21 2.5-6.5L14 17v4M7 12l3-4 4 1 2.5 3.5M11.5 14.5 12.5 9" />
    </>,
  ),
  code: make(<path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14" />),
  menu: make(<path d="M4 7h16M4 12h16M4 17h16" />),
  file: make(
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
      <path d="M14 3v5h5" />
    </>,
  ),
  download: make(<path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 20h14" />),
  upload: make(<path d="M12 16V5m0 0L7.5 9.5M12 5l4.5 4.5M5 20h14" />),
  copy: make(
    <>
      <rect x="8" y="8" width="12" height="12" rx="2.5" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </>,
  ),
  paste: make(
    <>
      <rect x="5" y="4" width="14" height="17" rx="2.5" />
      <path d="M9 4V3h6v1M9 11h6M9 15h4" />
    </>,
  ),
  sparkle: make(<path d="M12 3c.6 4.2 2.8 6.4 7 7-4.2.6-6.4 2.8-7 7-.6-4.2-2.8-6.4-7-7 4.2-.6 6.4-2.8 7-7ZM19 15c.3 2 1 2.7 3 3-2 .3-2.7 1-3 3-.3-2-1-2.7-3-3 2-.3 2.7-1 3-3Z" />),
  home: make(<path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-8Z" />),
  door: make(
    <>
      <path d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M4 21h16" />
      <circle cx="14.5" cy="12.5" r="1" fill="currentColor" />
    </>,
  ),
  window: make(
    <>
      <rect x="4" y="4" width="16" height="16" rx="1.5" />
      <path d="M12 4v16M4 12h16" />
    </>,
  ),
  closet: make(
    <>
      <rect x="4" y="3" width="16" height="18" rx="1.5" />
      <path d="M12 3v18M10 11v2M14 11v2" />
    </>,
  ),
  trash: make(<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />),
  chevron: make(<path d="m6 9 6 6 6-6" />),
  ruler: make(
    <>
      <path d="m3 15 12-12 6 6L9 21l-6-6Z" />
      <path d="m7 11 2 2M10 8l2 2M13 5l2 2" />
    </>,
  ),
  palette: make(
    <>
      <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.5-.8 1.5-1.6 0-1.2-1-1.4-1-2.6 0-.9.7-1.6 1.6-1.6H16a5 5 0 0 0 5-5C21 6.6 17 3 12 3Z" />
      <circle cx="7.5" cy="11" r="1" fill="currentColor" />
      <circle cx="10" cy="7" r="1" fill="currentColor" />
      <circle cx="15" cy="7.5" r="1" fill="currentColor" />
    </>,
  ),
  floor: make(<path d="M3 17 9 7h12l-6 10H3ZM7 17l6-10M11 17l6-10M5 12h14" />),
  x: make(<path d="M6 6l12 12M18 6 6 18" />),
  check: make(<path d="m5 12 5 5 9-10" />),
  alert: make(
    <>
      <path d="M12 4 2.5 20h19L12 4Z" />
      <path d="M12 10v4M12 17v.5" />
    </>,
  ),
  rotate: make(<path d="M20 12a8 8 0 1 1-2.4-5.7M20 4v4.5h-4.5" />),
  lock: make(
    <>
      <rect x="5" y="11" width="14" height="10" rx="2.5" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>,
  ),
  search: make(
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </>,
  ),
  plus: make(<path d="M12 5v14M5 12h14" />),
  magnet: make(<path d="M6 3v8a6 6 0 0 0 12 0V3h-4v8a2 2 0 0 1-4 0V3H6ZM6 7h4M14 7h4" />),
  sofa: make(<path d="M5 11V8a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v3M3 13a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-4ZM6 18v2M18 18v2" />),
}
