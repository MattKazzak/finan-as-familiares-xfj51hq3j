import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Lock, Mail } from 'lucide-react'

export default function Login() {
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()

  const [isRegister, setIsRegister] = useState(false)
  const [email, setEmail] = useState('innexu1@gmail.com')
  const [password, setPassword] = useState('Skip@Pass')
  const [confirmPassword, setConfirmPassword] = useState('Skip@Pass')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!email || !password) {
      setErrorMessage('Preencha todos os campos.')
      return
    }

    if (isRegister && password !== confirmPassword) {
      setErrorMessage('As senhas não coincidem.')
      return
    }

    try {
      setLoading(true)
      if (isRegister) {
        const { error } = await signUp(email, password)
        if (error) {
          if (error.message?.includes('already registered')) {
            setErrorMessage('Este e-mail já está cadastrado. Faça login.')
          } else {
            setErrorMessage('Erro ao criar conta. Verifique os dados.')
          }
          return
        }
        // Sucesso no cadastro
        navigate('/inicio')
      } else {
        const { error } = await signIn(email, password)
        if (error) {
          setErrorMessage('E-mail ou senha incorretos.')
          return
        }
        navigate('/inicio')
      }
    } catch (err: any) {
      setErrorMessage('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/20 to-teal-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8">
        {/* Logo & Marca */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 flex items-center justify-center text-3xl shadow-lg shadow-emerald-700/20 mb-3 text-white">
            🌱
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Finanças da Família</h1>
          <p className="text-sm text-slate-500 mt-1 max-w-xs">
            {isRegister
              ? 'Crie a conta compartilhada para toda a família'
              : 'Acesso único compartilhado para gerenciar receitas, despesas e investimentos'}
          </p>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMessage && (
            <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-xl font-medium animate-fade-in">
              {errorMessage}
            </div>
          )}

          {/* E-mail */}
          <div>
            <Label htmlFor="login-email" className="text-xs font-semibold text-slate-700">
              E-mail da Família
            </Label>
            <div className="relative mt-1">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="exemplo@gmail.com"
                className="pl-10 h-11 rounded-xl"
                required
              />
            </div>
          </div>

          {/* Senha */}
          <div>
            <Label htmlFor="login-pass" className="text-xs font-semibold text-slate-700">
              Senha
            </Label>
            <div className="relative mt-1">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                id="login-pass"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pl-10 h-11 rounded-xl"
                required
              />
            </div>
          </div>

          {/* Confirmar Senha (apenas registro) */}
          {isRegister && (
            <div className="animate-fade-in">
              <Label htmlFor="login-pass-confirm" className="text-xs font-semibold text-slate-700">
                Confirmar Senha
              </Label>
              <div className="relative mt-1">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  id="login-pass-confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10 h-11 rounded-xl"
                  required
                />
              </div>
            </div>
          )}

          {/* Botão Principal com Gradiente */}
          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 mt-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-semibold rounded-xl shadow-md shadow-emerald-700/20 active:scale-98 transition-all"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : isRegister ? (
              'Criar Conta da Família'
            ) : (
              'Entrar'
            )}
          </Button>

          {/* Alternar Modo */}
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister)
                setErrorMessage(null)
              }}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 underline transition-colors"
            >
              {isRegister
                ? 'Já tem uma conta compartilhada? Entrar'
                : 'Não tem conta? Criar conta da família'}
            </button>
          </div>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
          <p className="text-[11px] text-slate-400">
            Dica: use as credenciais de teste já preenchidas para acesso instantâneo.
          </p>
        </div>
      </div>
    </div>
  )
}
