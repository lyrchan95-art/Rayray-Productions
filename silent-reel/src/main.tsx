import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

// Fonts load at runtime so the single-file bundler leaves the URL alone.
const fontLink = document.createElement('link')
fontLink.rel = 'stylesheet'
fontLink.href =
  'https://fonts.googleapis.com/css2?family=Anton&family=Fraunces:opsz,wght@9..144,600&family=JetBrains+Mono:wght@400;700&family=Schibsted+Grotesk:wght@400;600;700;800&display=swap'
document.head.appendChild(fontLink)
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
