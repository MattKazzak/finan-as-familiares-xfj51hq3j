import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import ProfilePage from '../Profile'

const mockTriggerInstall = vi.fn().mockResolvedValue(true)
let mockIsStandalone = false
let mockHasNativePrompt = true
let mockIsIos = false
let mockDeferredPrompt: unknown = {
  prompt: vi.fn().mockResolvedValue(undefined),
  userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
}

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: { email: 'familiasilva@exemplo.com' },
    signOut: vi.fn(),
  }),
}))

let mockMembers = [{ id: 'm-1', name: 'Lucas', is_admin: true }]

vi.mock('@/hooks/use-family', () => ({
  useFamily: () => ({
    family: { id: 'f-1', name: 'Silva', monthly_net_income_cents: 800000, avatar_url: null },
    members: mockMembers,
    categories: [],
    currentMember: mockMembers[0] || null,
    activeMemberId: mockMembers[0]?.id || null,
    setActiveMemberId: vi.fn(),
    openWhoIsUsing: vi.fn(),
    addMember: vi.fn(),
    editMember: vi.fn(),
    removeMember: vi.fn(),
    updateFamily: vi.fn(),
    uploadFamilyAvatar: vi.fn(),
    triggerRefresh: vi.fn(),
  }),
}))

vi.mock('@/hooks/use-pwa-install', () => ({
  usePwaInstall: () => ({
    isStandalone: mockIsStandalone,
    isIos: mockIsIos,
    hasNativePrompt: mockHasNativePrompt,
    deferredPrompt: mockDeferredPrompt,
    triggerInstall: mockTriggerInstall,
  }),
}))

vi.mock('@/components/wallet/ApplyBudgetModelDialog', () => ({
  ApplyBudgetModelDialog: () => null,
}))

describe('ProfilePage PWA Install Shortcut - 3 Cenários de Clique', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsStandalone = false
    mockHasNativePrompt = true
    mockIsIos = false
    mockDeferredPrompt = {
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
    }
    mockMembers = [{ id: 'm-1', name: 'Lucas', is_admin: true }]
  })

  it('exibe o botão "Convidar membro" para o admin da família e abre o modal de convite', async () => {
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    const inviteBtn = screen.getByRole('button', { name: /Convidar membro/i })
    expect(inviteBtn).toBeDefined()
    fireEvent.click(inviteBtn)

    expect(screen.getByText('Convidar Cônjuge ou Familiar')).toBeDefined()
    expect(screen.getByText(/Envie o código ou o link mágico/i)).toBeDefined()
  })

  it('exibe o botão "Entrar com código" e abre o diálogo de código de convite', () => {
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    const joinBtn = screen.getByRole('button', { name: /Entrar com código/i })
    expect(joinBtn).toBeDefined()
    fireEvent.click(joinBtn)

    expect(screen.getByText('Entrar em uma Família')).toBeDefined()
    expect(screen.getByPlaceholderText('Ex: CURI-XXXX')).toBeDefined()
  })

  it('esconde o quadro "Quem está usando este aparelho?" quando há apenas 1 membro', () => {
    mockMembers = [{ id: 'm-1', name: 'Lucas', is_admin: true }]

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    expect(screen.queryByText('Quem está usando este aparelho?')).toBeNull()
    expect(screen.queryByText(/Alterne para personalizar a saudação/i)).toBeNull()
  })

  it('exibe o quadro "Quem está usando este aparelho?" quando a família possui 2 ou mais membros', () => {
    mockMembers = [
      { id: 'm-1', name: 'Lucas', is_admin: true },
      { id: 'm-2', name: 'Beatriz', is_admin: false },
    ]

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    expect(screen.getByText('Quem está usando este aparelho?')).toBeDefined()
    expect(screen.getByText(/Alterne para personalizar a saudação/i)).toBeDefined()
    expect(screen.getByText('Lucas')).toBeDefined()
    expect(screen.getByText('Beatriz')).toBeDefined()
  })

  it('renders PWA install shortcut card when not standalone', () => {
    mockIsStandalone = false

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    expect(screen.getByText('📲 Instalar aplicativo no celular')).toBeDefined()
    expect(screen.getByText('Tenha acesso rápido direto da sua tela inicial')).toBeDefined()
  })

  it('hides PWA install shortcut card when app is running in standalone mode', () => {
    mockIsStandalone = true

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    expect(screen.queryByText('📲 Instalar aplicativo no celular')).toBeNull()
  })

  it('CENÁRIO A (Chrome / Edge / Android): if deferredPrompt exists, executes prompt immediately without opening instructions modal', async () => {
    mockIsStandalone = false
    mockDeferredPrompt = { prompt: vi.fn(), userChoice: Promise.resolve({ outcome: 'accepted' }) }
    mockHasNativePrompt = true
    mockIsIos = false

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    const installBtn = screen.getByRole('button', { name: /Instalar Agora/i })
    fireEvent.click(installBtn)

    expect(mockTriggerInstall).toHaveBeenCalled()
    // Garante que NENHUM modal de instruções foi aberto nesse cenário
    expect(screen.queryByText('Instalar no iPhone / iPad')).toBeNull()
    expect(screen.queryByText(/Toque no ícone de menu com/i)).toBeNull()
  })

  it('CENÁRIO B (iOS / iPhone / iPad): opens iOS specific modal showing Apple icon and Safari instructions', async () => {
    mockIsStandalone = false
    mockDeferredPrompt = null
    mockHasNativePrompt = false
    mockIsIos = true

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    const installBtn = screen.getByRole('button', { name: /Como Instalar/i })
    fireEvent.click(installBtn)

    expect(mockTriggerInstall).not.toHaveBeenCalled()
    expect(screen.getByText('Instalar no iPhone / iPad')).toBeDefined()
    expect(screen.getByText(/Compartilhar/i)).toBeDefined()
    expect(screen.getByText(/Adicionar à Tela de Início/i)).toBeDefined()
  })

  it('CENÁRIO C (Outros navegadores sem suporte ao prompt direto): opens dynamic instructions for 3-dots menu', async () => {
    mockIsStandalone = false
    mockDeferredPrompt = null
    mockHasNativePrompt = false
    mockIsIos = false

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    const installBtn = screen.getByRole('button', { name: /Instalar Aplicativo/i })
    fireEvent.click(installBtn)

    expect(mockTriggerInstall).not.toHaveBeenCalled()
    expect(screen.getByText('Instalar Curiangoo')).toBeDefined()
    expect(screen.getByText(/3 pontinhos/i)).toBeDefined()
    expect(screen.getByText(/Instalar aplicativo/i)).toBeDefined()
  })

  it('exibe a versão atualizada do app no rodapé', () => {
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    expect(
      screen.getByText(/Versão (0\.0\.\d+|1\.0\.\d+|1\.0) • Finanças Familiares/i),
    ).toBeDefined()
  })

  it('não possui botões ou lápis duplicados no card da família', () => {
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    // Deve existir apenas UM botão "Editar Família" no card
    const editFamilyButtons = screen.getAllByRole('button', { name: /Editar Família/i })
    expect(editFamilyButtons.length).toBe(1)
  })

  it('ao clicar no botão de voltar navega para a tela anterior com fallback', () => {
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    const backBtn = screen.getByRole('button', { name: 'Voltar' })
    expect(backBtn).toBeDefined()
    expect(() => fireEvent.click(backBtn)).not.toThrow()
  })

  it('renderiza o cabeçalho minimalista integrado com título "Perfil" e avatar no canto (estilo Instagram/Spotify)', () => {
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    // Título grande "Perfil" dentro da página
    const perfilHeading = screen.getByRole('heading', { level: 1, name: 'Perfil' })
    expect(perfilHeading).toBeDefined()
    expect(perfilHeading.className).toContain('text-2xl')
    expect(perfilHeading.className).toContain('font-semibold')
    expect(screen.getByText('Preferências pessoais e da família')).toBeDefined()

    // Botão de voltar no canto superior esquerdo (estilo Spotify)
    const backBtn = screen.getByRole('button', { name: 'Voltar' })
    expect(backBtn).toBeDefined()
    expect(screen.getByTestId('profile-back-button')).toBe(backBtn)

    // Avatar de atalho no canto superior direito da página
    const topAvatarBtn = screen.getByTestId('profile-top-avatar')
    expect(topAvatarBtn).toBeDefined()
    expect(topAvatarBtn.getAttribute('aria-label')).toBe('Minha conta')

    // Não deve existir lápis inline duplicado com title "Editar nome da família"
    expect(screen.queryByTitle('Editar nome da família')).toBeNull()
    // Nem botão duplicado de câmera sobreposto
    expect(screen.queryByTitle('Editar foto ou nome da família')).toBeNull()
  })

  it('renderiza o título da família sem classe truncate e com quebra responsiva', () => {
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    const titleEl = screen.getByRole('heading', { level: 2, name: 'Família Silva' })
    expect(titleEl).toBeDefined()
    expect(titleEl.className).not.toContain('truncate')
    expect(titleEl.className).toContain('break-words')
  })

  it('permite abrir o diálogo de edição da família com label "Nome da família", renomear e salvar', async () => {
    const mockUpdateFamily = vi.fn().mockResolvedValue({})
    const mockTriggerRefresh = vi.fn()

    // Atualiza mock do useFamily temporariamente para este teste
    const useFamilyModule = await import('@/hooks/use-family')
    const spy = vi.spyOn(useFamilyModule, 'useFamily').mockReturnValue({
      family: {
        id: 'f-1',
        name: 'Família Silva',
        monthly_net_income_cents: 800000,
        avatar_url: null,
      },
      members: [{ id: 'm-1', name: 'Lucas', is_admin: true }],
      categories: [],
      currentMember: { id: 'm-1', name: 'Lucas', is_admin: true },
      activeMemberId: 'm-1',
      setActiveMemberId: vi.fn(),
      openWhoIsUsing: vi.fn(),
      addMember: vi.fn(),
      editMember: vi.fn(),
      removeMember: vi.fn(),
      updateFamily: mockUpdateFamily,
      uploadFamilyAvatar: vi.fn(),
      triggerRefresh: mockTriggerRefresh,
    } as any)

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    // Clica no botão "Editar Família"
    const editBtn = screen.getByRole('button', { name: /Editar Família/i })
    fireEvent.click(editBtn)

    // Deve exibir o label correto "Nome da família"
    expect(screen.getByText('Nome da família')).toBeDefined()
    expect(screen.getByText('Editar Dados da Família')).toBeDefined()

    // Campo de input com valor prévio
    const input =
      screen.getByRole('textbox', { name: /Nome da família/i }) ||
      screen.getByLabelText(/Nome da família/i)
    fireEvent.change(input, { target: { value: 'Oliveira' } })

    const saveBtn = screen.getByRole('button', { name: /Salvar Alterações/i })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(mockUpdateFamily).toHaveBeenCalledWith({ name: 'Família Oliveira' })
      expect(mockTriggerRefresh).toHaveBeenCalled()
    })

    spy.mockRestore()
  })
})
