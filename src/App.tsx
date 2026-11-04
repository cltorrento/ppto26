import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { Layout } from '@/components/Layout'
import { Spinner } from '@/components/ui'
import Landing from '@/pages/Landing'
import Login from '@/pages/Login'
import Panel from '@/pages/Panel'
import Gastos from '@/pages/Gastos'
import Presupuesto from '@/pages/Presupuesto'
import PlanAnual from '@/pages/PlanAnual'
import Ajustes from '@/pages/Ajustes'
import NotFound from '@/pages/NotFound'

function Protected() {
  const { loading, signedIn } = useAuth()
  const location = useLocation()
  if (loading) return <Spinner label="Comprobando tu sesión…" />
  if (!signedIn) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Layout />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route element={<Protected />}>
        <Route path="/panel" element={<Panel />} />
        <Route path="/gastos" element={<Gastos />} />
        <Route path="/presupuesto" element={<Presupuesto />} />
        <Route path="/plan-anual" element={<PlanAnual />} />
        <Route path="/ajustes" element={<Ajustes />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
