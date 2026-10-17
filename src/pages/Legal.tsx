// Páginas legais e institucionais do Curiangoo — públicas, sem auth.
// Conteúdo jurídico é rascunho: revisar com advogado antes do lançamento comercial.
import { ArrowLeft, HelpCircle, Mail, ChevronDown } from 'lucide-react'
import { useNavigate, Link } from 'react-router-dom'
import { useState, type ReactNode } from 'react'
import { CuriangoLogo } from '@/components/brand/CuriangoLogo'

function LegalShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      <header className="bg-[#14213D] text-white px-4 pt-12 pb-6 sm:pt-14">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-xs font-medium text-white/70 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center p-1.5">
              <CuriangoLogo size={24} color="#FCA311" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">{title}</h1>
              <p className="text-xs text-white/60">{subtitle}</p>
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">{children}</main>
      <footer className="max-w-2xl mx-auto px-4 pb-10 pt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
        <span>© {new Date().getFullYear()} Curiangoo</span>
        <Link to="/privacidade" className="hover:text-slate-600">
          Privacidade
        </Link>
        <Link to="/termos" className="hover:text-slate-600">
          Termos
        </Link>
        <Link to="/faq" className="hover:text-slate-600">
          FAQ
        </Link>
        <Link to="/contato" className="hover:text-slate-600">
          Fale conosco
        </Link>
      </footer>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-[#14213D]/[0.06] shadow-elevation-1 p-5">
      <h2 className="text-sm font-bold text-[#14213D] mb-2">{title}</h2>
      <div className="text-xs text-slate-600 leading-relaxed space-y-2">{children}</div>
    </section>
  )
}

export function PrivacyPage() {
  return (
    <LegalShell title="Política de Privacidade" subtitle="Como tratamos os dados da sua família">
      <Section title="Dados que coletamos">
        <p>
          <strong>Dados de conta:</strong> nome e e-mail, usados para autenticação.
        </p>
        <p>
          <strong>Dados financeiros:</strong> transações, categorias, metas, orçamentos e
          investimentos que você lança — pertencentes à sua família e visíveis apenas a ela.
        </p>
        <p>
          <strong>Copilot de voz:</strong> o áudio é processado em tempo real para transcrição e{' '}
          <strong>não é armazenado</strong> pelo Curiangoo. O texto das conversas fica salvo no
          histórico do seu chat.
        </p>
        <p>
          <strong>Extratos importados:</strong> usados apenas para extrair as transações; o arquivo
          original não é guardado.
        </p>
      </Section>
      <Section title="Como usamos">
        <p>• Exibir e organizar as finanças da sua família.</p>
        <p>• Categorizar lançamentos automaticamente com inteligência artificial.</p>
        <p>• Nunca vendemos seus dados. Nunca usamos para publicidade.</p>
      </Section>
      <Section title="Serviços de terceiros">
        <p>
          <strong>OpenAI</strong> — processa voz e texto do Copilot (transcrição e categorização).
        </p>
        <p>
          <strong>Supabase</strong> — hospeda o banco de dados com criptografia e isolamento por
          família (Row Level Security).
        </p>
      </Section>
      <Section title="Seus direitos (LGPD)">
        <p>
          Você pode acessar, corrigir e excluir seus dados a qualquer momento: a exclusão da família
          está no Perfil, e a exclusão da conta pode ser solicitada em Fale Conosco.
        </p>
        <p>
          Dúvidas de privacidade: <strong>contato@curiangoo.com</strong>
        </p>
      </Section>
      <Section title="Retenção de dados">
        <p>
          Os dados da sua família existem enquanto sua conta existir. Famílias criadas e abandonadas
          sem uso por mais de 14 dias são removidas automaticamente. Ao excluir a conta, os dados
          são removidos em até 30 dias.
        </p>
      </Section>
      <p className="text-[11px] text-slate-400 px-1">Última atualização: outubro de 2026.</p>
    </LegalShell>
  )
}

export function TermsPage() {
  return (
    <LegalShell title="Termos de Uso" subtitle="As regras do jogo, sem juridiquês">
      <Section title="O que é o Curiangoo">
        <p>
          Ferramenta de organização financeira familiar. O Curiangoo <strong>não</strong> é
          consultoria de investimentos, não dá recomendações de compra/venda e não é regulado pela
          CVM ou pelo Banco Central — somos um caderno inteligente das suas contas.
        </p>
      </Section>
      <Section title="Sua responsabilidade">
        <p>
          Os lançamentos são feitos por você. Confira os extratos importados antes de confirmar — a
          leitura automática é auxiliar e pode cometer erros de categorização.
        </p>
        <p>O administrador da família responde pelos dados lançados pelos membros convidados.</p>
      </Section>
      <Section title="Assinatura e cancelamento">
        <p>
          Os planos, preços e limites estão na tela de assinatura. Você pode cancelar a qualquer
          momento, e tem direito a reembolso integral em até 7 dias da contratação (Código de Defesa
          do Consumidor, art. 49).
        </p>
      </Section>
      <Section title="Disponibilidade">
        <p>
          Buscamos 99,9% de disponibilidade, mas o serviço pode ficar temporariamente indisponível
          para manutenção. Seus dados não são perdidos por indisponibilidades.
        </p>
      </Section>
      <Section title="Encerramento de conta">
        <p>
          Contas que violem estes termos (uso fraudulento, tentativa de acesso a dados de outras
          famílias) podem ser suspensas. Você pode encerrar a conta quando quiser.
        </p>
      </Section>
      <p className="text-[11px] text-slate-400 px-1">Última atualização: outubro de 2026.</p>
    </LegalShell>
  )
}

const FAQ_ITEMS: Array<{ q: string; a: string }> = [
  {
    q: 'O que são os 3 Baldes?',
    a: 'É o jeito simples de organizar o dinheiro: Baldes Essenciais (contas fixas, mercado, saúde), Estilo de Vida (restaurante, lazer, compras) e Metas & Investimentos (o que sobra pro futuro). Cada gasto cai num balde, e você vê na hora se está estourando.',
  },
  {
    q: 'Como funciona o Copilot de voz?',
    a: 'Toque no botão do Curiangoo, fale como fala com um amigo — "gastei 45 no almoço" — e ele lança tudo: valor, categoria e data. Ele também responde perguntas: "quanto gastei este mês?".',
  },
  {
    q: 'Meus dados financeiros estão seguros?',
    a: 'Sim. Cada família vive num espaço isolado: nenhum usuário acessa dados de outra família, nem por engano. Os dados trafegam criptografados e o acesso é validado em cada consulta.',
  },
  {
    q: 'Como convido minha família?',
    a: 'Perfil → Convidar membro. Você recebe um código e um link — envia pra quem quiser (até 5 pessoas). A pessoa entra com o próprio login e escolhe o nome dela.',
  },
  {
    q: 'Posso usar em mais de um celular?',
    a: 'Pode. Seu login funciona em qualquer aparelho. Em cada celular você escolhe "quem está usando" — assim o extrato de cada um fica separado.',
  },
  {
    q: 'Como importo minha fatura de cartão?',
    a: 'Carteira → botão de importar. Aceita PDF da fatura (Nubank, Inter, Itaú e outros) e arquivo OFX do banco. A IA lê, separa as compras e sugere as categorias — você só confirma.',
  },
  {
    q: 'Por que a IA erra a categoria de um gasto?',
    a: 'Ela aprende com o histórico da sua família. Nos primeiros dias pode confundir — corrija tocando no lançamento, e ela acerta nas próximas vezes.',
  },
  {
    q: 'Funciona no iPhone?',
    a: 'Funciona como app instalado: abra no Safari e toque em Compartilhar → "Adicionar à Tela de Início". No Android, o botão "Instalar" aparece sozinho.',
  },
  {
    q: 'Preciso de internet?',
    a: 'Para lançar e consultar, sim — o app é leve e rápido mesmo com sinal fraco. Estamos trabalhando em modo offline para os próximos meses.',
  },
]

export function FaqPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)
  return (
    <LegalShell title="Perguntas frequentes" subtitle="Tudo que você precisa saber">
      <div className="space-y-2">
        {FAQ_ITEMS.map((item, i) => (
          <div
            key={i}
            className="bg-white rounded-2xl border border-[#14213D]/[0.06] shadow-elevation-1 overflow-hidden"
          >
            <button
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
              aria-expanded={openIndex === i}
            >
              <span className="text-sm font-semibold text-[#14213D]">{item.q}</span>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                  openIndex === i ? 'rotate-180' : ''
                }`}
              />
            </button>
            {openIndex === i && (
              <div className="px-5 pb-4 text-xs text-slate-600 leading-relaxed animate-fade-in">
                {item.a}
              </div>
            )}
          </div>
        ))}
      </div>
      <Link
        to="/contato"
        className="flex items-center justify-center gap-2 py-3 text-xs font-semibold text-[#14213D] hover:text-[#FCA311] transition-colors"
      >
        <HelpCircle className="w-4 h-4" />
        Não achou sua resposta? Fale com a gente
      </Link>
    </LegalShell>
  )
}

export function ContactPage() {
  const [sent, setSent] = useState(false)
  return (
    <LegalShell title="Fale conosco" subtitle="Respondemos em até 48h úteis">
      <Section title="Canais de atendimento">
        <p className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-[#FCA311]" />
          <strong>contato@curiangoo.com</strong>
        </p>
        <p className="text-[11px] text-slate-500">
          Para questões de privacidade e LGPD: privacidade@curiangoo.com
        </p>
      </Section>
      <Section title="Antes de escrever">
        <p>
          Dúvidas de uso costumam estar no{' '}
          <Link to="/faq" className="text-[#FCA311] font-semibold">
            FAQ
          </Link>{' '}
          — é mais rápido por lá.
        </p>
        <p>
          Se é um bug, descreva o que fez, o que esperava e o que aconteceu. Se puder, mande um
          print — ajuda demais.
        </p>
      </Section>
      {sent ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-sm text-emerald-900 font-medium">
          Mensagem enviada! Vamos te responder no seu e-mail em até 48h úteis. 💛
        </div>
      ) : (
        <form
          className="bg-white rounded-2xl border border-[#14213D]/[0.06] shadow-elevation-1 p-5 space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            // MVP: mailto direto — trocar por Edge Function de e-mail no lançamento
            const form = e.target as HTMLFormElement
            const nome = (form.elements.namedItem('nome') as HTMLInputElement)?.value || ''
            const assunto = (form.elements.namedItem('assunto') as HTMLInputElement)?.value || ''
            const msg = (form.elements.namedItem('mensagem') as HTMLTextAreaElement)?.value || ''
            window.location.href = `mailto:contato@curiangoo.com?subject=${encodeURIComponent(
              `[Curiangoo] ${assunto} — ${nome}`,
            )}&body=${encodeURIComponent(msg)}`
            setSent(true)
          }}
        >
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Seu nome</label>
            <input
              name="nome"
              required
              className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#FCA311]/40 focus:border-[#FCA311]"
              placeholder="Como podemos te chamar?"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Assunto</label>
            <input
              name="assunto"
              required
              className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#FCA311]/40 focus:border-[#FCA311]"
              placeholder="Dúvida, bug ou sugestão"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Mensagem</label>
            <textarea
              name="mensagem"
              required
              rows={5}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#FCA311]/40 focus:border-[#FCA311] resize-none"
              placeholder="Conta pra gente o que precisa..."
            />
          </div>
          <button
            type="submit"
            className="w-full h-12 bg-[#FCA311] hover:bg-[#e08e08] text-[#14213D] font-bold rounded-xl shadow-elevation-1 active:scale-[0.99] transition-all text-sm"
          >
            Enviar mensagem
          </button>
        </form>
      )}
    </LegalShell>
  )
}
