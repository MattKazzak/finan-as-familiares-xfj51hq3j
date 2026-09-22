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
} from 'lucide-react'

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
    document.title = 'Criar Nova Senha — Curiango'
  }, [])

  // Checagem de tokens/hashes na URL
  const hasRecoveryInUrl = () => {
    if (typeof window === 'undefined') return false
    const hash = window.location.hash || ''
    const search = window.location.search || ''
    return (
      hash.includes('type=recovery') ||
      hash.includes('access_token') ||
      search.includes('code=') ||
      search.includes('type=recovery')
    )
  }

  // Proteção da rota:
  // Não redireciona se estiver carregando ou se a URL ainda contiver tokens sendo processados
  useEffect(() => {
    if (!loading) {
      if (hasRecoveryInUrl()) {
        // Aguarda a troca do token/code pelo supabase client
        return
      }

      if (!user && !isPasswordRecovery) {
        // Sem usuário autenticado e sem indício de recuperação
        navigate('/', { replace: true })
      } else if (user && !isPasswordRecovery) {
        // Usuário logado padrão acessando a rota sem estar em recuperação
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
        // Tratamento amigável em português sem jargão técnico
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <span className="text-sm text-slate-500 font-medium">
            Validando link de recuperação...
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/20 to-teal-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 p-7 sm:p-8">
        {/* Cabeçalho */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 flex items-center justify-center text-3xl shadow-lg shadow-emerald-700/20 mb-3 text-white">
            <KeyRound className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Criar Nova Senha — Curiango
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xs">
            Escolha uma nova senha forte para proteger sua conta e as finanças da sua família.
          </p>
        </div>

        {/* Formulário de Redefinição */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMessage && (
            <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-xl font-medium animate-fade-in flex items-start gap-2 leading-relaxed">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl font-medium animate-fade-in flex items-start gap-2 leading-relaxed">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Campo Nova Senha */}
          <div>
            <Label htmlFor="new-password" className="text-xs font-semibold text-slate-700">
              Nova Senha
            </Label>
            <div className="relative mt-1">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="No mínimo 6 caracteres"
                className="pl-10 pr-10 h-11 rounded-xl"
                required
                autoFocus
                disabled={submitting || Boolean(successMessage)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                aria-label={showPassword ? 'Ocultar senha' : 'Ver senha'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Campo Confirmar Nova Senha */}
          <div>
            <Label htmlFor="confirm-new-password" className="text-xs font-semibold text-slate-700">
              Confirmar Nova Senha
            </Label>
            <div className="relative mt-1">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                id="confirm-new-password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
                className="pl-10 pr-10 h-11 rounded-xl"
                required
                disabled={submitting || Boolean(successMessage)}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                aria-label={showConfirmPassword ? 'Ocultar senha' : 'Ver senha'}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Botão Salvar Nova Senha */}
          <Button
            type="submit"
            disabled={submitting || Boolean(successMessage)}
            className="w-full h-11 mt-4 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-semibold rounded-xl shadow-md shadow-emerald-700/20 active:scale-98 transition-all"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Atualizando senha...</span>
              </span>
            ) : successMessage ? (
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>Senha Atualizada!</span>
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <span>Salvar Nova Senha</span>
                <ArrowRight className="w-4 h-4" />
              </span>
            )}
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
          <p className="text-[11px] text-slate-400">
            Curiango &bull; Gestão Financeira Familiar com isolamento e segurança.
          </p>
        </div>
      </div>
    </div>
  )
}
