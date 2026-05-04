import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './shared/styles/variables.scss'
import './shared/styles/reset.scss'
import App from './app/App.js'

const savedTheme = localStorage.getItem('theme') || 'system'
if (savedTheme !== 'system') {
  document.documentElement.setAttribute('data-theme', savedTheme)
}

// Disable the browser's automatic scroll-position restore on reload. The
// chat layout has its own internal scroll containers; when the browser
// tries to restore a body scrollTop captured before reload, it competes
// with our initial render and shows up as a visible page jerk.
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual'
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

