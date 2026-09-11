import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initNativeShell } from './lib/nativeShell'
import { initScrollPerf } from './lib/scrollPerf'
import { installStaleChunkReload } from './lib/staleChunk'
import { bootStallDayPreview } from './lib/stallDayPreview'

installStaleChunkReload()
initScrollPerf()
bootStallDayPreview()
void initNativeShell().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
