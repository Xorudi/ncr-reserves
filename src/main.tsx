import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/shared/ErrorBoundary'
import './index.css'
// Resolve fast-UI gate before the first render so the body data attribute
// is in place when CSS selectors evaluate (sheet-backdrop blur, etc).
import './lib/uiMode'
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
