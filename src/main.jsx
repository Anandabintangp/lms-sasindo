import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './auth.jsx'
import { KuliahProvider } from './kuliah.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <AuthProvider>
        <KuliahProvider><App /></KuliahProvider>
      </AuthProvider>
    </HashRouter>
  </React.StrictMode>
)
