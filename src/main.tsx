import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './shared/styles/variables.scss'
import './shared/styles/reset.scss'
import App from './app/App.js'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
  })
}
