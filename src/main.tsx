/* Main entry point for the application - renders the root React component */
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './main.css'

// @skip-protected: Do not remove. Required for React rendering.
import { registerAppServiceWorker } from './hooks/use-service-worker'

// Registra o Service Worker oficial do Curiangoo com atualização forçada e skipWaiting
registerAppServiceWorker()

createRoot(document.getElementById('root')!).render(<App />)
