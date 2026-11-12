// Revisão em swipe (P2 — padrão Rocket Money, único no Brasil):
// fila de transações pendentes uma por vez em cards. Swipe right = aceitar a
// sugestão da IA; swipe left = trocar a categoria (abre o picker inline).
// No fim: "Fila zerada" + piu curto. Acessível também por teclado (setas).
// UX 18/10 (feedback do Matheus): estado "IA pensando" visível em qualquer
// ponto do deck, categoria › subcategoria legíveis (reasoning em linha própria,
// nunca cortando a gaveta escolhida) e botão Trocar com ícone de troca (não X,
// que parecia "fechar").
import { useState, useMemo, useRef, useEffect } from 'react'
import { Loader2, Sparkles, ArrowLeftRight, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CategoryIcon } from '@/components/common/CategoryIcon'
import { CuriangoLogo } from '@/components/brand/CuriangoLogo'
import { formatBRL } from '@/lib/formatters'
import { useWallet } from '@/pages/wallet/WalletContext'
import type { BudgetBucket } from '@/types/finance'

const BUCKET_GROUPS: { bucket: BudgetBucket; label: string }[] = [
  { bucket: 'essentials', label: 'Essenciais' },
  { bucket: 'lifestyle', label: 'Estilo de Vida' },
  { bucket: 'future', label: 'Futuro & Metas' },
]

export function SwipeReviewDeck() {
  const {
    pendingTransactionsList,
    pendingTotalCents,
    aiPendingSuggestions,
    categories,
    handleSaveInlineCategory,
    handleCategorizePendingWithAi,
    isCategorizingPendingWithAi,
  } = useWallet()

  const [index, setIndex] = useState(0)
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [selectedCatId, setSelectedCatId] = useState('')
  const [saving, setSaving] = useState(false)
  const [resolvedCount, setResolvedCount] = useState(0)
  const startX = useRef(0)
  const resolvedIds = useRef<Set<string>>(new Set())

  // Fila: pendentes do mês (a sugestão IA, se houver, vem do map)
  const queue = useMemo(
    () => pendingTransactionsList.filter((tx) => !resolvedIds.current.has(tx.id)),
    [pendingTransactionsList],
  )
  const current = queue[index] || null
  const suggestion = current ? aiPendingSuggestions[current.id] || null : null

  // Reset do índice quando a fila muda
  useEffect(() => {
    if (index > queue.length) setIndex(0)
  }, [queue.length, index])

  const suggestedCategory = useMemo(() => {
    if (!suggestion?.categoryId) return null
    return categories.find((c) => c.id === suggestion.categoryId) || null
  }, [suggestion, categories])

  const suggestedSubcategory = useMemo(() => {
    if (!suggestion?.subcategoryId || !suggestedCategory?.subcategories) return null
    return suggestedCategory.subcategories.find((s) => s.id === suggestion.subcategoryId) || null
  }, [suggestion, suggestedCategory])

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.type === (current?.type || 'expense')),
    [categories, current],
  )

  const categorizedByBucket = useMemo(() => {
    if ((current?.type || 'expense') !== 'expense') return null
    const groups: Record<BudgetBucket, typeof filteredCategories> = {
      essentials: [],
      lifestyle: [],
      future: [],
    }
    filteredCategories.forEach((cat) => {
      const b = (cat.budget_bucket as BudgetBucket) || 'lifestyle'
      if (groups[b]) groups[b].push(cat)
      else groups.lifestyle.push(cat)
    })
    return groups
  }, [filteredCategories, current])

  const advance = () => {
    if (current) resolvedIds.current.add(current.id)
    setDragX(0)
    setPickerOpen(false)
    setSelectedCatId('')
    setIndex((i) => i + 1)
    setResolvedCount((c) => c + 1)
  }

  const accept = async () => {
    if (!current || !suggestion?.categoryId) return
    try {
      setSaving(true)
      await handleSaveInlineCategory({
        transactionId: current.id,
        categoryId: suggestion.categoryId,
        subcategoryId: suggestion.subcategoryId || null,
        rememberRule: true,
        description: current.description || 'Transação',
      })
      advance()
    } finally {
      setSaving(false)
    }
  }

  const saveManual = async () => {
    if (!current || !selectedCatId) return
    try {
      setSaving(true)
      await handleSaveInlineCategory({
        transactionId: current.id,
        categoryId: selectedCatId,
        subcategoryId: null,
        rememberRule: true,
        description: current.description || 'Transação',
      })
      advance()
    } finally {
      setSaving(false)
    }
  }

  // ===== Gestos (touch + mouse) =====
  const onPointerDown = (e: React.PointerEvent) => {
    if (pickerOpen || saving) return
    setDragging(true)
    startX.current = e.clientX
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return
    setDragX(e.clientX - startX.current)
  }
  const onPointerUp = () => {
    if (!dragging) return
    setDragging(false)
    if (dragX > 90) {
      void accept()
    } else if (dragX < -90) {
      setPickerOpen(true)
      setDragX(0)
    } else {
      setDragX(0)
    }
  }

  // ===== Teclado (acessibilidade) =====
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (pickerOpen || saving || !current) return
      if (e.key === 'ArrowRight') void accept()
      if (e.key === 'ArrowLeft') {
        setPickerOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (queue.length === 0) {
    if (resolvedCount === 0) return null // não abre sem fila
    return (
      <div className="rounded-3xl border border-emerald-200/80 bg-emerald-50/70 p-4 flex flex-col items-center gap-2 text-center">
        <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center">
          <Check className="w-5 h-5 stroke-[2.5]" />
        </div>
        <p className="text-sm font-bold text-emerald-900">Fila zerada!</p>
        <p className="text-xs text-emerald-700">
          Você revisou {resolvedCount} {resolvedCount === 1 ? 'transação' : 'transações'}.
        </p>
        <CuriangoLogo size={24} eyeColor="#101217" eyeHighlight />
      </div>
    )
  }

  // ===== Estado vazio (fila nunca abriu): o deck é o ÚNICO bloco de revisão =====
  // (banner antigo "Lançamentos Pendentes" removido — era redundância, 2 caminhos
  // pro mesmo destino. Tudo vive aqui: contagem, total, IA e filtro.)
  if (!current) {
    return (
      <div className="rounded-3xl border border-violet-200/80 bg-violet-50/40 p-4 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-violet-600 text-white flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-violet-900">
              {queue.length} {queue.length === 1 ? 'transação pendente' : 'transações pendentes'} ·{' '}
              {formatBRL(pendingTotalCents)}
            </p>
            <p className="text-[11px] text-violet-700">
              Sem categoria neste mês. Revise uma por vez ou use a IA.
            </p>
          </div>
        </div>
        {isCategorizingPendingWithAi ? (
          <div className="flex items-center justify-center gap-2 rounded-xl bg-violet-100/70 px-3 py-2.5">
            <Loader2 className="w-4 h-4 animate-spin text-violet-700" />
            <p className="text-xs font-semibold text-violet-800">
              Curiango pensando nas sugestões…
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleCategorizePendingWithAi}
              disabled={isCategorizingPendingWithAi}
              className="rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-700 text-white h-9 flex-1 gap-1.5 border-0"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>✨ Categorizar com IA</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIndex(0)}
              className="rounded-xl text-xs font-semibold h-9 border-violet-300 text-violet-800 hover:bg-violet-100"
            >
              Começar revisão
            </Button>
          </div>
        )}
      </div>
    )
  }

  if (!current) return null

  const isIncome = current.type === 'income'
  const rotation = Math.max(-8, Math.min(8, dragX / 18))

  return (
    <div className="rounded-3xl border border-violet-200/80 bg-violet-50/40 p-4 space-y-3">
      {/* Header da fila */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-600" />
          <p className="text-xs font-bold text-violet-900">
            Revisar {queue.length - index} {queue.length - index === 1 ? 'transação' : 'transações'}
          </p>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-violet-600 font-medium">
          <span>← trocar · aceitar →</span>
        </div>
      </div>

      {/* Card com swipe */}
      <div className="relative select-none touch-pan-y" style={{ perspective: 800 }}>
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          className="bg-white rounded-2xl border border-violet-200 p-4 shadow-lg cursor-grab active:cursor-grabbing"
          style={{
            transform: `translateX(${dragX}px) rotate(${rotation}deg)`,
            transition: dragging ? 'none' : 'transform 200ms ease-out',
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: suggestedCategory?.color || '#F59E0B', color: '#fff' }}
              >
                {suggestedCategory?.icon ? (
                  <CategoryIcon name={suggestedCategory.icon} className="w-5 h-5" />
                ) : (
                  <Sparkles className="w-5 h-5" />
                )}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-sm text-slate-900 truncate">
                  {current.description || 'Transação'}
                </p>
                {suggestedCategory ? (
                  <>
                    {/* Gaveta escolhida em linha própria — NUNCA cortada (feedback 18/10) */}
                    <p className="text-xs font-bold text-slate-800 leading-snug">
                      <span className="text-violet-700">✨ IA:</span> {suggestedCategory.name}
                      {suggestedSubcategory ? (
                        <span className="text-slate-600"> › {suggestedSubcategory.name}</span>
                      ) : null}
                    </p>
                    {suggestion.reasoning ? (
                      <p className="text-[11px] text-slate-500 leading-snug line-clamp-2">
                        {suggestion.reasoning}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p className="text-[11px] text-slate-500 truncate">
                    Sem sugestão da IA — escolha a categoria
                  </p>
                )}
              </div>
            </div>
            <span
              className={`font-bold text-sm tabular-nums shrink-0 ${
                isIncome ? 'text-income' : 'text-expense'
              }`}
            >
              {isIncome ? '+' : '−'} {formatBRL(current.amount_cents)}
            </span>
          </div>

          {/* Indicadores de swipe */}
          <div className="mt-3 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
            <span
              className="text-expense transition-opacity"
              style={{ opacity: dragX < -30 ? 1 : 0.25 }}
            >
              ← trocar
            </span>
            <span
              className="text-income transition-opacity"
              style={{ opacity: dragX > 30 ? 1 : 0.25 }}
            >
              aceitar →
            </span>
          </div>
        </div>
      </div>

      {/* Picker inline (abre no swipe left) */}
      {pickerOpen ? (
        <div className="bg-white rounded-2xl border border-violet-200 p-3 space-y-2">
          <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
            Escolher categoria
          </p>
          <div className="max-h-52 overflow-y-auto space-y-1.5">
            {categorizedByBucket
              ? BUCKET_GROUPS.map(({ bucket, label }) => {
                  const list = categorizedByBucket[bucket] || []
                  if (list.length === 0) return null
                  return (
                    <div key={bucket}>
                      <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider px-1 py-0.5">
                        {label}
                      </p>
                      {list.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setSelectedCatId(c.id)}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-xl text-xs transition-colors ${
                            selectedCatId === c.id
                              ? 'bg-violet-100 text-violet-900 font-bold'
                              : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div
                            className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                            style={{ backgroundColor: c.color || '#10B981', color: '#fff' }}
                          >
                            <CategoryIcon name={c.icon} className="w-3 h-3" />
                          </div>
                          <span className="font-semibold">{c.name}</span>
                          {/* Regra curta (catálogo v3): a intenção visível — o usuário
                              entende a fronteira sem precisar de manual */}
                          {c.intent_tag ? (
                            <span className="text-[10px] text-slate-400 leading-tight line-clamp-1">
                              {c.intent_tag}
                            </span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  )
                })
              : filteredCategories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCatId(c.id)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-xl text-xs transition-colors ${
                      selectedCatId === c.id
                        ? 'bg-violet-100 text-violet-900 font-bold'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div
                      className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                      style={{ backgroundColor: c.color || '#10B981', color: '#fff' }}
                    >
                      <CategoryIcon name={c.icon} className="w-3 h-3" />
                    </div>
                    <span className="font-semibold">{c.name}</span>
                    {c.intent_tag ? (
                      <span className="text-[10px] text-slate-400 leading-tight line-clamp-1">
                        {c.intent_tag}
                      </span>
                    ) : null}
                  </button>
                ))}
          </div>{' '}
          <div className="flex items-center gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setPickerOpen(false)}
              className="rounded-xl text-xs h-8"
            >
              Voltar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={saveManual}
              disabled={!selectedCatId || saving}
              className="rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-700 text-white h-8 flex-1 gap-1.5 border-0"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span>Salvar</span>
            </Button>
          </div>
        </div>
      ) : (
        /* Botões (fallback p/ quem não descobre o swipe) */
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPickerOpen(true)}
            disabled={saving}
            className="rounded-xl text-xs font-bold h-9 flex-1 gap-1.5 border-expense/30 text-expense hover:bg-rose-50"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>Trocar</span>
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={accept}
            disabled={saving || !suggestion?.categoryId}
            className="rounded-xl text-xs font-bold h-9 flex-1 gap-1.5 bg-income hover:bg-emerald-700 text-white border-0"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            )}
            <span>Aceitar sugestão</span>
          </Button>
        </div>
      )}

      {/* Estado da IA: pensando (spinner SEMPRE visível) ou convite pra pedir sugestões */}
      {isCategorizingPendingWithAi ? (
        <div className="flex items-center justify-center gap-2 rounded-xl bg-violet-100/70 px-3 py-2.5">
          <Loader2 className="w-4 h-4 animate-spin text-violet-700" />
          <p className="text-xs font-semibold text-violet-800">Curiango pensando nas sugestões…</p>
        </div>
      ) : !suggestion ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleCategorizePendingWithAi}
          className="rounded-xl text-xs text-violet-700 hover:text-violet-900 h-8 w-full gap-1.5"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Pedir sugestões da IA pra fila</span>
        </Button>
      ) : null}
    </div>
  )
}
