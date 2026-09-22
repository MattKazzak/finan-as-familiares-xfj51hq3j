import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'

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
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPasswordRecovery, setIsPasswordRecovery] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const hash = window.location.hash || ''
    const search = window.location.search || ''
    // Detecção abrangente de fluxo de recuperação de senha:
    // 1. Hash com type=recovery ou access_token (links implícitos ou explícitos do Supabase)
    // 2. Search query com code= ou type=recovery
    // 3. Rota direta /redefinir-senha
    return (
      hash.includes('type=recovery') ||
      hash.includes('access_token') ||
      search.includes('code=') ||
      search.includes('type=recovery') ||
      window.location.pathname === '/redefinir-senha'
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
      }

      setSession(newSession)
      setUser(newSession?.user ?? null)
      setLoading(false)
    })

    // 2. Se a URL veio com code PKCE (?code=...), troca o code por sessão caso ainda não trocado
    const searchParams = new URLSearchParams(window.location.search)
    const code = searchParams.get('code')
    const hash = window.location.hash || ''

    if (code) {
      supabase.auth
        .exchangeCodeForSession(code)
        .then(({ data, error }) => {
          if (!error && data?.session) {
            setSession(data.session)
            setUser(data.session.user)
            setIsPasswordRecovery(true)
          }
          setLoading(false)
        })
        .catch(() => {
          setLoading(false)
        })
    } else {
      // Checa se o hash contém type=recovery ou access_token
      if (hash.includes('type=recovery') || hash.includes('access_token')) {
        setIsPasswordRecovery(true)
      }

      supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
        setSession(initialSession)
        setUser(initialSession?.user ?? null)
        setLoading(false)
      })
    }

    return () => subscription.unsubscribe()
  }, [])

  const signUp = async (email: string, password: string, options?: SignUpOptions) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
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
