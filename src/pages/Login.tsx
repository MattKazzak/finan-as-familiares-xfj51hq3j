import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/lib/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Loader2,
  Lock,
  Mail,
  User as UserIcon,
  ArrowLeft,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Send,
  Eye,
  EyeOff,
} from 'lucide-react'
import { InstallPwaBanner } from '@/components/common/InstallPwaBanner'
import { CuriangoLogo } from '@/components/brand/CuriangoLogo'

type AuthMode = 'login' | 'signup' | 'forgot_password'

export function isEmailNotConfirmedError(error: any): boolean {
  if (!error) return false
  const msg = (error.message || '').toLowerCase()
  const code = (error.code || error.error_code || error.status || '').toString().toLowerCase()
  return (
    msg.includes('email not confirmed') ||
    msg.includes('email_not_confirmed') ||
    code.includes('email_not_confirmed') ||
    msg.includes('e-mail não confirmado') ||
    msg.includes('não confirmado')
  )
}

export default function Login() {
  const { signIn, signUp, resetPasswordForEmail } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [mode, setMode] = useState<AuthMode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Estado para fluxo de e-mail não confirmado
  const [isEmailUnconfirmed, setIsEmailUnconfirmed] = useState(false)
  const [resendingEmail, setResendingEmail] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  // Gerenciamento do temporizador de cooldown de 60s
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  const handleResendConfirmation = async () => {
    const targetEmail = email.trim()
    if (!targetEmail) {
      toast({
        title: 'E-mail obrigatório',
        description: 'Por favor, informe seu e-mail no formulário para reenviar a confirmação.',
        variant: 'destructive',
      })
      return
    }

    if (resendCooldown > 0 || resendingEmail) return

    try {
      setResendingEmail(true)
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: targetEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/inicio`,
        },
      })

      if (error) {
        toast({
          title: 'Não foi possível reenviar',
          description:
            error.message ||
            'Ocorreu um erro ao reenviar o e-mail de ativação. Tente novamente mais tarde.',
          variant: 'destructive',
        })
        return
      }

      setResendCooldown(60)
      toast({
        title: 'E-mail enviado!',
        description: 'Novo link de ativação enviado! Confira sua caixa de entrada e o spam.',
      })
    } catch {
      toast({
        title: 'Erro de conexão',
        description: 'Falha ao conectar com o serviço de autenticação. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setResendingEmail(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)
    setIsEmailUnconfirmed(false)

    if (mode === 'forgot_password') {
      if (!email.trim()) {
        setErrorMessage('Por favor, informe seu e-mail para receber as instruções.')
        return
      }

      try {
        setLoading(true)
        const { error } = await resetPasswordForEmail(email.trim())
        if (error) {
          setErrorMessage(
            error.message || 'Não foi possível enviar o e-mail de recuperação. Tente novamente.',
          )
          return
        }
        setSuccessMessage(
          'Enviamos as instruções para redefinir sua senha no seu e-mail. Verifique sua caixa de entrada e spam.',
        )
      } catch {
        setErrorMessage('Erro de conexão ao solicitar recuperação de senha.')
      } finally {
        setLoading(false)
      }
      return
    }

    if (!email.trim() || !password) {
      setErrorMessage('Preencha todos os campos obrigatórios.')
      return
    }

    if (mode === 'signup') {
      if (!name.trim()) {
        setErrorMessage('Informe seu nome.')
        return
      }
      if (password.length < 6) {
        setErrorMessage('A senha deve ter no mínimo 6 caracteres.')
        return
      }
      if (password !== confirmPassword) {
        setErrorMessage('As senhas digitadas não coincidem.')
        return
      }

      try {
        setLoading(true)
        const { data, error } = await signUp(email.trim(), password, { name: name.trim() })
        if (error) {
          if (error.message?.toLowerCase().includes('already registered')) {
            setErrorMessage('Este e-mail já está cadastrado. Faça login ou recupere a senha.')
          } else {
            setErrorMessage(error.message || 'Erro ao criar conta. Verifique os dados.')
          }
          return
        }

        // Se o Supabase confirmou a sessão automaticamente ou enviou confirmação
        if (data?.session) {
          navigate('/inicio')
        } else if (data?.user && !data?.session) {
          setSuccessMessage(
            'Conta criada com sucesso! Verifique seu e-mail para confirmar seu cadastro ou faça login.',
          )
          setMode('login')
        } else {
          navigate('/inicio')
        }
      } catch {
        setErrorMessage('Erro de conexão ao cadastrar conta. Tente novamente.')
      } finally {
        setLoading(false)
      }
      return
    }

    // Modo login
    try {
      setLoading(true)
      const { error } = await signIn(email.trim(), password)
      if (error) {
        if (isEmailNotConfirmedError(error)) {
          setIsEmailUnconfirmed(true)
          return
        }
        setErrorMessage('E-mail ou senha incorretos.')
        return
      }
      // Cleanup lazy de famílias abandonadas (> 14 dias) em background (fire-and-forget)
      try {
        const { triggerLazyAbandonedFamiliesCleanup } = await import('@/services/family')
        triggerLazyAbandonedFamiliesCleanup().catch(() => {})
      } catch (lazyErr) {
        console.warn('[login] Falha não impeditiva ao disparar cleanup lazy:', lazyErr)
      }

      navigate('/inicio')
    } catch {
      setErrorMessage('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode)
    setErrorMessage(null)
    setSuccessMessage(null)
    setIsEmailUnconfirmed(false)
    setShowPassword(false)
    setShowConfirmPassword(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-[#E5E5E5]/30 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-[#14213D]/10 border border-[#E5E5E5] p-7 sm:p-8">
        {/* Logo & Marca */}
        <div className="flex flex-col items-center text-center mb-6">
          <div
            data-testid="brand-logo-container"
            aria-label="Curiangoo"
            className="w-16 h-16 rounded-2xl bg-[#14213D] p-1.5 shadow-lg shadow-[#14213D]/25 mb-3 flex items-center justify-center overflow-hidden border border-[#14213D]"
          >
            <CuriangoLogo size={42} color="#FCA311" />
          </div>
          <h1 className="text-2xl font-semibold text-[#14213D] tracking-tight">Curiangoo</h1>
          <p className="text-xs sm:text-sm font-bold text-[#FCA311] mt-0.5">
            Finanças Familiares no Prumo
          </p>
          <p className="text-xs text-slate-500 mt-2 max-w-xs">
            {mode === 'login' &&
              'Acesse sua conta familiar para gerenciar receitas, despesas e investimentos.'}
            {mode === 'signup' &&
              'Crie um novo workspace seguro e exclusivo para as finanças da sua casa.'}
            {mode === 'forgot_password' &&
              'Recupere o acesso à sua conta informando o e-mail cadastrado.'}
          </p>
        </div>

        {/* Abas Alternadoras no topo (Login / Criar Conta) */}
        {mode !== 'forgot_password' && (
          <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-2xl mb-6">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`py-2 text-xs font-bold rounded-xl transition-all ${
                mode === 'login'
                  ? 'bg-white text-[#14213D] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Entrar na Conta
            </button>
            <button
              type="button"
              onClick={() => switchMode('signup')}
              className={`py-2 text-xs font-bold rounded-xl transition-all ${
                mode === 'signup'
                  ? 'bg-white text-[#14213D] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Criar Nova Conta
            </button>
          </div>
        )}

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMessage && (
            <div
              data-testid="login-error-message"
              className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-xl font-medium animate-fade-in leading-relaxed"
            >
              {errorMessage}
            </div>
          )}

          {/* Alerta diferenciado para e-mail não ativado com botão de reenvio */}
          {isEmailUnconfirmed && (
            <div
              data-testid="email-not-confirmed-alert"
              className="p-3.5 sm:p-4 text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded-xl font-medium animate-fade-in leading-relaxed space-y-3 shadow-xs w-full"
            >
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span className="font-semibold text-amber-950 leading-snug">
                  Seu cadastro ainda não foi ativado. Verifique seu e-mail.
                </span>
              </div>
              <div className="pt-2 border-t border-amber-200/60 flex flex-col sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleResendConfirmation}
                  disabled={resendingEmail || resendCooldown > 0}
                  className="w-full sm:w-auto h-9 sm:h-8 px-3.5 text-xs font-semibold bg-white hover:bg-amber-100/80 text-amber-900 border-amber-300 hover:border-amber-400 shadow-2xs transition-all justify-center"
                >
                  {resendingEmail ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5 shrink-0" />
                      Enviando...
                    </>
                  ) : resendCooldown > 0 ? (
                    <span>Reenviar em {resendCooldown}s</span>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5 mr-1.5 text-amber-700 shrink-0" />
                      Reenviar E-mail de Confirmação
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {successMessage && (
            <div
              data-testid="login-success-message"
              className="p-3 text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl font-medium animate-fade-in flex items-start gap-2 leading-relaxed"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Nome (Apenas no Cadastro) */}
          {mode === 'signup' && (
            <div className="animate-fade-in">
              <Label htmlFor="signup-name" className="text-xs font-semibold text-slate-700">
                Seu Nome
              </Label>
              <div className="relative mt-1">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  id="signup-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Matheus"
                  className="pl-10 h-11 rounded-xl"
                  required={mode === 'signup'}
                  autoFocus={mode === 'signup'}
                />
              </div>
            </div>
          )}

          {/* E-mail */}
          <div>
            <Label htmlFor="auth-email" className="text-xs font-semibold text-slate-700">
              E-mail
            </Label>
            <div className="relative mt-1">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                id="auth-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@exemplo.com"
                className="pl-10 h-11 rounded-xl"
                required
                autoFocus={mode !== 'signup'}
              />
            </div>
          </div>

          {/* Senha (não exibida na recuperação) */}
          {mode !== 'forgot_password' && (
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="auth-pass" className="text-xs font-semibold text-slate-700">
                  Senha
                </Label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => switchMode('forgot_password')}
                    className="text-xs text-[#14213D] hover:text-[#14213D] font-semibold hover:underline"
                  >
                    Esqueci minha senha
                  </button>
                )}
              </div>
              <div className="relative mt-1">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  id="auth-pass"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10 pr-11 h-11 rounded-xl"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-0 top-0 h-11 w-11 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-r-xl"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Confirmar Senha (apenas no Cadastro) */}
          {mode === 'signup' && (
            <div className="animate-fade-in">
              <Label htmlFor="auth-pass-confirm" className="text-xs font-semibold text-slate-700">
                Confirmar Senha
              </Label>
              <div className="relative mt-1">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  id="auth-pass-confirm"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10 pr-11 h-11 rounded-xl"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute right-0 top-0 h-11 w-11 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-r-xl"
                  aria-label={showConfirmPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Botão de Ação Principal */}
          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 mt-3 bg-[#FCA311] hover:bg-[#e08e08] text-[#14213D] font-bold rounded-xl shadow-md shadow-[#FCA311]/20 active:scale-98 transition-all border-0"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : mode === 'signup' ? (
              'Criar Minha Conta'
            ) : mode === 'forgot_password' ? (
              <span className="flex items-center gap-2">
                <KeyRound className="w-4 h-4" />
                <span>Enviar Link de Recuperação</span>
              </span>
            ) : (
              'Entrar'
            )}
          </Button>

          {/* Links e Alternâncias Secundárias */}
          {mode === 'forgot_password' ? (
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Voltar para o Login</span>
              </button>
            </div>
          ) : (
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
                className="text-xs font-bold text-[#14213D] hover:text-[#14213D] underline transition-colors"
              >
                {mode === 'login'
                  ? 'Ainda não tem conta? Crie o workspace da sua família'
                  : 'Já possui cadastro? Entrar com e-mail e senha'}
              </button>
            </div>
          )}
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
          <p className="text-[11px] text-slate-400">
            Ambiente seguro com criptografia e isolamento individual de dados por família.
          </p>
        </div>
      </div>

      {/* Banner de Instalação na Tela de Acesso / Login */}
      <InstallPwaBanner variant="floating" />
    </div>
  )
}
