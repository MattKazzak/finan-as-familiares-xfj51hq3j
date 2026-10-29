import React from 'react'
import { DocumentExplorerGrid, DocumentExplorerGridProps } from './DocumentExplorerGrid'

export interface DocumentFolderSectionProps {
  familyId: string
  currentUserId: string
  currentUserName: string
  isOpen?: boolean
  onToggle?: () => void
}

/**
 * Interface simplificada da Pasta de Documentos no Curiangoo (Perfil).
 * Atende o pedido do usuário: página limpa e branca, botão Adicionar bem visível
 * no topo e documentos exibidos em grade (matriz lado a lado que quebra para baixo,
 * como no Windows Explorer) com miniaturas e ações embaixo (compartilhar, visualizar, deletar).
 */
export const DocumentFolderSection: React.FC<DocumentFolderSectionProps> = ({
  familyId,
  currentUserId,
  currentUserName,
}) => {
  return (
    <section aria-label="Pasta de Documentos" className="w-full">
      <DocumentExplorerGrid
        familyId={familyId}
        currentUserId={currentUserId}
        currentUserName={currentUserName}
      />
    </section>
  )
}
