import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider, useAuth } from '@/hooks/use-auth'
import { FamilyProvider } from '@/hooks/use-family'
import Layout from '@/components/Layout'
import Login from '@/pages/Login'
import Home from '@/pages/Home'
import Wallet from '@/pages/Wallet'
import Goals from '@/pages/Goals'
import Investments from '@/pages/Investments'
import Profile from '@/pages/Profile'
import NotFound from '@/pages/NotFound'
import { Loader2 } from 'lucide-react'

// Guarda de rota autenticada
function ProtectedLayout() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 flex items-center justify-center text-white text-2xl shadow-lg shadow-emerald-700/20 mb-4 animate-bounce">
          🌱
        </div>
        <div className="flex items-center gap-2 text-slate-600 text-sm font-medium">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
          <span>Carregando Finanças da Família...</span>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  return (
    <FamilyProvider>
      <Layout />
    </FamilyProvider>
  )
}

// Guarda para rota de login (se já estiver logado, redireciona para /inicio)
function LoginRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
      </div>
    )
  }

  if (user) {
    return <Navigate to="/inicio" replace />
  }

  return <Login />
}

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Routes>
          {/* Rota pública de login */}
          <Route path="/" element={<LoginRoute />} />

          {/* Rotas protegidas envolvidas pelo Layout */}
          <Route element={<ProtectedLayout />}>
            <Route path="/inicio" element={<Home />} />
            <Route path="/carteira" element={<Wallet />} />
            <Route path="/metas" element={<Goals />} />
            <Route path="/investimentos" element={<Investments />} />
            <Route path="/perfil" element={<Profile />} />
          </Route>

          {/* Rota de erro 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
