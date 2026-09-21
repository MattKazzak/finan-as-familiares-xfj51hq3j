// Testes unitários para o parser de extratos OFX e categorização automática
// Valida extratos bancários em formato OFX e regras de negócio de categorização

import { describe, it, expect } from 'vitest'
import {
  parseAmount,
  parseDate,
  isNoiseLine,
  parseOFX,
  parseStatementFile,
} from '@/services/import/statement-parser'
import {
  predictCategory,
  matchCategorization,
  extractPatternFromDescription,
} from '@/services/import/categorization'
import type { TransactionCategory, CategorizationRule } from '@/types/finance'

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
    it('detecta rodapé de telefones e atendimento', () => {
      const line = '+ 55 11 4935-2740 (Auto atendimento via WhatsApp) + 55 11 3003-5465'
      expect(isNoiseLine(line).isNoise).toBe(true)
    })

    it('detecta cabeçalho com titular e resumo', () => {
      const line =
        'Titular MATHEUS KAZMIERCZAK BERCA Endereço RUA FRANCELINA F DOS SANTOS ... Vencimento Resumo da sua fatura Cartão Rico Rico Visa Infinite Total da fatura'
      expect(isNoiseLine(line).isNoise).toBe(true)
    })

    it('detecta linhas de 0800, SAC e ouvidoria', () => {
      expect(isNoiseLine('SAC 0800 774 0404 Ouvidoria').isNoise).toBe(true)
      expect(isNoiseLine('Central de Atendimento 4004-3535').isNoise).toBe(true)
    })

    it('não considera uma transação real como ruído', () => {
      expect(isNoiseLine('30/09/2026 Salário Posto Vereda 3.488,48').isNoise).toBe(false)
      expect(isNoiseLine('30/09/2026 Água 148,00').isNoise).toBe(false)
      expect(isNoiseLine('15/03/2026 Supermercado Carrefour 250,90').isNoise).toBe(false)
    })
  })

  describe('parseOFX', () => {
    it('faz o parsing de blocos <STMTTRN> padrão bancário com fechamento XML', () => {
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

    it('faz o parsing de OFX SGML 1.x real do Banco Inter (sem tags de fechamento </STMTTRN>, </DTPOSTED>, etc.)', () => {
      const interOfxSGML = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILESPEC:NONE
NEWFILESPEC:NONE

<OFX>
<SIGNONMSGSRSV1>
<SONRS>
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<DTSERVER>20260315120000
<LANGUAGE>POR
</SONRS>
</SIGNONMSGSRSV1>
<BANKMSGSRSV1>
<STMTTRNRS>
<TRNUID>1
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<STMTRS>
<CURDEF>BRL
<BANKACCTFROM>
<BANKID>077
<ACCTID>1234567-8
<ACCTTYPE>CHECKING
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20260301
<DTEND>20260315
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260310100000[-03:EST]
<TRNAMT>-189.90
<FITID>20260310001
<MEMO>PIX ENVIADO MERCADO LIVRE
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260312
<TRNAMT>350.00
<FITID>20260312002
<MEMO>PIX RECEBIDO JOAO SILVA
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260314143000
<TRNAMT>-210.40
<FITID>20260314003
<NAME>PAGAMENTO CONTA ENERGIA
</BANKTRANLIST>
<LEDGERBAL>
<BALAMT>1340.10
<DTASOF>20260315
</LEDGERBAL>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`

      const result = parseOFX(interOfxSGML)
      expect(result.success).toBe(true)
      expect(result.transactions.length).toBe(3)

      expect(result.transactions[0].description).toBe('PIX ENVIADO MERCADO LIVRE')
      expect(result.transactions[0].amount_cents).toBe(18990)
      expect(result.transactions[0].type).toBe('expense')
      expect(result.transactions[0].date).toBe('2026-03-10')
      expect(result.transactions[0].fitid).toBe('20260310001')

      expect(result.transactions[1].description).toBe('PIX RECEBIDO JOAO SILVA')
      expect(result.transactions[1].amount_cents).toBe(35000)
      expect(result.transactions[1].type).toBe('income')
      expect(result.transactions[1].date).toBe('2026-03-12')
      expect(result.transactions[1].fitid).toBe('20260312002')

      expect(result.transactions[2].description).toBe('PAGAMENTO CONTA ENERGIA')
      expect(result.transactions[2].amount_cents).toBe(21040)
      expect(result.transactions[2].type).toBe('expense')
      expect(result.transactions[2].date).toBe('2026-03-14')
      expect(result.transactions[2].fitid).toBe('20260314003')
    })

    it('faz parsing de fatura de cartão de crédito em OFX (<CCSTMTRS>) com valores com vírgula e estorno', () => {
      const creditCardOfx = `OFXHEADER:100
DATA:OFXSGML
<OFX>
<CREDITCARDMSGSRSV1>
<CCSTMTTRNRS>
<CCSTMTRS>
<CURDEF>BRL
<CCACCTFROM>
<ACCTID>**** **** **** 1234
</CCACCTFROM>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260305120000
<TRNAMT>-1.234,56
<MEMO>Compra Supermercado Pão de Açúcar
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260307120000
<TRNAMT>-89,90
<MEMO>Restaurante Italiano
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260308120000
<TRNAMT>50,00
<MEMO>ESTORNO COMPRA CANCELADA
</BANKTRANLIST>
</CCSTMTRS>
</CCSTMTTRNRS>
</CREDITCARDMSGSRSV1>
</OFX>`

      const result = parseOFX(creditCardOfx)
      expect(result.success).toBe(true)
      expect(result.transactions.length).toBe(3)

      expect(result.transactions[0].description).toBe('Compra Supermercado Pão de Açúcar')
      expect(result.transactions[0].amount_cents).toBe(123456)
      expect(result.transactions[0].type).toBe('expense')

      expect(result.transactions[1].description).toBe('Restaurante Italiano')
      expect(result.transactions[1].amount_cents).toBe(8990)
      expect(result.transactions[1].type).toBe('expense')

      expect(result.transactions[2].description).toBe('ESTORNO COMPRA CANCELADA')
      expect(result.transactions[2].amount_cents).toBe(5000)
      expect(result.transactions[2].type).toBe('income')
    })

    it('retorna mensagem de diagnóstico clara para arquivo sem transações ou que não é OFX', () => {
      const notAnOfx = `Isto e um arquivo de texto qualquer que nao contem tags financeiras.`
      const result = parseOFX(notAnOfx)
      expect(result.success).toBe(false)
      expect(result.error).toContain('Isto não parece um extrato OFX válido')
      expect(result.error).toContain('<STMTTRN>')

      const emptyOfx = `   `
      const emptyResult = parseOFX(emptyOfx)
      expect(emptyResult.success).toBe(false)
      expect(emptyResult.error).toContain('O arquivo OFX selecionado está vazio')
    })
  })

  describe('parseStatementFile — Restrição exclusiva para .OFX', () => {
    it('rejeita arquivos .csv com mensagem amigável em português explicando a restrição ao OFX', async () => {
      const csvFile = new File(['data,valor,descricao\n2026-03-10,-50.00,Mercado'], 'extrato.csv', {
        type: 'text/csv',
      })
      const result = await parseStatementFile(csvFile)
      expect(result.success).toBe(false)
      expect(result.error).toContain('.CSV não é suportado')
      expect(result.error).toContain('exclusivamente com importação de extrato em arquivo OFX')
      expect(result.error).toContain('Nubank')
    })

    it('rejeita arquivos .pdf com mensagem amigável em português explicando a restrição ao OFX', async () => {
      const pdfFile = new File(['%PDF-1.4 mock content'], 'fatura.pdf', {
        type: 'application/pdf',
      })
      const result = await parseStatementFile(pdfFile)
      expect(result.success).toBe(false)
      expect(result.error).toContain('.PDF não é suportado')
      expect(result.error).toContain('exclusivamente com importação de extrato em arquivo OFX')
    })

    it('processa arquivo .ofx com sucesso', async () => {
      const ofxContent = `
<OFX>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT</TRNTYPE>
<DTPOSTED>20260310</DTPOSTED>
<TRNAMT>-85.00</TRNAMT>
<MEMO>Posto Shell Combustivel</MEMO>
</STMTTRN>
</BANKTRANLIST>
</OFX>
`
      const ofxFile = new File([ofxContent], 'extrato_nubank.ofx', {
        type: 'application/x-ofx',
      })
      const result = await parseStatementFile(ofxFile)
      expect(result.success).toBe(true)
      expect(result.transactions.length).toBe(1)
      expect(result.transactions[0].description).toBe('Posto Shell Combustivel')
      expect(result.transactions[0].amount_cents).toBe(8500)
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

    it('prioriza regras de categorization_rules do banco com subcategoria', () => {
      const dbRules: CategorizationRule[] = [
        {
          id: 'rule-1',
          pattern: 'IFOOD',
          category_id: 'cat-mercado',
          subcategory_id: 'sub-delivery',
          created_at: new Date().toISOString(),
        },
      ]

      const categoriesWithSub: TransactionCategory[] = [
        {
          ...mockCategories[2], // Mercado
          subcategories: [
            {
              id: 'sub-delivery',
              family_id: 'fam-1',
              category_id: 'cat-mercado',
              name: 'Delivery',
              icon: null,
              color: null,
              sort_order: 1,
              created_at: '',
            },
          ],
        },
      ]

      const match = matchCategorization('COMPRA IFOOD *1234', 'expense', categoriesWithSub, dbRules)
      expect(match).not.toBeNull()
      expect(match?.category.name).toBe('Mercado')
      expect(match?.subcategory?.name).toBe('Delivery')
      expect(match?.source).toBe('database_rule')
    })

    it('extrai padrão limpo da descrição descartando números e ruídos', () => {
      expect(extractPatternFromDescription('COMPRA CARTAO IFOOD 12345')).toBe('IFOOD')
      expect(extractPatternFromDescription('PAGAMENTO POSTO IPIRANGA 99')).toBe('IPIRANGA')
      expect(extractPatternFromDescription('NETFLIX.COM')).toBe('NETFLIX.COM')
    })

    it('distingue padrões como MAX, BAR e UBER vs UBER EATS sem falsos positivos', () => {
      const dbRules: CategorizationRule[] = [
        {
          id: 'rule-uber-eats',
          pattern: 'UBER EATS',
          category_id: 'cat-mercado',
          created_at: new Date().toISOString(),
        },
        {
          id: 'rule-uber',
          pattern: 'UBER',
          category_id: 'cat-transporte',
          created_at: new Date().toISOString(),
        },
        {
          id: 'rule-max',
          pattern: 'MAX',
          category_id: 'cat-moradia',
          created_at: new Date().toISOString(),
        },
        {
          id: 'rule-bar',
          pattern: 'BAR ',
          category_id: 'cat-mercado',
          created_at: new Date().toISOString(),
        },
      ]

      const matchUberEats = matchCategorization(
        'PAGTO UBER EATS 123',
        'expense',
        mockCategories,
        dbRules,
      )
      expect(matchUberEats?.category.id).toBe('cat-mercado')
      expect(matchUberEats?.matchedRulePattern).toBe('UBER EATS')

      const matchUber = matchCategorization('PAGTO UBER VIAGEM', 'expense', mockCategories, dbRules)
      expect(matchUber?.category.id).toBe('cat-transporte')
      expect(matchUber?.matchedRulePattern).toBe('UBER')

      const matchMaxWord = matchCategorization(
        'ASSINATURA MAX MENSAL',
        'expense',
        mockCategories,
        dbRules,
      )
      expect(matchMaxWord?.category.id).toBe('cat-moradia')

      const matchMaxima = matchCategorization(
        'FARMACIA MAXIMA 123',
        'expense',
        mockCategories,
        dbRules,
      )
      expect(matchMaxima?.matchedRulePattern).not.toBe('MAX')

      const matchBar = matchCategorization(
        'PAGAMENTO NO BAR DA PRAIA',
        'expense',
        mockCategories,
        dbRules,
      )
      expect(matchBar?.category.id).toBe('cat-mercado')

      const matchBarato = matchCategorization(
        'MERCADO SUPER BARATO',
        'expense',
        mockCategories,
        dbRules,
      )
      expect(matchBarato?.matchedRulePattern).not.toBe('BAR ')
    })

    it("HABIB cobre tanto HABIB quanto HABIBS e HABIB'S", () => {
      const dbRules: CategorizationRule[] = [
        {
          id: 'rule-habib',
          pattern: 'HABIB',
          category_id: 'cat-mercado',
          created_at: new Date().toISOString(),
        },
      ]

      const m1 = matchCategorization('HABIB FAST FOOD', 'expense', mockCategories, dbRules)
      expect(m1?.category.id).toBe('cat-mercado')

      const m2 = matchCategorization("HABIB'S REFEICAO", 'expense', mockCategories, dbRules)
      expect(m2?.category.id).toBe('cat-mercado')

      const m3 = matchCategorization('HABIBS DELIVERY', 'expense', mockCategories, dbRules)
      expect(m3?.category.id).toBe('cat-mercado')
    })
  })
})
