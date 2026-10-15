import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Loader2,
  Lock,
  KeyRound,
  CheckCircle2,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react'
import { CuriangoLogo } from '@/components/brand/CuriangoLogo'
import { evaluatePasswordStrength, isPasswordStrongEnough } from '@/pages/Login'

export default function ResetPassword() {
  const { user, loading, isPasswordRecovery, updatePassword, clearPasswordRecovery } = useAuth()
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const passwordStrength = React.useMemo(() => evaluatePasswordStrength(password), [password])
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Document Title conforme requisito
  useEffect(() => {
    document.title = 'Criar Nova Senha — Curiangoo'
  }, [])

  // Checagem de tokens/hashes na URL para recuperação de senha (distinguindo de confirmação de cadastro)
  const hasRecoveryInUrl = () => {
    if (typeof window === 'undefined') return false
    const hash = window.location.hash || ''
    const search = window.location.search || ''
    const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)
    const searchParams = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)

    const isSignup =
      hashParams.get('type') === 'signup' ||
      searchParams.get('type') === 'signup' ||
      hash.includes('type=signup') ||
      search.includes('type=signup')

    if (isSignup) return false

    return (
      hashParams.get('type') === 'recovery' ||
      searchParams.get('type') === 'recovery' ||
      hash.includes('type=recovery') ||
      search.includes('type=recovery')
    )
  }

  // Proteção da rota
  useEffect(() => {
    if (!loading) {
      if (hasRecoveryInUrl()) {
        return
      }

      if (!user && !isPasswordRecovery) {
        navigate('/', { replace: true })
      } else if (user && !isPasswordRecovery) {
        navigate('/inicio', { replace: true })
      }
    }
  }, [loading, user, isPasswordRecovery, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

    if (!password.trim() || !confirmPassword.trim()) {
      setErrorMessage('Por favor, preencha todos os campos.')
      return
    }

    if (!isPasswordStrongEnough(password)) {
      setErrorMessage('Use uma senha forte: no mínimo 8 caracteres, com letra maiúscula e número.')
      return
    }

    if (password !== confirmPassword) {
      setErrorMessage('As senhas digitadas não coincidem. Verifique e tente novamente.')
      return
    }

    try {
      setSubmitting(true)
      const { error } = await updatePassword(password)

      if (error) {
        let friendlyMessage = 'Não foi possível atualizar a senha. Tente novamente.'
        const msg = (error.message || '').toLowerCase()

        if (msg.includes('same password') || msg.includes('different from the old')) {
          friendlyMessage = 'A nova senha deve ser diferente da senha anterior.'
        } else if (msg.includes('at least 6') || msg.includes('short')) {
          friendlyMessage = 'A senha informada é curta demais. Digite ao menos 6 caracteres.'
        } else if (msg.includes('weak') || msg.includes('pwned') || msg.includes('strength')) {
          friendlyMessage = 'Senha fraca. Tente misturar letras maiúsculas, minúsculas e números.'
        } else if (
          msg.includes('session expired') ||
          msg.includes('invalid') ||
          msg.includes('jwt')
        ) {
          friendlyMessage =
            'O link de recuperação expirou ou é inválido. Por favor, solicite um novo link na tela de login.'
        }

        setErrorMessage(friendlyMessage)
        return
      }

      setSuccessMessage('Senha atualizada com sucesso! Redirecionando para o seu início...')
      clearPasswordRecovery()

      setTimeout(() => {
        navigate('/inicio', { replace: true })
      }, 1500)
    } catch {
      setErrorMessage('Ocorreu um erro de conexão ao atualizar a senha. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FB] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#FCA311]" />
          <span className="text-xs text-slate-600 font-medium">
            Validando link de recuperação...
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8F9FB] flex flex-col justify-between items-center px-4 py-8 sm:py-12 selection:bg-[#FCA311]/20">
      <div className="w-full max-w-[420px] mx-auto my-auto flex flex-col items-center">
        {/* Cabeçalho — Layout vertical centralizado e respiro generoso */}
        <header className="flex flex-col items-center text-center mb-8 sm:mb-10 w-full">
          <div
            data-testid="brand-logo-container"
            aria-label="Curiangoo"
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#14213D] shadow-elevation-1 mb-5 flex items-center justify-center p-2.5 transition-transform hover:scale-105"
          >
            <CuriangoLogo size={36} color="#FCA311" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#14213D] tracking-tight">
            Criar Nova Senha — Curiangoo
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 font-light mt-2 max-w-xs leading-relaxed">
            Escolha uma nova senha forte para proteger sua conta e as finanças da sua família.
          </p>
        </header>

        {/* Card Principal com sombra suave */}
        <main className="w-full bg-white rounded-3xl p-6 sm:p-9 shadow-elevation-2 border border-[#14213D]/[0.06] backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="space-y-6">
            {successMessage && (
              <div
                role="status"
                className="p-3.5 text-xs bg-emerald-50 border border-emerald-200 text-emerald-950 rounded-2xl font-medium animate-fade-in flex items-start gap-2.5 leading-relaxed"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Campo Nova Senha (Estilo Underline com Ícone Linear e Destaque Âmbar #FCA311 no Campo Ativo) */}
            <div>
              <Label
                htmlFor="new-password"
                className="text-xs font-light text-slate-600 mb-1 block tracking-wide"
              >
                Nova Senha
              </Label>
              <div className="relative group border-b border-slate-300 focus-within:border-[#FCA311] focus-within:ring-1 focus-within:ring-[#FCA311] transition-all bg-transparent">
                <Lock
                  className="w-4 h-4 text-slate-400 group-focus-within:text-[#FCA311] absolute left-0 top-1/2 -translate-y-1/2 pointer-events-none transition-colors"
                  strokeWidth={1.5}
                />
                <Input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="8+ caracteres, maiúscula e número"
                  className="pl-8 pr-9 h-11 border-0 rounded-none bg-transparent placeholder:text-slate-400 placeholder:font-light text-slate-900 font-normal focus-visible:ring-0 focus-visible:ring-offset-0 text-sm shadow-none"
                  required
                  autoFocus
                  disabled={submitting || Boolean(successMessage)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
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

            {/* Medidor de força da senha */}
            {password.length > 0 && (
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
                              : 'bg-emerald-500'
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

            {/* Campo Confirmar Nova Senha */}
            <div>
              <Label
                htmlFor="confirm-new-password"
                className="text-xs font-light text-slate-600 mb-1 block tracking-wide"
              >
                Confirmar Nova Senha
              </Label>
              <div className="relative group border-b border-slate-300 focus-within:border-[#FCA311] focus-within:ring-1 focus-within:ring-[#FCA311] transition-all bg-transparent">
                <Lock
                  className="w-4 h-4 text-slate-400 group-focus-within:text-[#FCA311] absolute left-0 top-1/2 -translate-y-1/2 pointer-events-none transition-colors"
                  strokeWidth={1.5}
                />
                <Input
                  id="confirm-new-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  className="pl-8 pr-9 h-11 border-0 rounded-none bg-transparent placeholder:text-slate-400 placeholder:font-light text-slate-900 font-normal focus-visible:ring-0 focus-visible:ring-offset-0 text-sm shadow-none"
                  required
                  disabled={submitting || Boolean(successMessage)}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
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

            {/* Mensagem de Erro Discreta Abaixo do Campo com Alto Contraste WCAG */}
            {errorMessage && (
              <div
                role="alert"
                className="pt-1 text-xs text-rose-700 font-medium animate-fade-in flex items-start gap-2 leading-relaxed"
              >
                <AlertCircle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Botão Salvar Nova Senha com Elevação Sutil */}
            <div className="pt-3">
              <Button
                type="submit"
                disabled={submitting || Boolean(successMessage)}
                className="w-full h-12 bg-[#FCA311] hover:bg-[#e08e08] text-[#14213D] font-bold rounded-xl shadow-elevation-1 hover:shadow-elevation-2 active:scale-[0.99] transition-all border-0 text-sm"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Atualizando senha...</span>
                  </span>
                ) : successMessage ? (
                  <span className="flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Senha Atualizada!</span>
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <span>Salvar Nova Senha</span>
                    <ArrowRight className="w-4 h-4" strokeWidth={2} />
                  </span>
                )}
              </Button>
            </div>
          </form>
        </main>

        {/* Rodapé de Segurança */}
        <footer className="mt-8 flex items-center justify-center gap-2 text-slate-500 text-xs text-center max-w-xs font-light">
          <ShieldCheck className="w-4 h-4 text-slate-500 shrink-0" strokeWidth={1.5} />
          <span>Curiangoo &bull; Gestão Financeira Familiar com isolamento e segurança.</span>
        </footer>
      </div>
    </div>
  )
}
