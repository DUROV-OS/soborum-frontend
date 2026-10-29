import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { InstallAppProvider } from './shared/mobile/InstallApp'
import { installClientLogHandlers } from './shared/lib/clientLog'
import './shared/styles/global.css'

installClientLogHandlers()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <InstallAppProvider><App /></InstallAppProvider>
  </React.StrictMode>,
)
