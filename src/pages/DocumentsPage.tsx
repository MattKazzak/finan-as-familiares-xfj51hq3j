import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useFamily } from '@/hooks/use-family'
import { DocumentExplorerGrid } from '@/components/documents/DocumentExplorerGrid'
import { Button } from '@/components/ui/button'

/**
 * Página dedicada da Pasta de Documentos da Família (/perfil/documentos).
 * Estilo Windows Explorer limpo, mobile-first (360-412px), sem overflow horizontal.
 * Integrada ao ecossistema existente de segurança, upload, visualização e compartilhamento.
 */
export default function DocumentsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { family, currentMember } = useFamily()

  const userDisplayName =
    currentMember?.name ||
    (user?.user_metadata?.name as string) ||
    user?.email?.split('@')[0] ||
    'Usuário'

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      {/* Barra de navegação com botão voltar estilo CDS v1.0 */}
      <div className="flex items-center justify-between gap-3 pt-1 pb-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => navigate('/perfil')}
          className="text-xs font-semibold text-ink hover:bg-surface-2 rounded-xl h-9 px-3 gap-1.5 -ml-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar ao Perfil</span>
        </Button>
      </div>

      {family?.id ? (
        <DocumentExplorerGrid
          familyId={family.id}
          currentUserId={user?.id || ''}
          currentUserName={userDisplayName}
        />
      ) : (
        <div className="bg-surface rounded-3xl border border-line shadow-cds p-8 text-center text-body2">
          <p className="text-sm">Carregando família...</p>
        </div>
      )}
    </div>
  )
}
