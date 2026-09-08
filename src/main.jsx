import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ROOT_ERROR_OPTIONS } from './lib/rootErrorDiagnostics.js'

export const ROOT_OPTIONS = ROOT_ERROR_OPTIONS

const root = document.getElementById('root')
const app = (
  <StrictMode>
    <App />
  </StrictMode>
)

if (root?.dataset.staticCalculator) {
  hydrateRoot(root, app, ROOT_OPTIONS)
} else {
  createRoot(root, ROOT_OPTIONS).render(app)
}
