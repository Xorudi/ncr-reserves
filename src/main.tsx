import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/shared/ErrorBoundary'
import './index.css'
// Resolve fast-UI gate before the first render so the body data attribute
// is in place when CSS selectors evaluate (sheet-backdrop blur, etc).
import './lib/uiMode'
import { registerSW } from './lib/registerSW'
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)

// Offline shell + safe update flow. Production only — in dev the SW would
// fight Vite's HMR. Best-effort: the app works fully without it.
if (import.meta.env.PROD) registerSW()
