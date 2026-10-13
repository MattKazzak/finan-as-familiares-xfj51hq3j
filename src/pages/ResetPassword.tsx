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

export default function ResetPassword() {
  const { user, loading, isPasswordRecovery, updatePassword, clearPasswordRecovery } = useAuth()
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
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

    if (password.length < 6) {
      setErrorMessage('A nova senha deve ter no mínimo 6 caracteres.')
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
        {/* Cabeçalho */}
        <div className="flex flex-col items-center text-center mb-8 sm:mb-10 w-full">
          <div
            data-testid="brand-logo-container"
            aria-label="Curiangoo"
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#14213D] shadow-elevation-1 mb-4 flex items-center justify-center p-2.5"
          >
            <CuriangoLogo size={36} color="#FCA311" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#14213D] tracking-tight">
            Criar Nova Senha — Curiangoo
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 font-normal mt-2 max-w-xs leading-relaxed">
            Escolha uma nova senha forte para proteger sua conta e as finanças da sua família.
          </p>
        </div>

        {/* Card Principal */}
        <div className="w-full bg-white rounded-3xl p-6 sm:p-8 shadow-elevation-2 border border-[#14213D]/[0.06] backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            {errorMessage && (
              <div
                role="alert"
                className="p-3.5 text-xs bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl font-medium animate-fade-in flex items-start gap-2.5 leading-relaxed"
              >
                <AlertCircle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div
                role="status"
                className="p-3.5 text-xs bg-emerald-50 border border-emerald-200 text-emerald-950 rounded-2xl font-medium animate-fade-in flex items-start gap-2.5 leading-relaxed"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Campo Nova Senha */}
            <div>
              <Label
                htmlFor="new-password"
                className="text-xs font-normal text-slate-700 mb-1.5 block"
              >
                Nova Senha
              </Label>
              <div className="relative">
                <Lock
                  className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  strokeWidth={1.5}
                />
                <Input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="No mínimo 6 caracteres"
                  className="pl-11 pr-11 h-12 rounded-xl bg-white border-slate-300 placeholder:text-slate-500 text-slate-900 focus-visible:ring-[#FCA311] focus-visible:border-[#FCA311] text-sm"
                  required
                  autoFocus
                  disabled={submitting || Boolean(successMessage)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
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

            {/* Campo Confirmar Nova Senha */}
            <div>
              <Label
                htmlFor="confirm-new-password"
                className="text-xs font-normal text-slate-700 mb-1.5 block"
              >
                Confirmar Nova Senha
              </Label>
              <div className="relative">
                <Lock
                  className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  strokeWidth={1.5}
                />
                <Input
                  id="confirm-new-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  className="pl-11 pr-11 h-12 rounded-xl bg-white border-slate-300 placeholder:text-slate-500 text-slate-900 focus-visible:ring-[#FCA311] focus-visible:border-[#FCA311] text-sm"
                  required
                  disabled={submitting || Boolean(successMessage)}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
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

            {/* Botão Salvar Nova Senha */}
            <div className="pt-2">
              <Button
                type="submit"
                disabled={submitting || Boolean(successMessage)}
                className="w-full h-12 bg-[#FCA311] hover:bg-[#e08e08] text-[#14213D] font-bold rounded-xl shadow-elevation-2 active:scale-[0.99] transition-all border-0 text-sm"
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
        </div>

        {/* Rodapé de Segurança */}
        <div className="mt-8 flex items-center justify-center gap-2 text-slate-500 text-xs text-center max-w-xs">
          <ShieldCheck className="w-4 h-4 text-slate-500 shrink-0" strokeWidth={1.5} />
          <span>Curiangoo &bull; Gestão Financeira Familiar com isolamento e segurança.</span>
        </div>
      </div>
    </div>
  )
}
