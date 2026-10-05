import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getInvitePreview, acceptFamilyInvite } from '@/services/family'
import { useAuth } from '@/hooks/use-auth'
import { useFamily } from '@/hooks/use-family'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Users,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  UserPlus,
  LogIn,
  Lock,
  Mail,
  User as UserIcon,
  Eye,
  EyeOff,
} from 'lucide-react'
import { isEmailNotConfirmedError } from '@/pages/Login'
import { toast } from '@/hooks/use-toast'

export function InviteAcceptPage() {
  const { codigo } = useParams<{ codigo: string }>()
  const cleanCode = (codigo || '').trim().toUpperCase()
  const navigate = useNavigate()
  const { user, signUp, signIn } = useAuth()
  const { reloadFamily } = useFamily()

  const [loadingPreview, setLoadingPreview] = useState(true)
  const [inviteData, setInviteData] = useState<{
    valid: boolean
    family_name?: string
    expires_at?: string
    error?: string
  } | null>(null)

  // Estados para convidado deslogado se cadastrar ou logar
  const [mode, setMode] = useState<'signup' | 'login'>('signup')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      if (!cleanCode) {
        setInviteData({ valid: false, error: 'Código de convite não informado.' })
        setLoadingPreview(false)
        return
      }

      try {
        const preview = await getInvitePreview(cleanCode)
        if (mounted) {
          setInviteData(preview)
          // Salva em storage para garantir caso haja redirect de confirmação de e-mail
          if (preview.valid) {
            sessionStorage.setItem('curiangoo_pending_invite_code', cleanCode)
            localStorage.setItem('curiangoo_pending_invite_code', cleanCode)
          }
        }
      } catch (err: any) {
        if (mounted) {
          setInviteData({
            valid: false,
            error: err?.message || 'Não foi possível validar o convite.',
          })
        }
      } finally {
        if (mounted) setLoadingPreview(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [cleanCode])

  // Se o usuário JÁ ESTÁ AUTENTICADO: aceita o convite diretamente
  const handleAcceptLoggedIn = async () => {
    setActionLoading(true)
    setErrorMessage(null)
    try {
      const res = await acceptFamilyInvite(cleanCode)
      sessionStorage.removeItem('curiangoo_pending_invite_code')
      localStorage.removeItem('curiangoo_pending_invite_code')
      if (res?.member_id) {
        localStorage.setItem('financas_familiares_active_member_id', res.member_id)
      }
      await reloadFamily()
      toast({
        title: 'Convite aceito com sucesso!',
        description: `Você agora faz parte da família ${inviteData?.family_name || ''}.`,
      })
      navigate('/inicio', { replace: true })
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erro ao aceitar convite. Tente novamente.')
    } finally {
      setActionLoading(false)
    }
  }

  // Se o usuário NÃO ESTÁ AUTENTICADO e submete o formulário (Signup ou Login)
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

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
        setErrorMessage('As senhas não conferem.')
        return
      }

      setActionLoading(true)
      try {
        sessionStorage.setItem('curiangoo_pending_invite_code', cleanCode)
        localStorage.setItem('curiangoo_pending_invite_code', cleanCode)

        const { data, error } = await signUp(email.trim(), password, {
          name: name.trim(),
        })
        if (error) {
          setErrorMessage(error.message || 'Erro ao realizar cadastro.')
          return
        }

        // Se a sessão foi criada imediatamente (sem confirmação de e-mail obrigatória)
        if (data?.session) {
          try {
            const acceptRes = await acceptFamilyInvite(cleanCode)
            if (acceptRes?.member_id) {
              localStorage.setItem('financas_familiares_active_member_id', acceptRes.member_id)
            }
          } catch (accErr) {
            console.warn('Aceite de convite durante cadastro:', accErr)
          }
          await reloadFamily()
          navigate('/inicio', { replace: true })
          return
        }

        // Caso o Supabase exija confirmação de e-mail
        setSuccessMessage(
          'Conta criada com sucesso! Enviamos um e-mail de confirmação. Assim que confirmar, acesse o link para entrar na família.',
        )
      } catch (err: any) {
        setErrorMessage(err?.message || 'Falha ao criar conta. Verifique os dados.')
      } finally {
        setActionLoading(false)
      }
    } else {
      // Modo login para quem já tem conta
      setActionLoading(true)
      try {
        const { error } = await signIn(email.trim(), password)
        if (error) {
          if (isEmailNotConfirmedError(error)) {
            setErrorMessage('Seu cadastro ainda não foi ativado. Verifique seu e-mail.')
            return
          }
          setErrorMessage('E-mail ou senha incorretos.')
          return
        }

        try {
          const acceptRes = await acceptFamilyInvite(cleanCode)
          if (acceptRes?.member_id) {
            localStorage.setItem('financas_familiares_active_member_id', acceptRes.member_id)
          }
        } catch (accErr: any) {
          console.warn('Erro ao aceitar convite pós-login:', accErr)
        }
        await reloadFamily()
        navigate('/inicio', { replace: true })
      } catch {
        setErrorMessage('Erro de conexão. Tente novamente.')
      } finally {
        setActionLoading(false)
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-[#E5E5E5]/30 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-[#14213D]/10 border border-[#E5E5E5] p-6 sm:p-8">
        {/* Cabeçalho */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-[#E5E5E5] p-3 shadow-inner mb-3 flex items-center justify-center text-[#14213D]">
            <Users className="w-8 h-8" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-[#14213D] tracking-tight">
            Convite para Família
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Participe do planejamento e finanças no Curiangoo
          </p>
        </div>

        {/* Loading Preview */}
        {loadingPreview ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-500">
            <Loader2 className="w-7 h-7 animate-spin text-emerald-600" />
            <p className="text-xs">Consultando dados do convite...</p>
          </div>
        ) : !inviteData?.valid ? (
          /* Convite inválido ou expirado */
          <div className="space-y-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-800 text-xs sm:text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-1">Convite inválido</p>
                <p className="leading-relaxed">
                  {inviteData?.error || 'Este convite não foi encontrado ou expirou.'}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/login')}
              className="w-full h-11 rounded-xl text-xs font-semibold"
            >
              Ir para o Login
            </Button>
          </div>
        ) : (
          /* Convite Válido */
          <div className="space-y-5">
            {/* Cartão de Detalhes da Família */}
            <div className="p-4 bg-emerald-50/70 border border-emerald-100 rounded-2xl text-center">
              <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider block mb-1">
                Você foi convidado(a) para entrar na
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-emerald-950">
                {inviteData.family_name || 'Família'}
              </h2>
              <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/80 border border-emerald-200/60 rounded-full text-[11px] font-mono text-emerald-800">
                <span>Código:</span>
                <strong>{cleanCode}</strong>
              </div>
            </div>

            {/* SE O USUÁRIO JÁ ESTÁ LOGADO */}
            {user ? (
              <div className="space-y-4 pt-2">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
                  Conectado como <strong className="text-slate-900">{user.email}</strong>
                </div>

                {errorMessage && (
                  <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-xl font-medium">
                    {errorMessage}
                  </div>
                )}

                <Button
                  onClick={handleAcceptLoggedIn}
                  disabled={actionLoading}
                  className="w-full h-11 bg-[#FCA311] hover:bg-[#e08e08] text-[#14213D] font-bold rounded-xl shadow-md shadow-[#FCA311]/20 active:scale-98 transition-all text-xs sm:text-sm border-0"
                >
                  {actionLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <>
                      <span>Entrar nesta Família Agora</span>
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            ) : (
              /* SE O USUÁRIO NÃO ESTÁ LOGADO (CADASTRO OU LOGIN) */
              <div className="space-y-4">
                {/* Abas Criar Conta / Entrar */}
                <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signup')
                      setErrorMessage(null)
                      setShowPassword(false)
                      setShowConfirmPassword(false)
                    }}
                    className={`py-2 text-xs font-bold rounded-xl transition-all ${
                      mode === 'signup'
                        ? 'bg-white text-emerald-950 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Criar Conta
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login')
                      setErrorMessage(null)
                      setShowPassword(false)
                      setShowConfirmPassword(false)
                    }}
                    className={`py-2 text-xs font-bold rounded-xl transition-all ${
                      mode === 'login'
                        ? 'bg-white text-emerald-950 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Já tenho conta
                  </button>
                </div>

                {errorMessage && (
                  <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-xl font-medium leading-relaxed">
                    {errorMessage}
                  </div>
                )}

                {successMessage && (
                  <div className="p-3 text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl font-medium flex items-start gap-2 leading-relaxed">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{successMessage}</span>
                  </div>
                )}

                <form onSubmit={handleAuthSubmit} className="space-y-3.5">
                  {mode === 'signup' && (
                    <div>
                      <Label
                        htmlFor="convite-nome"
                        className="text-xs font-semibold text-slate-700"
                      >
                        Seu Nome
                      </Label>
                      <div className="relative mt-1">
                        <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <Input
                          id="convite-nome"
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Ex: Ana Maria"
                          className="pl-10 h-10 rounded-xl text-xs sm:text-sm"
                          required
                          autoFocus
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <Label htmlFor="convite-email" className="text-xs font-semibold text-slate-700">
                      Seu E-mail
                    </Label>
                    <div className="relative mt-1">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <Input
                        id="convite-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="seu.email@exemplo.com"
                        className="pl-10 h-10 rounded-xl text-xs sm:text-sm"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="convite-senha" className="text-xs font-semibold text-slate-700">
                      Senha
                    </Label>
                    <div className="relative mt-1">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <Input
                        id="convite-senha"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Mínimo 6 dígitos"
                        className="pl-10 pr-10 h-10 rounded-xl text-xs sm:text-sm"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-0 top-0 h-10 w-10 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-r-xl"
                        aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {mode === 'signup' && (
                    <div>
                      <Label
                        htmlFor="convite-confirma-senha"
                        className="text-xs font-semibold text-slate-700"
                      >
                        Confirmar Senha
                      </Label>
                      <div className="relative mt-1">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <Input
                          id="convite-confirma-senha"
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Repita a senha"
                          className="pl-10 pr-10 h-10 rounded-xl text-xs sm:text-sm"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword((prev) => !prev)}
                          className="absolute right-0 top-0 h-10 w-10 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-r-xl"
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
                  <Button
                    type="submit"
                    disabled={actionLoading}
                    className="w-full h-11 mt-2 bg-[#FCA311] hover:bg-[#e08e08] text-[#14213D] font-bold rounded-xl shadow-md shadow-[#FCA311]/20 active:scale-98 transition-all text-xs sm:text-sm border-0"
                  >
                    {actionLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : mode === 'signup' ? (
                      <span className="flex items-center gap-2">
                        <UserPlus className="w-4 h-4" />
                        <span>Criar Conta e Entrar na Família</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <LogIn className="w-4 h-4" />
                        <span>Entrar e Acessar a Família</span>
                      </span>
                    )}
                  </Button>
                </form>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-slate-100 text-center">
          <p className="text-[11px] text-slate-400">
            Validade de 7 dias • Acesso com isolamento por família (RLS)
          </p>
        </div>
      </div>
    </div>
  )
}
