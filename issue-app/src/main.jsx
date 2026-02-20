import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './validateEnv' // 환경 변수 검증 (개발 모드에서만 실행)
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
