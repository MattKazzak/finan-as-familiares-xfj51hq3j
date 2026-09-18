// Testes unitários para o parser robusto de extratos (PDF, OFX e CSV)
// Valida faturas bancárias reais brasileiras (Rico, Nubank, Itaú, Bradesco, Inter)

import { describe, it, expect } from 'vitest'
import {
  parseAmount,
  parseDate,
  isNoiseLine,
  parsePDFText,
  parseCSV,
  parseOFX,
  reconstructLinesFromPositionedItems,
} from '@/services/import/statement-parser'
import { predictCategory } from '@/services/import/categorization'
import type { TransactionCategory } from '@/types/finance'

describe('statement-parser unit tests', () => {
  describe('parseAmount', () => {
    it('lê valores no formato brasileiro com vírgula e ponto', () => {
      expect(parseAmount('1.234,56')).toEqual({ amountCents: 123456, type: 'income' })
      expect(parseAmount('R$ 4.178,98')).toEqual({ amountCents: 417898, type: 'income' })
      expect(parseAmount('148,00')).toEqual({ amountCents: 14800, type: 'income' })
      expect(parseAmount('0,38')).toEqual({ amountCents: 38, type: 'income' })
    })

    it('identifica valores negativos como despesa (expense)', () => {
      expect(parseAmount('-1.234,56')).toEqual({ amountCents: 123456, type: 'expense' })
      expect(parseAmount('(148,00)')).toEqual({ amountCents: 14800, type: 'expense' })
      expect(parseAmount('50,00-')).toEqual({ amountCents: 5000, type: 'expense' })
      expect(parseAmount('45,90 D')).toEqual({ amountCents: 4590, type: 'expense' })
    })

    it('ignora valores zerados ou inválidos', () => {
      expect(parseAmount('0,00')).toBeNull()
      expect(parseAmount('abc')).toBeNull()
      expect(parseAmount('')).toBeNull()
    })
  })

  describe('parseDate', () => {
    it('converte datas DD/MM/AAAA para YYYY-MM-DD', () => {
      expect(parseDate('30/09/2026')).toBe('2026-09-30')
      expect(parseDate('15/03/2026')).toBe('2026-03-15')
    })

    it('rejeita anos absurdos ou fora do século plausível', () => {
      expect(parseDate('15/03/1990')).toBeNull() // anterior a 2000
      expect(parseDate('15/03/2099')).toBeNull() // futuro distante
      expect(parseDate('99/99/2026')).toBeNull() // dia/mês inválidos
      expect(parseDate('31/02/2026')).toBeNull() // fevereiro não tem 31 dias
    })

    it('converte datas no formato YYYYMMDD de OFX', () => {
      expect(parseDate('20260930')).toBe('2026-09-30')
    })
  })

  describe('isNoiseLine', () => {
    it('detecta rodapé de telefones e atendimento (caso real Rico reportado pelo usuário)', () => {
      const line = '+ 55 11 4935-2740 (Auto atendimento via WhatsApp) + 55 11 3003-5465'
      expect(isNoiseLine(line).isNoise).toBe(true)
    })

    it('detecta cabeçalho de fatura com titular e resumo (caso real Rico reportado pelo usuário)', () => {
      const line =
        'Titular MATHEUS KAZMIERCZAK BERCA Endereço RUA FRANCELINA F DOS SANTOS ... Vencimento Resumo da sua fatura Cartão Rico Rico Visa Infinite Total da fatura'
      expect(isNoiseLine(line).isNoise).toBe(true)
    })

    it('detecta linhas de 0800, SAC e ouvidoria', () => {
      expect(isNoiseLine('SAC 0800 774 0404 Ouvidoria').isNoise).toBe(true)
      expect(isNoiseLine('Central de Atendimento 4004-3535').isNoise).toBe(true)
    })

    it('detecta URLs e links bancários', () => {
      expect(isNoiseLine('Acesse www.rico.com.vc para mais informações').isNoise).toBe(true)
    })

    it('não considera uma transação real como ruído', () => {
      expect(isNoiseLine('30/09/2026 Salário Posto Vereda 3.488,48').isNoise).toBe(false)
      expect(isNoiseLine('30/09/2026 Água 148,00').isNoise).toBe(false)
      expect(isNoiseLine('15/03/2026 Supermercado Carrefour 250,90').isNoise).toBe(false)
    })
  })

  describe('parsePDFText — Fatura Cartão Rico (Caso Real do Usuário)', () => {
    it('ignora cabeçalho e rodapé e extrai apenas transações reais com tipo expense na fatura', () => {
      // Amostra que replica fielmente o arquivo que gerou o bug no banco
      const samplePdfText = `
Titular MATHEUS KAZMIERCZAK BERCA Endereço RUA FRANCELINA F DOS SANTOS Vencimento 10/10/2026 Resumo da sua fatura Cartão Rico Rico Visa Infinite Total da fatura R$ 1.476,12
Limite total R$ 15.000,00 Limite disponível R$ 13.523,88
Data Estabelecimento / Lançamento Valor
30/09/2026 Salário Posto Vereda 3.488,48
30/09/2026 Água 148,00
15/09/2026 Mercado Extra 320,50
+ 55 11 4935-2740 (Auto atendimento via WhatsApp) + 55 11 3003-5465 Capitais e regiões metropolitanas 0800 774 0404 Ouvidoria
Acesse www.rico.com.vc
`
      const result = parsePDFText(samplePdfText)

      expect(result.success).toBe(true)
      // Deve extrair exatamente as transações válidas e descartar cabeçalho e rodapé
      expect(result.transactions.length).toBe(3)

      // 1. Salário Posto Vereda
      const sal = result.transactions.find((t) => t.description.includes('Salário Posto Vereda'))
      expect(sal).toBeDefined()
      expect(sal?.amount_cents).toBe(348848)
      expect(sal?.date).toBe('2026-09-30')
      expect(sal?.type).toBe('income') // Salário é reconhecido como income

      // 2. Água
      const agua = result.transactions.find((t) => t.description.includes('Água'))
      expect(agua).toBeDefined()
      expect(agua?.amount_cents).toBe(14800)
      expect(agua?.date).toBe('2026-09-30')
      expect(agua?.type).toBe('expense') // Fatura de cartão classifica compra como expense

      // 3. Mercado Extra
      const mercado = result.transactions.find((t) => t.description.includes('Mercado Extra'))
      expect(mercado).toBeDefined()
      expect(mercado?.amount_cents).toBe(32050)
      expect(mercado?.type).toBe('expense')

      // Garantir que as linhas de rodapé e cabeçalho NUNCA viraram transações
      const hasPhoneTx = result.transactions.some(
        (t) => t.description.includes('4935') || t.description.includes('WhatsApp'),
      )
      expect(hasPhoneTx).toBe(false)

      const hasTitularTx = result.transactions.some(
        (t) => t.description.includes('MATHEUS') || t.description.includes('Titular'),
      )
      expect(hasTitularTx).toBe(false)

      // Garantir que foram registradas linhas ignoradas para feedback na UI
      expect(result.ignoredLines && result.ignoredLines.length).toBeGreaterThan(0)
    })

    it('retorna erro amigável se nenhuma transação for identificada', () => {
      const emptyText = 'Titular MATHEUS BERCA\nResumo da fatura\nSAC 0800 000 0000'
      const result = parsePDFText(emptyText)
      expect(result.success).toBe(false)
      expect(result.transactions.length).toBe(0)
      expect(result.error).toContain('Não encontramos lançamentos válidos')
    })
  })

  describe('parseCSV', () => {
    it('faz o parsing de CSV padrão Nubank (Data, Valor, Identificador, Descrição)', () => {
      const csvContent = `data,valor,identificador,descricao
2026-03-10,-45.50,12345,Restaurante Bom Sabor
2026-03-11,-120.00,12346,Posto Ipiranga
2026-03-15,3500.00,12347,Salário Mensal Empresa
`
      const result = parseCSV(csvContent)
      expect(result.success).toBe(true)
      expect(result.transactions.length).toBe(3)

      expect(result.transactions[0].description).toBe('Restaurante Bom Sabor')
      expect(result.transactions[0].amount_cents).toBe(4550)
      expect(result.transactions[0].type).toBe('expense')

      expect(result.transactions[2].description).toBe('Salário Mensal Empresa')
      expect(result.transactions[2].amount_cents).toBe(350000)
      expect(result.transactions[2].type).toBe('income')
    })

    it('faz o parsing de CSV do Banco Inter (cabeçalho com nomes variados e formato monetário BR)', () => {
      // Formato típico de exportação de extrato do Banco Inter:
      // Data Lançamento;Histórico;Valor;Saldo
      const interCsv = `Data Lancamento;Historico;Valor;Saldo
10/03/2026;PIX ENVIADO MERCADO LIVRE;-189,90;1.200,50
12/03/2026;PIX RECEBIDO JOAO SILVA;350,00;1.550,50
14/03/2026;PAGAMENTO CONTA ENERGIA;-210,40;1.340,10
`
      const result = parseCSV(interCsv)
      expect(result.success).toBe(true)
      expect(result.transactions.length).toBe(3)

      expect(result.transactions[0].description).toContain('PIX ENVIADO MERCADO LIVRE')
      expect(result.transactions[0].amount_cents).toBe(18990)
      expect(result.transactions[0].type).toBe('expense')
      expect(result.transactions[0].date).toBe('2026-03-10')

      expect(result.transactions[1].description).toContain('PIX RECEBIDO JOAO SILVA')
      expect(result.transactions[1].amount_cents).toBe(35000)
      expect(result.transactions[1].type).toBe('income')
    })

    it('faz o parsing de CSV com colunas separadas de Débito e Crédito (ex: Itaú/Bradesco)', () => {
      const csvContent = `Data;Historico;Debito;Credito
30/09/2026;Agua Sabesp;148,00;
30/09/2026;Salario Posto Vereda;;3.488,48
15/09/2026;SALDO ANTERIOR;0,00;1.000,00
`
      const result = parseCSV(csvContent)
      expect(result.success).toBe(true)
      expect(result.transactions.length).toBe(2)

      const agua = result.transactions.find((t) => t.description.includes('Agua'))
      expect(agua).toBeDefined()
      expect(agua?.amount_cents).toBe(14800)
      expect(agua?.type).toBe('expense')

      const salario = result.transactions.find((t) => t.description.includes('Salario'))
      expect(salario).toBeDefined()
      expect(salario?.amount_cents).toBe(348848)
      expect(salario?.type).toBe('income')

      // Linha de SALDO ANTERIOR deve ter sido ignorada
      const saldoTx = result.transactions.find((t) => t.description.includes('SALDO'))
      expect(saldoTx).toBeUndefined()
    })

    it('faz detecção por amostragem quando o CSV NÃO possui cabeçalho', () => {
      const rawRowsCsv = `10/03/2026;Farmacia Droga Raia;-65,40
12/03/2026;Supermercado Pao de Acucar;-320,10
15/03/2026;Prestacao Servicos Consultoria;2.500,00
`
      const result = parseCSV(rawRowsCsv)
      expect(result.success).toBe(true)
      expect(result.transactions.length).toBe(3)
      expect(result.transactions[0].amount_cents).toBe(6540)
      expect(result.transactions[0].type).toBe('expense')
      expect(result.transactions[2].amount_cents).toBe(250000)
      expect(result.transactions[2].type).toBe('income')
    })

    it('fornece diagnósticos completos e sugestão quando nenhum lançamento é reconhecido', () => {
      const badCsv = `Linha aleatoria de texto sem data e sem valor
Outra linha qualquer de informacoes
Apenas texto sem numeros de transacoes
`
      const result = parseCSV(badCsv)
      expect(result.success).toBe(false)
      expect(result.diagnostics).toBeDefined()
      expect(result.diagnostics?.totalLines).toBe(3)
      expect(result.diagnostics?.linesWithDate).toBe(0)
      expect(result.diagnostics?.linesWithValue).toBe(0)
      expect(result.diagnostics?.suggestion).toBeDefined()
    })
  })

  describe('reconstructLinesFromPositionedItems (Reconstrução de Linhas de PDF)', () => {
    it('agrupa palavras com mesmo Y em uma única linha ordenada por X da esquerda para a direita', () => {
      // Simula a saída de uma página com múltiplos lançamentos no PDF
      // Em PDF: Y decresce de cima para baixo na leitura visual
      const items = [
        // Linha 1 (topo - Y=500): "30/09/2026" (x=50), "Salário Posto Vereda" (x=150), "3.488,48" (x=400)
        { str: 'Salário Posto Vereda', x: 150, y: 500 },
        { str: '30/09/2026', x: 50, y: 500 },
        { str: '3.488,48', x: 400, y: 500 },

        // Linha 2 (meio - Y=480): "30/09/2026" (x=50), "Água" (x=150), "148,00" (x=400)
        { str: '148,00', x: 400, y: 480 },
        { str: '30/09/2026', x: 50, y: 480 },
        { str: 'Água Sabesp', x: 150, y: 480 },

        // Linha 3 (rodapé - Y=100): "Acesse www.bancointer.com.br"
        { str: 'Acesse', x: 50, y: 100 },
        { str: 'www.bancointer.com.br', x: 120, y: 100 },
      ]

      const lines = reconstructLinesFromPositionedItems(items)
      expect(lines.length).toBe(3)
      expect(lines[0]).toBe('30/09/2026 Salário Posto Vereda 3.488,48')
      expect(lines[1]).toBe('30/09/2026 Água Sabesp 148,00')
      expect(lines[2]).toBe('Acesse www.bancointer.com.br')

      // Quando passa pelo parsePDFText, o ruído é filtrado e os lançamentos são extraídos
      const fullText = lines.join('\n')
      const parseResult = parsePDFText(fullText)
      expect(parseResult.success).toBe(true)
      expect(parseResult.transactions.length).toBe(2)
      expect(parseResult.transactions[0].description).toBe('Salário Posto Vereda')
      expect(parseResult.transactions[1].description).toBe('Água Sabesp')
    })

    it('acomoda pequenas variações de alinhamento vertical dentro da tolerância Y', () => {
      const items = [
        { str: '15/03/2026', x: 50, y: 350.2 },
        { str: 'Restaurante Sabor', x: 180, y: 351.0 }, // 0.8pt de diferença
        { str: '89,90', x: 420, y: 349.5 }, // 0.7pt de diferença
      ]
      const lines = reconstructLinesFromPositionedItems(items, 4)
      expect(lines.length).toBe(1)
      expect(lines[0]).toBe('15/03/2026 Restaurante Sabor 89,90')
    })
  })

  describe('parseOFX', () => {
    it('faz o parsing de blocos <STMTTRN> padrão bancário', () => {
      const ofxContent = `
OFXHEADER:100
<OFX>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT</TRNTYPE>
<DTPOSTED>20260930120000</DTPOSTED>
<TRNAMT>-148.00</TRNAMT>
<MEMO>Pagamento Agua</MEMO>
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT</TRNTYPE>
<DTPOSTED>20260930120000</DTPOSTED>
<TRNAMT>3488.48</TRNAMT>
<MEMO>Salario Posto Vereda</MEMO>
</STMTTRN>
</BANKTRANLIST>
</OFX>
`
      const result = parseOFX(ofxContent)
      expect(result.success).toBe(true)
      expect(result.transactions.length).toBe(2)

      expect(result.transactions[0].description).toBe('Pagamento Agua')
      expect(result.transactions[0].amount_cents).toBe(14800)
      expect(result.transactions[0].type).toBe('expense')
      expect(result.transactions[0].date).toBe('2026-09-30')

      expect(result.transactions[1].description).toBe('Salario Posto Vereda')
      expect(result.transactions[1].amount_cents).toBe(348848)
      expect(result.transactions[1].type).toBe('income')
    })
  })

  describe('predictCategory — Regras de Mercado', () => {
    const mockCategories: TransactionCategory[] = [
      {
        id: 'cat-salario',
        family_id: 'fam-1',
        name: 'Salário',
        type: 'income',
        icon: 'Briefcase',
        color: '#10B981',
        created_at: '',
      },
      {
        id: 'cat-moradia',
        family_id: 'fam-1',
        name: 'Moradia',
        type: 'expense',
        icon: 'Home',
        color: '#3B82F6',
        created_at: '',
      },
      {
        id: 'cat-mercado',
        family_id: 'fam-1',
        name: 'Mercado',
        type: 'expense',
        icon: 'ShoppingBag',
        color: '#F59E0B',
        created_at: '',
      },
      {
        id: 'cat-transporte',
        family_id: 'fam-1',
        name: 'Transporte',
        type: 'expense',
        icon: 'Car',
        color: '#8B5CF6',
        created_at: '',
      },
    ]

    it('categoriza "Salário Posto Vereda" como Salário (income)', () => {
      const cat = predictCategory('Salário Posto Vereda', 'income', mockCategories)
      expect(cat).toBeDefined()
      expect(cat?.name).toBe('Salário')
    })

    it('categoriza "Água" / "Sabesp" como Moradia (expense)', () => {
      const cat1 = predictCategory('Água', 'expense', mockCategories)
      expect(cat1?.name).toBe('Moradia')

      const cat2 = predictCategory('Conta Sabesp', 'expense', mockCategories)
      expect(cat2?.name).toBe('Moradia')
    })

    it('categoriza compras de supermercado como Mercado', () => {
      const cat = predictCategory('Carrefour Hipermercado', 'expense', mockCategories)
      expect(cat?.name).toBe('Mercado')
    })

    it('categoriza Uber como Transporte', () => {
      const cat = predictCategory('Uber *Trip 1234', 'expense', mockCategories)
      expect(cat?.name).toBe('Transporte')
    })
  })
})
