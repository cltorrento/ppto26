import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import App from './App'
import { AuthProvider } from './auth/AuthContext'
import { MonthProvider } from './components/MonthContext'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 10_000 } },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MonthProvider>
          <BrowserRouter>
            <App />
            <Toaster position="top-center" richColors />
          </BrowserRouter>
        </MonthProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
