import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { initYandexMetrika } from './shared/lib/yandexMetrika'
import './shared/styles/global.css'

initYandexMetrika()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
