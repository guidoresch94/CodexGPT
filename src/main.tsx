import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import { inArtifact } from './lib/platform'
import { App } from './app/App'

// En el visor de Claude no hay service workers: solo se registra como web normal
if (!inArtifact() && 'serviceWorker' in navigator) registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
