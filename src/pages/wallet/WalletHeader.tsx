import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, UploadCloud } from 'lucide-react'
import { formatMonthYear } from '@/lib/formatters'
import { useWallet } from './WalletContext'

export function WalletHeader() {
  const {
    activeTab,
    setActiveTab,
    currentDate,
    handlePrevMonth,
    handleNextMonth,
    openImportStatement,
  } = useWallet()
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

        {/* Coluna Central: Seletor de Mês & Botão de Importação sempre centralizados */}
        <div className="flex flex-col items-center gap-1.5 w-full justify-center">
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-2xl border border-slate-200/80 shadow-sm">
            <button
              onClick={handlePrevMonth}
              className="p-1 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
              title="Mês anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-bold text-xs sm:text-sm text-slate-800 px-2 min-w-[120px] text-center">
              {formatMonthYear(currentDate)}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
              title="Próximo mês"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

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
        </div>

        {/* Lado direito (espaçador para equilibrar no desktop em 3 colunas) */}
        <div className="hidden sm:block" aria-hidden="true" />
      </div>
    </div>
  )
}
