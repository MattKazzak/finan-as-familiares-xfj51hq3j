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
  ArrowRight,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Send,
  Eye,
  EyeOff,
  ShieldCheck,
} from 'lucide-react'
import { InstallPwaBanner } from '@/components/common/InstallPwaBanner'
import { CuriangoLogo } from '@/components/brand/CuriangoLogo'

type AuthMode = 'login' | 'signup' | 'forgot_password'
type SignupStep = 'credentials' | 'profile'

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
  const [signupStep, setSignupStep] = useState<SignupStep>('credentials')

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

  // Avançar para a etapa de dados básicos no cadastro
  const handleNextSignupStep = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!email.trim() || !password) {
      setErrorMessage('Preencha seu e-mail e crie uma senha.')
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

    setSignupStep('profile')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)
    setIsEmailUnconfirmed(false)

    // FLUXO: ESQUECI MINHA SENHA
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

    // FLUXO: CADASTRO
    if (mode === 'signup') {
      if (!email.trim() || !password) {
        setErrorMessage('Preencha todos os campos obrigatórios.')
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
      if (!name.trim()) {
        setErrorMessage('Informe seu nome.')
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
          setSignupStep('credentials')
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

    // FLUXO: LOGIN
    if (!email.trim() || !password) {
      setErrorMessage('Preencha seu e-mail e senha.')
      return
    }

    try {
      setLoading(true)
      const { error } = await signIn(email.trim(), password)
      if (error) {
        if (isEmailNotConfirmedError(error)) {
          setIsEmailUnconfirmed(true)
          return
        }
        // Decisão de segurança mantida: anti user-enumeration
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
      setErrorMessage(
        'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
      )
    } finally {
      setLoading(false)
    }
  }

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode)
    setSignupStep('credentials')
    setErrorMessage(null)
    setSuccessMessage(null)
    setIsEmailUnconfirmed(false)
    setShowPassword(false)
    setShowConfirmPassword(false)
  }

  return (
    <div className="min-h-screen bg-[#F8F9FB] flex flex-col justify-between items-center px-4 py-8 sm:py-12 selection:bg-[#FCA311]/20">
      <div className="w-full max-w-[420px] mx-auto my-auto flex flex-col items-center">
        {/* Marca e Símbolo do Curiangoo */}
        <div className="flex flex-col items-center text-center mb-8 sm:mb-10 w-full">
          <div
            data-testid="brand-logo-container"
            aria-label="Curiangoo"
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#14213D] shadow-elevation-1 mb-4 flex items-center justify-center p-2.5 transition-transform hover:scale-105"
          >
            <CuriangoLogo size={36} color="#FCA311" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#14213D] tracking-tight">
            Curiangoo
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-[#FCA311] mt-1 tracking-wide">
            Finanças Familiares no Prumo
          </p>

          <p className="text-xs sm:text-sm text-slate-600 font-normal mt-3 max-w-xs leading-relaxed">
            {mode === 'login' &&
              'Acesse sua conta familiar para acompanhar despesas, receitas e investimentos.'}
            {mode === 'signup' &&
              signupStep === 'credentials' &&
              'Passo 1 de 2: Crie suas credenciais de acesso seguro.'}
            {mode === 'signup' &&
              signupStep === 'profile' &&
              'Passo 2 de 2: Como podemos chamar você?'}
            {mode === 'forgot_password' &&
              'Informe seu e-mail para receber as instruções de redefinição de senha.'}
          </p>
        </div>

        {/* Card Principal — Elegância Minimalista Fintech em Tema Claro */}
        <div className="w-full bg-white rounded-3xl p-6 sm:p-8 shadow-elevation-2 border border-[#14213D]/[0.06] backdrop-blur-sm">
          {/* Alternador de Modo Minimalista (Login / Criar Conta) */}
          {mode !== 'forgot_password' && (
            <div className="flex p-1 bg-[#F8F9FB] rounded-2xl mb-6 border border-[#14213D]/[0.05]">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${
                  mode === 'login'
                    ? 'bg-white text-[#14213D] shadow-elevation-1'
                    : 'text-slate-600 hover:text-[#14213D]'
                }`}
              >
                Entrar na Conta
              </button>
              <button
                type="button"
                onClick={() => switchMode('signup')}
                className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${
                  mode === 'signup'
                    ? 'bg-white text-[#14213D] shadow-elevation-1'
                    : 'text-slate-600 hover:text-[#14213D]'
                }`}
              >
                Criar Nova Conta
              </button>
            </div>
          )}

          {/* Indicador de Passos no Cadastro */}
          {mode === 'signup' && (
            <div className="mb-6 flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span
                  className={`flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-semibold tabular-nums transition-colors ${
                    signupStep === 'credentials'
                      ? 'bg-[#14213D] text-white'
                      : 'bg-emerald-600 text-white'
                  }`}
                >
                  {signupStep === 'profile' ? '✓' : '1'}
                </span>
                <span
                  className={`text-xs ${
                    signupStep === 'credentials'
                      ? 'font-semibold text-[#14213D]'
                      : 'text-slate-600 font-medium'
                  }`}
                >
                  Credenciais
                </span>
              </div>
              <div className="h-px bg-slate-200 flex-1 mx-3" />
              <div className="flex items-center gap-2">
                <span
                  className={`flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-semibold tabular-nums transition-colors ${
                    signupStep === 'profile'
                      ? 'bg-[#14213D] text-white'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  2
                </span>
                <span
                  className={`text-xs ${
                    signupStep === 'profile'
                      ? 'font-semibold text-[#14213D]'
                      : 'text-slate-500 font-normal'
                  }`}
                >
                  Seu Nome
                </span>
              </div>
            </div>
          )}

          {/* Mensagem de Erro com Contraste WCAG AAA (bordeaux #991B1B sobre fundo sutil) */}
          {errorMessage && (
            <div
              data-testid="login-error-message"
              role="alert"
              className="mb-5 p-3.5 text-xs bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl font-medium animate-fade-in flex items-start gap-2.5 leading-relaxed"
            >
              <AlertCircle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span>{errorMessage}</span>
                {mode === 'login' && errorMessage.includes('E-mail ou senha incorretos') && (
                  <div className="mt-1.5 pt-1.5 border-t border-rose-200/60">
                    <button
                      type="button"
                      onClick={() => switchMode('signup')}
                      className="font-semibold text-rose-950 underline hover:text-rose-800 transition-colors"
                    >
                      Ainda não tem conta? Clique para se cadastrar
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Alerta diferenciado para e-mail não ativado com botão de reenvio */}
          {isEmailUnconfirmed && (
            <div
              data-testid="email-not-confirmed-alert"
              role="alert"
              className="mb-5 p-4 text-xs bg-amber-50/90 border border-amber-300 text-amber-950 rounded-2xl font-medium animate-fade-in leading-relaxed space-y-3 shadow-elevation-1"
            >
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <span className="font-semibold text-amber-950 leading-snug">
                  Seu cadastro ainda não foi ativado. Verifique seu e-mail.
                </span>
              </div>
              <div className="pt-2 border-t border-amber-200/70 flex flex-col sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleResendConfirmation}
                  disabled={resendingEmail || resendCooldown > 0}
                  className="w-full sm:w-auto h-9 px-3.5 text-xs font-semibold bg-white hover:bg-amber-100/80 text-amber-950 border-amber-300 hover:border-amber-400 shadow-elevation-1 transition-all justify-center rounded-xl"
                >
                  {resendingEmail ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5 shrink-0" />
                      Enviando...
                    </>
                  ) : resendCooldown > 0 ? (
                    <span className="tabular-nums">Reenviar em {resendCooldown}s</span>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5 mr-1.5 text-amber-800 shrink-0" />
                      Reenviar E-mail de Confirmação
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Mensagem de Sucesso com Alto Contraste WCAG */}
          {successMessage && (
            <div
              data-testid="login-success-message"
              role="status"
              className="mb-5 p-3.5 text-xs bg-emerald-50 border border-emerald-200 text-emerald-950 rounded-2xl font-medium animate-fade-in flex items-start gap-2.5 leading-relaxed"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Formulário Interativo com Amplo Respiro Vertical */}
          <form
            onSubmit={
              mode === 'signup' && signupStep === 'credentials'
                ? handleNextSignupStep
                : handleSubmit
            }
            className="space-y-5"
          >
            {/* ETAPA DE CADASTRO 2: NOME */}
            {mode === 'signup' && signupStep === 'profile' && (
              <div className="space-y-4 animate-fade-in">
                <div>
                  <Label
                    htmlFor="signup-name"
                    className="text-xs font-normal text-slate-700 mb-1.5 block"
                  >
                    Seu Nome
                  </Label>
                  <div className="relative">
                    <UserIcon
                      className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                      strokeWidth={1.5}
                    />
                    <Input
                      id="signup-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: Matheus"
                      className="pl-11 h-12 rounded-xl bg-white border-slate-300 placeholder:text-slate-500 text-slate-900 focus-visible:ring-[#FCA311] focus-visible:border-[#FCA311] text-sm"
                      required
                      autoFocus
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    Seu nome será exibido para identificar quem registrou os lançamentos. O nome da
                    família será definido no próximo passo.
                  </p>
                </div>
              </div>
            )}

            {/* ETAPA DE CREDENCIAIS (LOGIN OU SIGNUP PASSO 1 OU RECUPERAÇÃO) */}
            {(mode !== 'signup' || signupStep === 'credentials') && (
              <>
                {/* E-mail */}
                <div>
                  <Label
                    htmlFor="auth-email"
                    className="text-xs font-normal text-slate-700 mb-1.5 block"
                  >
                    E-mail
                  </Label>
                  <div className="relative">
                    <Mail
                      className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                      strokeWidth={1.5}
                    />
                    <Input
                      id="auth-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu.email@exemplo.com"
                      className="pl-11 h-12 rounded-xl bg-white border-slate-300 placeholder:text-slate-500 text-slate-900 focus-visible:ring-[#FCA311] focus-visible:border-[#FCA311] text-sm"
                      required
                      autoFocus={mode !== 'signup'}
                    />
                  </div>
                </div>

                {/* Senha */}
                {mode !== 'forgot_password' && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <Label htmlFor="auth-pass" className="text-xs font-normal text-slate-700">
                        Senha
                      </Label>
                      {mode === 'login' && (
                        <button
                          type="button"
                          onClick={() => switchMode('forgot_password')}
                          className="text-xs text-[#14213D] hover:text-[#0e172a] font-medium hover:underline transition-colors focus:outline-none"
                        >
                          Esqueci minha senha
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Lock
                        className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                        strokeWidth={1.5}
                      />
                      <Input
                        id="auth-pass"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="pl-11 pr-11 h-12 rounded-xl bg-white border-slate-300 placeholder:text-slate-500 text-slate-900 focus-visible:ring-[#FCA311] focus-visible:border-[#FCA311] text-sm"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-0 top-0 h-12 w-11 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors focus:outline-none rounded-r-xl"
                        aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" strokeWidth={1.5} />
                        ) : (
                          <Eye className="w-4 h-4" strokeWidth={1.5} />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Confirmar Senha (apenas no Cadastro Passo 1) */}
                {mode === 'signup' && signupStep === 'credentials' && (
                  <div className="animate-fade-in">
                    <Label
                      htmlFor="auth-pass-confirm"
                      className="text-xs font-normal text-slate-700 mb-1.5 block"
                    >
                      Confirmar Senha
                    </Label>
                    <div className="relative">
                      <Lock
                        className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                        strokeWidth={1.5}
                      />
                      <Input
                        id="auth-pass-confirm"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="pl-11 pr-11 h-12 rounded-xl bg-white border-slate-300 placeholder:text-slate-500 text-slate-900 focus-visible:ring-[#FCA311] focus-visible:border-[#FCA311] text-sm"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        className="absolute right-0 top-0 h-12 w-11 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors focus:outline-none rounded-r-xl"
                        aria-label={showConfirmPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="w-4 h-4" strokeWidth={1.5} />
                        ) : (
                          <Eye className="w-4 h-4" strokeWidth={1.5} />
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Botões de Ação Principal com Elevação Tokenizada R56 */}
            <div className="pt-2">
              {mode === 'signup' && signupStep === 'profile' ? (
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSignupStep('credentials')}
                    disabled={loading}
                    className="h-12 px-4 rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold"
                  >
                    <ArrowLeft className="w-4 h-4 mr-1.5" />
                    Voltar
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="flex-1 h-12 bg-[#FCA311] hover:bg-[#e08e08] text-[#14213D] font-bold rounded-xl shadow-elevation-2 active:scale-[0.99] transition-all border-0 text-sm"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Criando sua conta...</span>
                      </span>
                    ) : (
                      'Criar Minha Conta'
                    )}
                  </Button>
                </div>
              ) : (
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 bg-[#FCA311] hover:bg-[#e08e08] text-[#14213D] font-bold rounded-xl shadow-elevation-2 active:scale-[0.99] transition-all border-0 text-sm"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processando...</span>
                    </span>
                  ) : mode === 'signup' ? (
                    <span className="flex items-center justify-center gap-2">
                      <span>Continuar</span>
                      <ArrowRight className="w-4 h-4" strokeWidth={2} />
                    </span>
                  ) : mode === 'forgot_password' ? (
                    <span className="flex items-center justify-center gap-2">
                      <KeyRound className="w-4 h-4" />
                      <span>Enviar Link de Recuperação</span>
                    </span>
                  ) : (
                    'Entrar'
                  )}
                </Button>
              )}
            </div>

            {/* Alternâncias Secundárias e Links */}
            <div className="pt-2 text-center">
              {mode === 'forgot_password' ? (
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-[#14213D] transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Voltar para o Login</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
                  className="text-xs font-medium text-slate-600 hover:text-[#14213D] transition-colors"
                >
                  {mode === 'login' ? (
                    <span>
                      Ainda não tem conta?{' '}
                      <strong className="font-semibold text-[#14213D] underline">
                        Criar workspace familiar
                      </strong>
                    </span>
                  ) : (
                    <span>
                      Já possui cadastro?{' '}
                      <strong className="font-semibold text-[#14213D] underline">
                        Entrar com e-mail e senha
                      </strong>
                    </span>
                  )}
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Rodapé de Segurança e Confiança Fintech */}
        <div className="mt-8 flex items-center justify-center gap-2 text-slate-500 text-xs text-center max-w-xs">
          <ShieldCheck className="w-4 h-4 text-slate-500 shrink-0" strokeWidth={1.5} />
          <span>Isolamento individual por família e criptografia de ponta a ponta.</span>
        </div>
      </div>

      {/* Banner de Instalação PWA */}
      <InstallPwaBanner variant="floating" />
    </div>
  )
}
