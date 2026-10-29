import React from 'react'
import { DocumentExplorerGrid, DocumentExplorerGridProps } from './DocumentExplorerGrid'

export interface DocumentFolderSectionProps {
  familyId: string
  currentUserId: string
  currentUserName: string
  isOpen?: boolean
  onToggle?: () => void
  showEmbeddedGrid?: boolean
}

/**
 * Item de Pasta de Documentos do Perfil.
 * Pode renderizar como item de acordeão que navega para a página dedicada /perfil/documentos
 * ou, se showEmbeddedGrid for verdadeiro, renderizar a grade completa.
 */
export const DocumentFolderSection: React.FC<DocumentFolderSectionProps> = ({
  familyId,
  currentUserId,
  currentUserName,
  showEmbeddedGrid = true,
}) => {
  if (showEmbeddedGrid) {
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

  return null
}
