import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

// Apply saved theme before render to avoid FOUC
(() => {
  try {
    const saved = localStorage.getItem('theme')
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    const useDark = saved ? saved === 'dark' : prefersDark
    document.documentElement.classList.toggle('dark', useDark)
  } catch {}
})()

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
