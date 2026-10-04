import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './ui/styles.css'

const params = new URLSearchParams(location.search)
const App = lazy(() => import('./App'))
const Gallery = lazy(() => import('./gallery/Gallery'))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<div className="boot">おへやを準備中…</div>}>{params.has('gallery') ? <Gallery /> : <App />}</Suspense>
  </StrictMode>,
)
