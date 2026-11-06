import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
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
// Logo oficial do login (nova logo 2026: pássaro + wordmark em navy #14213D).
// Fundo branco da imagem anulável por CSS (multiply some com o fundo claro
// #F8F9FB da página) — equivalente visual a um PNG alpha, sem asset binário.
// Arquivo de imagem integral enviado pelo dono — NÃO recriar nem trocar por SVG.
import curiangooLoginLogo from '@/assets/imagemgerada1793989752917-c429b.png'

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

/**
 * Política de senha (padrão ouro): mínimo 8 caracteres + letra maiúscula + número.
 * Score 0-4 para o medidor visual. Símbolo e comprimento ≥12 elevam a nota.
 */
export function evaluatePasswordStrength(pw: string): {
  score: number
  label: string
} {
  if (!pw) return { score: 0, label: '' }
  const hasUpper = /[A-Z]/.test(pw)
  const hasLower = /[a-z]/.test(pw)
  const hasNumber = /[0-9]/.test(pw)
  const hasSymbol = /[^A-Za-z0-9]/.test(pw)
  const len = pw.length

  let score = 0
  if (len >= 8) score++
  if (hasUpper && hasLower) score++
  if (hasNumber) score++
  if (hasSymbol || len >= 12) score++

  const labels = ['Muito fraca', 'Fraca', 'Razoável', 'Forte', 'Excelente']
  return { score, label: labels[score] }
}

/** Senha aceita no cadastro: score mínimo 3 (8+ chars, maiúscula+minúscula, número). */
export function isPasswordStrongEnough(pw: string): boolean {
  return evaluatePasswordStrength(pw).score >= 3
}

export default function Login() {
  const { signIn, signUp, resetPasswordForEmail } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [mode, setMode] = useState<AuthMode>('login')
  // Plano preferido (login): define o checkout depois do trial (mensal padrão)
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('monthly')
  const [signupStep, setSignupStep] = useState<SignupStep>('credentials')

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const passwordStrength = useMemo(() => evaluatePasswordStrength(password), [password])
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Estado para fluxo de e-mail não confirmado
  const [isEmailUnconfirmed, setIsEmailUnconfirmed] = useState(false)
  const [resendingEmail, setResendingEmail] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  // LINK EXPIRADO (22/10): vindo do use-auth quando o link de confirmação do
  // e-mail falhou (velho/já usado). Padrão de mercado: aviso claro + reenvio.
  const [authLinkError, setAuthLinkError] = useState<'link_expirado' | 'link_invalido' | null>(
    () => {
      try {
        const raw = sessionStorage.getItem('curiangoo_auth_error')
        if (!raw) return null
        const parsed = JSON.parse(raw) as { kind: string; t: number }
        // consome: mostra 1x
        sessionStorage.removeItem('curiangoo_auth_error')
        if (Date.now() - parsed.t < 5 * 60 * 1000) {
          return parsed.kind === 'link_expirado' ? 'link_expirado' : 'link_invalido'
        }
        return null
      } catch {
        return null
      }
    },
  )

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

    if (!isPasswordStrongEnough(password)) {
      setErrorMessage(
        'Use uma senha mais forte: no mínimo 8 caracteres, com letra maiúscula e número.',
      )
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
      if (!isPasswordStrongEnough(password)) {
        setErrorMessage(
          'Use uma senha mais forte: no mínimo 8 caracteres, com letra maiúscula e número.',
        )
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
        {/* Marca: logo horizontal oficial (pássaro + wordmark "Curiangoo" em navy) */}
        <header className="flex flex-col items-center text-center mb-8 sm:mb-10 w-full">
          <div
            data-testid="brand-logo-container"
            aria-label="Curiangoo"
            className="mb-4 flex items-center justify-center"
          >
            <img
              src={curiangooLoginLogo}
              alt="Curiangoo"
              className="w-[200px] h-auto select-none pointer-events-none mix-blend-multiply"
              draggable={false}
            />
          </div>
          {/* Wordmark vive dentro da própria imagem — h1 só para leitores de tela/semântica */}
          <h1 className="sr-only">Curiangoo</h1>
          <p className="text-xs sm:text-sm text-slate-600 font-light mt-1 max-w-xs leading-relaxed">
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
        </header>

        {/* LANDING: Planos (modelo C2, 17/10) — trial 7 dias grátis, depois R$ 19,90/mês
            ou R$ 149,90/ano. Só no modo login (mantém o cadastro enxuto). */}
        {mode === 'signup' && (
          <section aria-label="Planos e preços" className="w-full mb-6 space-y-3">
            <div className="w-full rounded-3xl bg-[#14213D] text-white p-5 shadow-elevation-2">
              <p className="text-sm font-semibold leading-tight">
                A plataforma de finanças da sua família, com assistente inteligente de voz.
              </p>
              <p className="text-xs text-white/70 mt-1.5 leading-relaxed">
                Comece com <span className="font-bold text-[#FCA311]">7 dias grátis</span> — sem
                cartão de crédito, sem compromisso. Ao final, escolha o plano ideal:
              </p>
            </div>
            {/* Planos selecionáveis: a escolha define o checkout após o trial */}
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Plano preferido">
              <button
                type="button"
                role="radio"
                aria-checked={selectedPlan === 'monthly'}
                onClick={() => setSelectedPlan('monthly')}
                className={`rounded-2xl p-3.5 text-left transition-all active:scale-[0.98] ${
                  selectedPlan === 'monthly'
                    ? 'border-2 border-[#14213D] bg-white shadow-elevation-1'
                    : 'border border-[rgba(20,33,61,0.1)] bg-white hover:border-[#14213D]/40'
                }`}
              >
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                  Mensal
                </p>
                <p className="text-lg font-bold text-[#14213D] mt-0.5">
                  R$ 19,90<span className="text-xs font-medium text-slate-400">/mês</span>
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">Cancele quando quiser</p>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={selectedPlan === 'yearly'}
                onClick={() => setSelectedPlan('yearly')}
                className={`rounded-2xl p-3.5 text-left transition-all active:scale-[0.98] ${
                  selectedPlan === 'yearly'
                    ? 'border-2 border-[#FCA311] bg-white shadow-elevation-1'
                    : 'border-2 border-[#FCA311]/40 bg-white hover:border-[#FCA311]/70'
                }`}
              >
                <p className="text-[11px] font-semibold text-[#B45309] uppercase tracking-wide">
                  Anual
                </p>
                <p className="text-lg font-bold text-[#14213D] mt-0.5">
                  R$ 149,90<span className="text-xs font-medium text-slate-400">/ano</span>
                </p>
                <p className="text-[10px] font-bold text-emerald-700 mt-0.5">Economize R$ 89,90</p>
              </button>
            </div>
          </section>
        )}
        {/* Conteúdo principal — sem card: fica direto sobre o fundo da página, em continuidade com a logo */}
        <main className="w-full p-6 sm:p-9">
          {/* Alternador de Modo Minimalista (Login / Criar Conta) */}
          {mode !== 'forgot_password' && (
            <div className="flex p-1 bg-slate-100 rounded-2xl mb-7 border border-[#14213D]/[0.05]">
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
            <div className="mb-7 flex items-center justify-between px-1">
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
                      : 'text-slate-600 font-light'
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
                      : 'text-slate-500 font-light'
                  }`}
                >
                  Seu Nome
                </span>
              </div>
            </div>
          )}

          {/* LINK DE CONFIRMAÇÃO EXPIRADO/INVÁLIDO (22/10, padrão de mercado):
              o usuário clicou num link velho do e-mail → aviso claro + reenvio.
              Antes disso o app caía no login em silêncio. */}
          {authLinkError && !isEmailUnconfirmed && (
            <div
              data-testid="auth-link-error-alert"
              role="alert"
              className="mb-6 p-4 text-xs bg-amber-50/90 border border-amber-300 text-amber-950 rounded-2xl font-medium animate-fade-in leading-relaxed space-y-3 shadow-elevation-1"
            >
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <span className="font-semibold text-amber-950 leading-snug">
                  {authLinkError === 'link_expirado'
                    ? 'Este link de confirmação expirou.'
                    : 'Este link de confirmação já foi usado ou é inválido.'}
                </span>
              </div>
              <p className="text-amber-800 leading-snug">
                Sem problema — digite seu e-mail abaixo e envie um link novo. Links de confirmação
                valem por 30 minutos.
              </p>
              <div className="pt-2 border-t border-amber-200/70 flex flex-col sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleResendConfirmation}
                  disabled={resendingEmail || resendCooldown > 0}
                  className="border-amber-400 text-amber-950 hover:bg-amber-100"
                >
                  {resendingEmail
                    ? 'Enviando…'
                    : resendCooldown > 0
                      ? `Aguarde ${resendCooldown}s`
                      : 'Enviar novo link'}
                </Button>
              </div>
            </div>
          )}

          {/* Alerta diferenciado para e-mail não ativado com botão de reenvio */}
          {isEmailUnconfirmed && (
            <div
              data-testid="email-not-confirmed-alert"
              role="alert"
              className="mb-6 p-4 text-xs bg-amber-50/90 border border-amber-300 text-amber-950 rounded-2xl font-medium animate-fade-in leading-relaxed space-y-3 shadow-elevation-1"
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
              className="mb-6 p-3.5 text-xs bg-emerald-50 border border-emerald-200 text-emerald-950 rounded-2xl font-medium animate-fade-in flex items-start gap-2.5 leading-relaxed"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Formulário Interativo com Amplo Respiro Vertical (space-y-6) */}
          <form
            onSubmit={
              mode === 'signup' && signupStep === 'credentials'
                ? handleNextSignupStep
                : handleSubmit
            }
            className="space-y-6"
          >
            {/* ETAPA DE CADASTRO 2: NOME */}
            {mode === 'signup' && signupStep === 'profile' && (
              <div className="space-y-5 animate-fade-in">
                <div>
                  <Label
                    htmlFor="signup-name"
                    className="text-xs font-light text-slate-600 mb-1 block tracking-wide"
                  >
                    Seu Nome
                  </Label>
                  <div className="relative group border-b border-slate-300 focus-within:border-[#FCA311] transition-all bg-transparent">
                    <UserIcon
                      className="w-4 h-4 text-slate-400 group-focus-within:text-[#FCA311] absolute left-0 top-1/2 -translate-y-1/2 pointer-events-none transition-colors"
                      strokeWidth={1.5}
                    />
                    <Input
                      id="signup-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: Matheus"
                      className="pl-8 pr-2 h-11 border-0 rounded-none bg-transparent placeholder:text-slate-400 placeholder:font-light text-slate-900 font-normal focus-visible:ring-0 focus-visible:ring-offset-0 text-sm shadow-none"
                      required
                      autoFocus
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 font-light mt-1.5 leading-normal">
                    Seu nome será exibido para identificar quem registrou os lançamentos. O nome da
                    família será definido no próximo passo.
                  </p>
                </div>
              </div>
            )}

            {/* ETAPA DE CREDENCIAIS (LOGIN OU SIGNUP PASSO 1 OU RECUPERAÇÃO) */}
            {(mode !== 'signup' || signupStep === 'credentials') && (
              <>
                {/* E-mail (Estilo Underline com Ícone Linear e Destaque Âmbar #FCA311 no Campo Ativo) */}
                <div>
                  <Label
                    htmlFor="auth-email"
                    className="text-xs font-light text-slate-600 mb-1 block tracking-wide"
                  >
                    E-mail
                  </Label>
                  <div className="relative group border-b border-slate-300 focus-within:border-[#FCA311] transition-all bg-transparent">
                    <Mail
                      className="w-4 h-4 text-slate-400 group-focus-within:text-[#FCA311] absolute left-0 top-1/2 -translate-y-1/2 pointer-events-none transition-colors"
                      strokeWidth={1.5}
                    />
                    <Input
                      id="auth-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu.email@exemplo.com"
                      className="pl-8 pr-2 h-11 border-0 rounded-none bg-transparent placeholder:text-slate-400 placeholder:font-light text-slate-900 font-normal focus-visible:ring-0 focus-visible:ring-offset-0 text-sm shadow-none"
                      required
                      autoFocus={mode !== 'signup'}
                    />
                  </div>
                </div>

                {/* Senha */}
                {mode !== 'forgot_password' && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label
                        htmlFor="auth-pass"
                        className="text-xs font-light text-slate-600 tracking-wide"
                      >
                        Senha
                      </Label>
                      {mode === 'login' && (
                        <button
                          type="button"
                          onClick={() => switchMode('forgot_password')}
                          className="text-xs text-[#14213D] hover:text-[#0e172a] font-normal hover:underline transition-colors focus:outline-none"
                        >
                          Esqueci minha senha
                        </button>
                      )}
                    </div>
                    <div className="relative group border-b border-slate-300 focus-within:border-[#FCA311] transition-all bg-transparent">
                      <Lock
                        className="w-4 h-4 text-slate-400 group-focus-within:text-[#FCA311] absolute left-0 top-1/2 -translate-y-1/2 pointer-events-none transition-colors"
                        strokeWidth={1.5}
                      />
                      <Input
                        id="auth-pass"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="pl-8 pr-9 h-11 border-0 rounded-none bg-transparent placeholder:text-slate-400 placeholder:font-light text-slate-900 font-normal focus-visible:ring-0 focus-visible:ring-offset-0 text-sm shadow-none"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-0 top-0 h-11 w-8 flex items-center justify-end text-slate-400 hover:text-slate-700 transition-colors focus:outline-none"
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

                {/* Medidor de força da senha (apenas no Cadastro Passo 1) */}
                {mode === 'signup' && signupStep === 'credentials' && password.length > 0 && (
                  <div className="animate-fade-in space-y-1.5" aria-live="polite">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                            i <= passwordStrength.score
                              ? passwordStrength.score <= 1
                                ? 'bg-red-500'
                                : passwordStrength.score === 2
                                  ? 'bg-amber-500'
                                  : passwordStrength.score === 3
                                    ? 'bg-emerald-500'
                                    : 'bg-emerald-600'
                              : 'bg-slate-200'
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-[11px] font-medium text-slate-500">
                      {passwordStrength.label}
                      {passwordStrength.score < 3 &&
                        ' — use 8+ caracteres, com letra maiúscula, número e símbolo.'}
                    </p>
                  </div>
                )}

                {/* Confirmar Senha (apenas no Cadastro Passo 1) */}
                {mode === 'signup' && signupStep === 'credentials' && (
                  <div className="animate-fade-in">
                    <Label
                      htmlFor="auth-pass-confirm"
                      className="text-xs font-light text-slate-600 mb-1 block tracking-wide"
                    >
                      Confirmar Senha
                    </Label>
                    <div className="relative group border-b border-slate-300 focus-within:border-[#FCA311] transition-all bg-transparent">
                      <Lock
                        className="w-4 h-4 text-slate-400 group-focus-within:text-[#FCA311] absolute left-0 top-1/2 -translate-y-1/2 pointer-events-none transition-colors"
                        strokeWidth={1.5}
                      />
                      <Input
                        id="auth-pass-confirm"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="pl-8 pr-9 h-11 border-0 rounded-none bg-transparent placeholder:text-slate-400 placeholder:font-light text-slate-900 font-normal focus-visible:ring-0 focus-visible:ring-offset-0 text-sm shadow-none"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        className="absolute right-0 top-0 h-11 w-8 flex items-center justify-end text-slate-400 hover:text-slate-700 transition-colors focus:outline-none"
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

            {/* Mensagem de Erro Discreta Abaixo do Campo com Alto Contraste WCAG */}
            {errorMessage && (
              <div
                data-testid="login-error-message"
                role="alert"
                className="pt-1 text-xs text-rose-700 font-medium animate-fade-in flex items-start gap-2 leading-relaxed"
              >
                <AlertCircle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span>{errorMessage}</span>
                  {mode === 'login' && errorMessage.includes('E-mail ou senha incorretos') && (
                    <div className="mt-1 pt-1 border-t border-rose-200/60">
                      <button
                        type="button"
                        onClick={() => switchMode('signup')}
                        className="font-medium text-rose-900 underline hover:text-rose-950 transition-colors"
                      >
                        Ainda não tem conta? Clique para se cadastrar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Botões de Ação Principal com Elevação Tokenizada R56 */}
            <div className="pt-3">
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
                    className="flex-1 h-12 bg-[#FCA311] hover:bg-[#e08e08] text-[#14213D] font-bold rounded-xl shadow-elevation-1 hover:shadow-elevation-2 active:scale-[0.99] transition-all border-0 text-sm"
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
                  className="w-full h-12 bg-[#FCA311] hover:bg-[#e08e08] text-[#14213D] font-bold rounded-xl shadow-elevation-1 hover:shadow-elevation-2 active:scale-[0.99] transition-all border-0 text-sm"
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
                    <span className="flex items-center justify-center gap-2">
                      <span>Entrar na minha conta</span>
                      <ArrowRight className="w-4 h-4" strokeWidth={2} />
                    </span>
                  )}{' '}
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
                  className="text-xs font-normal text-slate-600 hover:text-[#14213D] transition-colors"
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
        </main>

        {/* Rodapé de Segurança e Confiança Fintech */}
        <footer className="mt-8 flex flex-col items-center gap-2 text-slate-500 text-xs text-center max-w-xs font-light">
          <div className="flex items-center justify-center gap-2">
            <ShieldCheck className="w-4 h-4 text-slate-500 shrink-0" strokeWidth={1.5} />
            <span>Seus dados protegidos com criptografia e isolamento por família.</span>
          </div>
          <nav
            className="flex items-center justify-center gap-3 text-[11px] text-slate-400"
            aria-label="Links legais"
          >
            <Link
              to="/privacidade"
              className="hover:text-slate-600 underline-offset-2 hover:underline"
            >
              Privacidade
            </Link>
            <span aria-hidden="true">·</span>
            <Link to="/termos" className="hover:text-slate-600 underline-offset-2 hover:underline">
              Termos
            </Link>
            <span aria-hidden="true">·</span>
            <Link to="/faq" className="hover:text-slate-600 underline-offset-2 hover:underline">
              FAQ
            </Link>
            <span aria-hidden="true">·</span>
            <Link to="/contato" className="hover:text-slate-600 underline-offset-2 hover:underline">
              Fale conosco
            </Link>
          </nav>
        </footer>
      </div>

      {/* Banner de Instalação PWA */}
      <InstallPwaBanner variant="floating" />
    </div>
  )
}
