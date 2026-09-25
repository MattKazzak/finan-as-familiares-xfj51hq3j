import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider, useAuth } from '@/hooks/use-auth'
import { FamilyProvider } from '@/hooks/use-family'
import Layout from '@/components/Layout'
import Login from '@/pages/Login'
import ResetPassword from '@/pages/ResetPassword'
import Home from '@/pages/Home'
import Wallet from '@/pages/Wallet'
import Goals from '@/pages/Goals'
import Investments from '@/pages/Investments'
import Profile from '@/pages/Profile'
import NotFound from '@/pages/NotFound'
import { Loader2 } from 'lucide-react'

// Verifica síncronamente na URL se há indício de recuperação de senha (distinguindo estritamente de signup)
function checkIsRecoveryUrl(): boolean {
  if (typeof window === 'undefined') return false
  const hash = window.location.hash || ''
  const search = window.location.search || ''
  const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)
  const searchParams = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)

  // Se a URL contém type=signup ou type=email_change, NUNCA é recuperação de senha!
  const isSignup =
    hashParams.get('type') === 'signup' ||
    searchParams.get('type') === 'signup' ||
    hash.includes('type=signup') ||
    search.includes('type=signup')

  if (isSignup) return false

  const isRecovery =
    hashParams.get('type') === 'recovery' ||
    searchParams.get('type') === 'recovery' ||
    hash.includes('type=recovery') ||
    search.includes('type=recovery')

  return (
    isRecovery ||
    window.location.pathname === '/redefinir-senha' ||
    window.location.pathname === '/reset-password'
  )
}

// Guarda de rota autenticada
function ProtectedLayout() {
  const { user, loading, isPasswordRecovery } = useAuth()
  const isRecoveryUrl = checkIsRecoveryUrl()

  if (isPasswordRecovery || isRecoveryUrl) {
    return <Navigate to="/redefinir-senha" replace />
  }

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

// Guarda para rota de login
function LoginRoute() {
  const { user, loading, isPasswordRecovery } = useAuth()
  const isRecoveryUrl = checkIsRecoveryUrl()

  // Se o usuário veio pelo link de recuperação de senha ou a URL contém parâmetros de recuperação,
  // redireciona IMEDIATAMENTE para /redefinir-senha, antes de checar estado de login ou loading
  if (isPasswordRecovery || isRecoveryUrl) {
    return <Navigate to="/redefinir-senha" replace />
  }

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
          {/* Rotas públicas e dedicadas de redefinição de senha */}
          <Route path="/redefinir-senha" element={<ResetPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Rota pública de login */}
          <Route path="/" element={<LoginRoute />} />

          {/* Rotas protegidas envolvidas pelo Layout */}
          <Route element={<ProtectedLayout />}>
            <Route path="/inicio" element={<Home />} />
            <Route path="/carteira" element={<Wallet />} />
            <Route path="/orcamentos" element={<Wallet />} />
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
