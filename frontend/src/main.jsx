import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { BookingProvider } from './context/BookingContext'
import { AuthProvider } from './context/AuthContext'
import { RoomsProvider } from './context/RoomsContext'
import './index.css'
import { DialogProvider } from './components/Dialog'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <RoomsProvider>
          <BookingProvider>
            <DialogProvider>
              <App />
            </DialogProvider>
          </BookingProvider>
        </RoomsProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
