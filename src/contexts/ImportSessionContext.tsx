import React, { createContext, useContext, useState, useEffect } from 'react'
import type { ReviewItem } from '@/components/transactions/ImportStatementDialog'

export interface ImportSessionData {
  items: ReviewItem[]
  fileInfo: { name: string; size: number; format: string } | null
  declaredTotalCents: number | null
  failedPages: number[]
  sourceRoute?: string
}

interface ImportSessionContextType {
  session: ImportSessionData | null
  setImportSession: (data: ImportSessionData | null) => void
  clearImportSession: () => void
}

const STORAGE_KEY = 'curiangoo_pending_import_review_v1'

const ImportSessionContext = createContext<ImportSessionContextType | undefined>(undefined)

export const ImportSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSessionState] = useState<ImportSessionData | null>(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY)
      if (stored) {
        return JSON.parse(stored) as ImportSessionData
      }
    } catch (e) {
      console.warn('Erro ao restaurar sessão de importação pendente:', e)
    }
    return null
  })

  const setImportSession = (data: ImportSessionData | null) => {
    setSessionState(data)
    try {
      if (data) {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data))
      } else {
        sessionStorage.removeItem(STORAGE_KEY)
      }
    } catch (e) {
      console.warn('Erro ao persistir sessão de importação pendente:', e)
    }
  }

  const clearImportSession = () => {
    setImportSession(null)
  }

  return (
    <ImportSessionContext.Provider value={{ session, setImportSession, clearImportSession }}>
      {children}
    </ImportSessionContext.Provider>
  )
}

export function useImportSession() {
  const ctx = useContext(ImportSessionContext)
  if (!ctx) {
    throw new Error('useImportSession must be used within an ImportSessionProvider')
  }
  return ctx
}
