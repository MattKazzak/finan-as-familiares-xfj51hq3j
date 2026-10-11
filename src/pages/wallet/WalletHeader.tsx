import { useNavigate } from 'react-router-dom'
import { UploadCloud } from 'lucide-react'
import { MonthSelector } from '@/components/common/MonthSelector'
import { useWallet } from './WalletContext'

export function WalletHeader() {
  const { activeTab, setActiveTab, openImportStatement } = useWallet()
  const navigate = useNavigate()

  return (
    <div className="w-full">
      <div className="flex flex-col sm:grid sm:grid-cols-3 items-center gap-4 mb-4">
        {/* Lado esquerdo no desktop: Abas segmentadas */}
        <div className="w-full sm:w-auto flex justify-center sm:justify-start">
          <div className="bg-slate-100 p-1 rounded-2xl w-full sm:w-72 grid grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab('transacoes')
                navigate('/carteira', { replace: true })
              }}
              className={`rounded-xl font-semibold text-xs py-2 transition-all ${
                activeTab === 'transacoes'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Transações
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('orcamentos')
                navigate('/orcamentos', { replace: true })
              }}
              className={`rounded-xl font-semibold text-xs py-2 transition-all ${
                activeTab === 'orcamentos'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Orçamentos
            </button>
          </div>
        </div>

        {/* Coluna Central: Seletor ÚNICO de Mês Reutilizável & Botão de Importação */}
        <div className="flex flex-col items-center gap-1.5 w-full justify-center">
          <MonthSelector>
            {/* Botão de importação sempre visível logo abaixo da pílula de mês */}
            <button
              type="button"
              onClick={openImportStatement}
              className="inline-flex items-center justify-center gap-1.5 text-xs font-medium text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 px-3 py-1 rounded-xl transition-colors border border-emerald-200/60 bg-white/80 shadow-2xs active:scale-95 touch-manipulation"
              title="Importar extrato bancário (OFX ou PDF)"
            >
              <UploadCloud className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Importar OFX ou PDF</span>
            </button>
          </MonthSelector>
        </div>

        {/* Lado direito (espaçador para equilibrar no desktop em 3 colunas) */}
        <div className="hidden sm:block" aria-hidden="true" />
      </div>
    </div>
  )
}
