import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'
import { applyReferralCode } from '@/services/referral'
import { useSessionWatchdog } from '@/hooks/use-session-watchdog'

interface SignUpOptions {
  name?: string
}

interface AuthContextType {
  user: User | null
  session: Session | null
  signUp: (
    email: string,
    password: string,
    options?: SignUpOptions,
  ) => Promise<{ error: any; data?: any }>
  signIn: (email: string, password: string) => Promise<{ error: any }>
  resetPasswordForEmail: (email: string) => Promise<{ error: any }>
  updatePassword: (password: string) => Promise<{ error: any; data?: any }>
  resendConfirmationEmail: (email: string) => Promise<{ error: any }>
  signOut: () => Promise<{ error: any }>
  loading: boolean
  isPasswordRecovery: boolean
  clearPasswordRecovery: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // WATCHDOG DE SESSÃO (22/10): conta apagada no banco com app aberto →
  // logout limpo em segundos (refresh falho/primeiro plano/revalidação 5min),
  // não app meio-morto por até 1h. Padrão-ouro de sessão revogável.
  useSessionWatchdog()
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPasswordRecovery, setIsPasswordRecovery] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const hash = window.location.hash || ''
    const search = window.location.search || ''
    const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)
    const searchParams = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)

    const isRecoveryType =
      hashParams.get('type') === 'recovery' || searchParams.get('type') === 'recovery'
    const isSignupType =
      hashParams.get('type') === 'signup' ||
      searchParams.get('type') === 'signup' ||
      hashParams.get('type') === 'email_change' ||
      searchParams.get('type') === 'email_change'

    // Se é explicitamente signup/confirmação, NUNCA é recuperação
    if (isSignupType) return false
    if (isRecoveryType) return true

    // Rota direta de redefinição
    return (
      window.location.pathname === '/redefinir-senha' ||
      window.location.pathname === '/reset-password'
    )
  })

  useEffect(() => {
    // 1. Escuta eventos do Supabase Auth
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      // FORBIDDEN: no async/await inside this callback — sync only
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true)
      } else if (event === 'SIGNED_OUT') {
        setIsPasswordRecovery(false)
      } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        // REFERRAL (22/10): 1º login/signup com código de convite na sessão →
        // registra a indicação (1x — a RPC é idempotente e rejeita duplicado).
        try {
          const raw = localStorage.getItem('curiangoo_ref')
          if (raw && newSession?.user) {
            const parsed = JSON.parse(raw) as { code: string; t: number }
            // Janela de atribuição: 30 dias (padrão de mercado). Expirado = ignora.
            if (parsed?.code && Date.now() - parsed.t < 30 * 24 * 60 * 60 * 1000) {
              void applyReferralCode(parsed.code).then((ok) => {
                if (ok) localStorage.removeItem('curiangoo_ref')
              })
            } else {
              localStorage.removeItem('curiangoo_ref')
            }
          }
        } catch {
          /* localStorage indisponível */
        }
        // Se entrou ou atualizou usuário, verificar se foi por confirmação de cadastro
        const hash = window.location.hash || ''
        const search = window.location.search || ''
        const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)
        const searchParams = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
        const isSignup =
          hashParams.get('type') === 'signup' ||
          searchParams.get('type') === 'signup' ||
          hash.includes('type=signup') ||
          search.includes('type=signup')

        if (isSignup) {
          setIsPasswordRecovery(false)
        }
      }

      setSession(newSession)
      setUser(newSession?.user ?? null)
      setLoading(false)
    })

    // 2. Se a URL veio com code PKCE (?code=...), troca o code por sessão caso ainda não trocado
    const search = window.location.search || ''
    const searchParams = new URLSearchParams(search)
    const code = searchParams.get('code')
    const hash = window.location.hash || ''
    const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)

    const isExplicitRecovery =
      searchParams.get('type') === 'recovery' ||
      hashParams.get('type') === 'recovery' ||
      hash.includes('type=recovery') ||
      search.includes('type=recovery')

    const isExplicitSignup =
      searchParams.get('type') === 'signup' ||
      hashParams.get('type') === 'signup' ||
      hash.includes('type=signup') ||
      search.includes('type=signup')

    if (code) {
      supabase.auth
        .exchangeCodeForSession(code)
        .then(({ data, error }) => {
          // LINK EXPIRADO (22/10, padrão de mercado): o link de confirmação
          // velho falha → Supabase devolve erro (otp_expired/already_used).
          // Antes: catch silencioso, usuário caía no login sem entender NADA.
          // Agora: sinal claro na tela de login com botão de reenvio.
          if (error || !data?.session) {
            try {
              sessionStorage.setItem(
                'curiangoo_auth_error',
                JSON.stringify({
                  kind: /otp_expired|expired|already/i.test(error?.message || '')
                    ? 'link_expirado'
                    : 'link_invalido',
                  t: Date.now(),
                }),
              )
            } catch {
              /* storage restrito */
            }
          }
          if (!error && data?.session) {
            setSession(data.session)
            setUser(data.session.user)
            // Apenas marca recovery se foi explicitamente solicitado recovery e NÃO signup
            if (isExplicitRecovery && !isExplicitSignup) {
              setIsPasswordRecovery(true)
            } else {
              setIsPasswordRecovery(false)
            }
          }
          setLoading(false)
        })
        .catch(() => {
          setLoading(false)
        })
    } else {
      // Checa se o hash ou search contém type=recovery (e não signup)
      if (isExplicitRecovery && !isExplicitSignup) {
        setIsPasswordRecovery(true)
      } else if (isExplicitSignup) {
        setIsPasswordRecovery(false)
      }

      supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
        // SESSÃO FANTASMA (18/10): após wipe dos auth.users no banco, o JWT salvo no
        // localStorage do aparelho continua "válido" localmente e o app abria direto
        // numa conta que não existe mais. Fix: se há sessão local, validar o usuário
        // contra o servidor (getUser usa o token e consulta auth.users). 401/erro =
        // usuário não existe mais → deslogar e limpar, caindo no login.
        if (initialSession) {
          supabase.auth
            .getUser()
            .then(({ data: { user: serverUser }, error: userError }) => {
              if (userError || !serverUser) {
                // 23/10 (Matheus: "desloga sozinho"): distinguir CONTA MORTA de
                // FALHA DE REDE. Antes, qualquer erro deslogava — numa rede móvel
                // fraca, o app abria e caía no login sem motivo.
                const anyErr = userError as any
                const status = anyErr?.status ?? anyErr?.code
                const name = String(anyErr?.name || '')
                const isAuthDead =
                  !serverUser &&
                  (!userError ||
                    status === 401 ||
                    status === 403 ||
                    name === 'AuthSessionMissingError')

                if (isAuthDead) {
                  // Token órfão: usuário foi apagado no banco
                  supabase.auth.signOut()
                  setSession(null)
                  setUser(null)
                } else {
                  // Erro incerto (rede/5xx): manter sessão local e deixar o
                  // watchdog revalidar depois. Não punir usuário offline.
                  setSession(initialSession)
                  setUser(initialSession?.user ?? null)
                }
              } else {
                setSession(initialSession)
                setUser(serverUser)
              }
              setLoading(false)
            })
            .catch(() => {
              // Falha de rede: manter sessão local (não punir usuário offline)
              setSession(initialSession)
              setUser(initialSession?.user ?? null)
              setLoading(false)
            })
        } else {
          setSession(null)
          setUser(null)
          setLoading(false)
        }
      })
    }

    return () => subscription.unsubscribe()
  }, [])

  const signUp = async (email: string, password: string, options?: SignUpOptions) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/inicio`,
        data: {
          name: options?.name?.trim() || '',
        },
      },
    })
    return { data, error }
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  const resetPasswordForEmail = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    })
    return { error }
  }

  const updatePassword = async (newPassword: string) => {
    const { data, error } = await supabase.auth.updateUser({ password: newPassword })
    if (!error) {
      setIsPasswordRecovery(false)
    }
    return { data, error }
  }

  const clearPasswordRecovery = () => {
    setIsPasswordRecovery(false)
  }

  const resendConfirmationEmail = async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/inicio`,
      },
    })
    return { error }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    return { error }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        signUp,
        signIn,
        resetPasswordForEmail,
        updatePassword,
        resendConfirmationEmail,
        signOut,
        loading,
        isPasswordRecovery,
        clearPasswordRecovery,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
