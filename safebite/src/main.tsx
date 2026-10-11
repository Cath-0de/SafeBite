// Entry point: the first file that runs. It loads the global styles and
// mounts the <App /> component into the #root element of index.html.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// StrictMode runs extra checks in development only (it renders components
// twice to surface bugs); it has no effect on the production build.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
