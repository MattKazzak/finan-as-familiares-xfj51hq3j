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
          <div className="bg-surface-2 p-1 rounded-2xl w-full sm:w-[26rem] grid grid-cols-3">
            <button
              type="button"
              onClick={() => {
                setActiveTab('transacoes')
                navigate('/carteira', { replace: true })
              }}
              className={`rounded-xl font-semibold text-xs py-2 transition-all ${
                activeTab === 'transacoes'
                  ? 'bg-surface text-income shadow-sm'
                  : 'text-body2 hover:text-ink'
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
                  ? 'bg-surface text-income shadow-sm'
                  : 'text-body2 hover:text-ink'
              }`}
            >
              Orçamentos
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('projecao')
                navigate('/carteira?aba=projecao', { replace: true })
              }}
              className={`rounded-xl font-semibold text-xs py-2 transition-all ${
                activeTab === 'projecao'
                  ? 'bg-surface text-income shadow-sm'
                  : 'text-body2 hover:text-ink'
              }`}
            >
              Projeção
            </button>
          </div>
        </div>

        {/* Coluna Central: Seletor ÚNICO de Mês Reutilizável */}
        <div className="flex flex-col items-center gap-1.5 w-full justify-center">
          <MonthSelector>
            {/* Importar é ação de TRANSAÇÕES — na aba Orçamentos não faz sentido
                (feedback real do dono 16/10). O botão só aparece na aba certa. */}
            {activeTab === 'transacoes' && (
              <button
                type="button"
                onClick={openImportStatement}
                className="inline-flex items-center justify-center gap-1.5 min-h-[34px] px-3 py-1.5 rounded-2xl text-xs font-semibold text-income hover:text-white bg-income-subtle hover:bg-income/30 border border-income/40 shadow-2xs transition-all active:scale-95 touch-manipulation cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action"
                title="Importar extrato bancário (OFX ou PDF)"
              >
                <UploadCloud className="w-3.5 h-3.5 text-income shrink-0" />
                <span>Importar extrato</span>
              </button>
            )}
          </MonthSelector>
        </div>

        {/* Lado direito (espaçador para equilibrar no desktop em 3 colunas) */}
        <div className="hidden sm:block" aria-hidden="true" />
      </div>
    </div>
  )
}
