import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider, useAuth } from '@/hooks/use-auth'
import { FamilyProvider } from '@/hooks/use-family'
import { ImportSessionProvider } from '@/contexts/ImportSessionContext'
import { ActiveMonthProvider } from '@/contexts/ActiveMonthContext'
import Layout from '@/components/Layout'
import { PwaUpdateBanner } from '@/components/common/PwaUpdateBanner'
import Login from '@/pages/Login'
import ResetPassword from '@/pages/ResetPassword'
import { Coins, Loader2 } from 'lucide-react'

// PERFORMANCE: code splitting — cada página vira um chunk carregado sob demanda.
// Login fica no bundle principal (primeira tela).
const Home = lazy(() => import('@/pages/Home'))
const Wallet = lazy(() => import('@/pages/Wallet'))
const Goals = lazy(() => import('@/pages/Goals'))
const Investments = lazy(() => import('@/pages/Investments'))
const Profile = lazy(() => import('@/pages/Profile'))
const ImportReviewPage = lazy(() => import('@/pages/ImportReviewPage'))
const NotFound = lazy(() => import('@/pages/NotFound'))
const InviteAcceptPage = lazy(() =>
  import('@/pages/InviteAcceptPage').then((m) => ({ default: m.InviteAcceptPage })),
)
const CopilotPage = lazy(() => import('@/pages/Copilot').then((m) => ({ default: m.CopilotPage })))

const PageFallback = (
  <div className="min-h-screen bg-white flex items-center justify-center">
    <Loader2 className="w-6 h-6 animate-spin text-[#FCA311]" />
  </div>
)

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
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#14213D] to-[#1f3159] flex items-center justify-center text-[#FCA311] shadow-lg shadow-[#14213D]/20 mb-4 animate-bounce border border-[#14213D]/30">
          <Coins className="w-7 h-7 text-[#FCA311]" strokeWidth={1.5} />
        </div>
        <div className="flex items-center gap-2 text-[#14213D] text-sm font-semibold">
          <Loader2 className="w-4 h-4 animate-spin text-[#FCA311]" />
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
      <ImportSessionProvider>
        <ActiveMonthProvider>
          <Layout />
        </ActiveMonthProvider>
      </ImportSessionProvider>
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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#FCA311]" />
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
        <PwaUpdateBanner />
        <Toaster />
        <Sonner />
        <Routes>
          {/* Rotas públicas e dedicadas de redefinição de senha */}
          <Route path="/redefinir-senha" element={<ResetPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Rota pública de convite para família */}
          <Route
            path="/convite/:codigo"
            element={
              <FamilyProvider>
                <InviteAcceptPage />
              </FamilyProvider>
            }
          />

          {/* Rota pública de login */}
          <Route path="/" element={<LoginRoute />} />

          {/* Rotas protegidas envolvidas pelo Layout */}
          <Route element={<ProtectedLayout />}>
            <Route
              path="/inicio"
              element={
                <Suspense fallback={PageFallback}>
                  <Home />
                </Suspense>
              }
            />
            <Route
              path="/carteira"
              element={
                <Suspense fallback={PageFallback}>
                  <Wallet />
                </Suspense>
              }
            />
            <Route
              path="/orcamentos"
              element={
                <Suspense fallback={PageFallback}>
                  <Wallet />
                </Suspense>
              }
            />
            <Route
              path="/metas"
              element={
                <Suspense fallback={PageFallback}>
                  <Goals />
                </Suspense>
              }
            />
            <Route
              path="/investimentos"
              element={
                <Suspense fallback={PageFallback}>
                  <Investments />
                </Suspense>
              }
            />
            <Route
              path="/perfil"
              element={
                <Suspense fallback={PageFallback}>
                  <Profile />
                </Suspense>
              }
            />
            <Route
              path="/importar"
              element={
                <Suspense fallback={PageFallback}>
                  <ImportReviewPage />
                </Suspense>
              }
            />
            <Route
              path="/copilot"
              element={
                <Suspense fallback={PageFallback}>
                  <CopilotPage />
                </Suspense>
              }
            />
          </Route>

          {/* Rota de erro 404 */}
          <Route
            path="*"
            element={
              <Suspense fallback={PageFallback}>
                <NotFound />
              </Suspense>
            }
          />
        </Routes>
      </TooltipProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
