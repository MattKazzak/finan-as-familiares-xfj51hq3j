// Testes unitários para o parser de faturas em PDF de cartão de crédito brasileiras
// Cobre formatos reais e simulados de Nubank, Banco Inter, C6 Bank, Itaú e Santander,
// incluindo parcelamentos ("01/03", "2/12"), estornos, pagamentos de fatura, deduplicação determinística e accountType.

import { describe, it, expect } from 'vitest'
import {
  normalizePdfDate,
  extractInvoiceReferenceYear,
  generatePdfFitid,
  parsePdfTransactionLine,
  parsePdfTextLines,
} from '@/services/import/pdf-parser'
import { parseStatementFile } from '@/services/import/statement-parser'

describe('PDF Invoice Parser - Unidades e Heurísticas Bancárias Brasileiras', () => {
  describe('normalizePdfDate', () => {
    it('normaliza formatos com meses textuais abreviados em português', () => {
      expect(normalizePdfDate('12 OUT', 2026)).toBe('2026-10-12')
      expect(normalizePdfDate('05 FEV', 2026)).toBe('2026-02-05')
      expect(normalizePdfDate('28 DEZ', 2026)).toBe('2026-12-28')
      expect(normalizePdfDate('1 JAN', 2026)).toBe('2026-01-01')
      expect(normalizePdfDate('15 MAR', 2026)).toBe('2026-03-15')
    })

    it('normaliza formatos com data completa e barras DD/MM/AAAA ou DD/MM', () => {
      expect(normalizePdfDate('15/10/2026')).toBe('2026-10-15')
      expect(normalizePdfDate('05/03/26')).toBe('2026-03-05')
      expect(normalizePdfDate('20/11', 2026)).toBe('2026-11-20')
    })

    it('rejeita datas fora do calendário real', () => {
      expect(normalizePdfDate('31/02/2026')).toBeNull()
      expect(normalizePdfDate('99/99/2026')).toBeNull()
      expect(normalizePdfDate('32 OUT', 2026)).toBeNull()
    })
  })

  describe('extractInvoiceReferenceYear', () => {
    it('extrai ano de vencimento ou período da fatura', () => {
      const sample1 = 'Vencimento 10/11/2026 Total a pagar R$ 1.540,20'
      expect(extractInvoiceReferenceYear(sample1)).toBe(2026)

      const sample2 = 'Fatura de Outubro de 2025 - Resumo dos lançamentos'
      expect(extractInvoiceReferenceYear(sample2)).toBe(2025)

      const sample3 = 'Período de fechamento: 01/08/2026 até 31/08/2026'
      expect(extractInvoiceReferenceYear(sample3)).toBe(2026)
    })
  })

  describe('generatePdfFitid - Deduplicação e hash determinístico', () => {
    it('gera o mesmo FITID para os mesmos dados de transação', () => {
      const fitid1 = generatePdfFitid('2026-10-12', 'Mercado Livre', 15000)
      const fitid2 = generatePdfFitid('2026-10-12', 'Mercado Livre', 15000)
      expect(fitid1).toBe(fitid2)
      expect(fitid1).toMatch(/^PDF-20261012-[a-z0-9]+$/)
    })

    it('gera FITIDs distintos para valores ou datas distintas', () => {
      const fitid1 = generatePdfFitid('2026-10-12', 'Mercado Livre', 15000)
      const fitid2 = generatePdfFitid('2026-10-12', 'Mercado Livre', 15001)
      const fitid3 = generatePdfFitid('2026-10-13', 'Mercado Livre', 15000)
      expect(fitid1).not.toBe(fitid2)
      expect(fitid1).not.toBe(fitid3)
    })
  })

  describe('parsePdfTransactionLine - Padrões de Bancos Brasileiros', () => {
    it('analisa linha típica Nubank com data "DD MMM" e parcelas "01/03"', () => {
      const line = '12 OUT Mercado Livre 01/03 150,00'
      const res = parsePdfTransactionLine(line, 2026)

      expect(res.transaction).not.toBeNull()
      const tx = res.transaction!
      expect(tx.date).toBe('2026-10-12')
      expect(tx.description).toContain('Mercado Livre')
      expect(tx.amount_cents).toBe(15000)
      expect(tx.type).toBe('expense')
      expect(tx.installmentInfo?.isInstallment).toBe(true)
      expect(tx.installmentInfo?.current).toBe(1)
      expect(tx.installmentInfo?.total).toBe(3)
    })

    it('analisa pagamento ou crédito de fatura Nubank como receita/estorno', () => {
      const line = '10 OUT Pagamento recebido -1.500,00'
      const res = parsePdfTransactionLine(line, 2026)

      expect(res.transaction).not.toBeNull()
      const tx = res.transaction!
      expect(tx.date).toBe('2026-10-10')
      expect(tx.amount_cents).toBe(150000)
      expect(tx.type).toBe('income')
    })

    it('analisa estorno de compra com valor negativo', () => {
      const line = '14 OUT Estorno Compra Cancelada -89,90'
      const res = parsePdfTransactionLine(line, 2026)

      expect(res.transaction).not.toBeNull()
      const tx = res.transaction!
      expect(tx.date).toBe('2026-10-14')
      expect(tx.amount_cents).toBe(8990)
      expect(tx.type).toBe('income')
    })

    it('analisa estorno com sinal de menos após o valor "89,90-"', () => {
      const line = '14 OUT Reembolso Uber 89,90-'
      const res = parsePdfTransactionLine(line, 2026)

      expect(res.transaction).not.toBeNull()
      const tx = res.transaction!
      expect(tx.date).toBe('2026-10-14')
      expect(tx.amount_cents).toBe(8990)
      expect(tx.type).toBe('income')
    })

    it('analisa fatura do banco Santander com compras, parcelas e pagamento de fatura', () => {
      // 1. Compra simples Santander com DD/MM e descrição
      const line1 = '18/10 RESTAURANTE VARANDA 145,00'
      const res1 = parsePdfTransactionLine(line1, 2026)
      expect(res1.transaction).not.toBeNull()
      expect(res1.transaction!.date).toBe('2026-10-18')
      expect(res1.transaction!.description).toBe('RESTAURANTE VARANDA')
      expect(res1.transaction!.amount_cents).toBe(14500)
      expect(res1.transaction!.type).toBe('expense')

      // 2. Compra parcelada Santander "03/10"
      const line2 = '22/10 LOJAS CEM 03/10 89,90'
      const res2 = parsePdfTransactionLine(line2, 2026)
      expect(res2.transaction).not.toBeNull()
      expect(res2.transaction!.installmentInfo?.isInstallment).toBe(true)
      expect(res2.transaction!.installmentInfo?.current).toBe(3)
      expect(res2.transaction!.installmentInfo?.total).toBe(10)
      expect(res2.transaction!.type).toBe('expense')

      // 3. Pagamento de fatura Santander tratado como receita/crédito
      const line3 = '20/10 PAGAMENTO DE FATURA EFETUADO -1.250,00'
      const res3 = parsePdfTransactionLine(line3, 2026)
      expect(res3.transaction).not.toBeNull()
      expect(res3.transaction!.type).toBe('income')
      expect(res3.transaction!.amount_cents).toBe(125000)

      // 4. Pagamento de fatura sem sinal negativo na string de valor mas com descrição explicita
      const line4 = '20/10 PAGAMENTO DA FATURA 1.250,00'
      const res4 = parsePdfTransactionLine(line4, 2026)
      expect(res4.transaction).not.toBeNull()
      expect(res4.transaction!.type).toBe('income')
      expect(res4.transaction!.amount_cents).toBe(125000)
    })

    it('analisa linha típica Banco Inter com DD/MM/AAAA e prefixo "COMPRA CARTAO"', () => {
      const line = '05/10/2026 COMPRA CARTAO - IFOOD REFEICAO 45,90'
      const res = parsePdfTransactionLine(line, 2026)

      expect(res.transaction).not.toBeNull()
      const tx = res.transaction!
      expect(tx.date).toBe('2026-10-05')
      expect(tx.description).toBe('COMPRA CARTAO - IFOOD REFEICAO')
      expect(tx.amount_cents).toBe(4590)
      expect(tx.type).toBe('expense')
    })

    it('analisa linha típica C6 Bank com símbolo "R$" e DD/MM', () => {
      const line = '28/09 UBER *TRIP R$ 23,50'
      const res = parsePdfTransactionLine(line, 2026)

      expect(res.transaction).not.toBeNull()
      const tx = res.transaction!
      expect(tx.date).toBe('2026-09-28')
      expect(tx.description).toBe('UBER *TRIP')
      expect(tx.amount_cents).toBe(2350)
      expect(tx.type).toBe('expense')
    })

    it('analisa linha típica Itaú com parcelamento no formato "2/12"', () => {
      const line = '15/10 MAGAZINE LUIZA 2/12 210,00'
      const res = parsePdfTransactionLine(line, 2026)

      expect(res.transaction).not.toBeNull()
      const tx = res.transaction!
      expect(tx.date).toBe('2026-10-15')
      expect(tx.amount_cents).toBe(21000)
      expect(tx.type).toBe('expense')
      expect(tx.installmentInfo?.isInstallment).toBe(true)
      expect(tx.installmentInfo?.current).toBe(2)
      expect(tx.installmentInfo?.total).toBe(12)
    })

    it('ignora linhas de ruído (telefones, SAC, cabeçalhos, resumos)', () => {
      expect(parsePdfTransactionLine('SAC 0800 774 0404 Ouvidoria').transaction).toBeNull()
      expect(parsePdfTransactionLine('Total da fatura R$ 3.420,50').transaction).toBeNull()
      expect(parsePdfTransactionLine('Vencimento 10/11/2026').transaction).toBeNull()
      expect(parsePdfTransactionLine('Pagamento Mínimo R$ 500,00').transaction).toBeNull()
    })
  })

  describe('parsePdfTextLines - Simulação de faturas completas em lote', () => {
    it('processa fatura Nubank completa simulando texto extraído de PDF', () => {
      const nubankSample = [
        'Nu Pagamentos S.A. - 00.000.000/0001-00',
        'Vencimento 10/11/2026',
        'Resumo da sua fatura',
        'Total da fatura R$ 1.849,80',
        'TRANSAÇÕES',
        '01 OUT Padaria do Bairro 22,50',
        '04 OUT Droga Raia 64,80',
        '10 OUT Pagamento de fatura -1.200,00',
        '12 OUT Mercado Livre 01/03 150,00',
        '18 OUT Posto Ipiranga 210,00',
        '25 OUT Uber *Trip 32,50',
        'Central de Atendimento: 0800 608 6236',
      ]

      const result = parsePdfTextLines(nubankSample, 2026)
      expect(result.success).toBe(true)
      expect(result.transactions.length).toBe(6)

      // Padaria
      expect(result.transactions[0].description).toBe('Padaria do Bairro')
      expect(result.transactions[0].amount_cents).toBe(2250)
      expect(result.transactions[0].type).toBe('expense')
      expect(result.transactions[0].date).toBe('2026-10-01')

      // Pagamento de fatura (income)
      const paymentTx = result.transactions.find((t) => t.amount_cents === 120000)
      expect(paymentTx).toBeDefined()
      expect(paymentTx?.type).toBe('income')

      // Parcela
      const installmentTx = result.transactions.find((t) => t.amount_cents === 15000)
      expect(installmentTx).toBeDefined()
      expect(installmentTx?.installmentInfo?.isInstallment).toBe(true)
      expect(installmentTx?.installmentInfo?.current).toBe(1)
      expect(installmentTx?.installmentInfo?.total).toBe(3)
    })

    it('processa fatura Banco Inter e C6 Bank com valores R$ e datas DD/MM', () => {
      const interSample = [
        'Banco Inter S.A. - Fatura Mensal',
        'Período: 01/10/2026 a 31/10/2026',
        '02/10 COMPRA CARTAO - CARREFOUR R$ 380,45',
        '05/10 COMPRA CARTAO - NETFLIX.COM R$ 55,90',
        '15/10 COMPRA CARTAO - APPLE.COM R$ 14,90',
        '20/10 ESTORNO COMPRA DUPLICADA -380,45',
        'Central de Relacionamento 3003-4070',
      ]

      const result = parsePdfTextLines(interSample, 2026)
      expect(result.success).toBe(true)
      expect(result.transactions.length).toBe(4)

      expect(result.transactions[0].amount_cents).toBe(38045)
      expect(result.transactions[0].type).toBe('expense')

      // Estorno
      const estornoTx = result.transactions[3]
      expect(estornoTx.amount_cents).toBe(38045)
      expect(estornoTx.type).toBe('income')
    })

    it('deduplica linhas repetidas na mesma fatura', () => {
      const duplicateSample = [
        '12 OUT Restaurante Italiano 85,00',
        '12 OUT Restaurante Italiano 85,00', // duplicata idêntica
        '15 OUT Farmacia Pague Menos 30,00',
      ]

      const result = parsePdfTextLines(duplicateSample, 2026)
      expect(result.success).toBe(true)
      expect(result.transactions.length).toBe(2)
      expect(result.warnings?.[0]).toContain('transações idênticas repetidas foram unificadas')
      expect(result.accountType).toBe('CREDIT_CARD')
      expect(result.format).toBe('pdf')
    })

    it('processa fatura simulada Santander em lote retornando accountType CREDIT_CARD', () => {
      const santanderSample = [
        'BANCO SANTANDER (BRASIL) S.A.',
        'Extrato do Cartão Santander SX Visa',
        'Vencimento: 15/11/2026',
        'Lançamentos Nacionais',
        '10/10 SUPERMERCADO PAO DE ACUCAR 234,50',
        '12/10 DROGASIL 54,20',
        '15/10 PAGAMENTO DE FATURA -1.500,00',
        '18/10 FAST SHOP 02/05 320,00',
        '25/10 UBER TRIP 19,90',
        'Central de Atendimento Santander 4004-3535',
      ]

      const result = parsePdfTextLines(santanderSample, 2026)
      expect(result.success).toBe(true)
      expect(result.accountType).toBe('CREDIT_CARD')
      expect(result.transactions.length).toBe(5)

      const paymentTx = result.transactions.find((t) => t.amount_cents === 150000)
      expect(paymentTx).toBeDefined()
      expect(paymentTx?.type).toBe('income')

      const installmentTx = result.transactions.find((t) => t.amount_cents === 32000)
      expect(installmentTx?.installmentInfo?.isInstallment).toBe(true)
      expect(installmentTx?.installmentInfo?.current).toBe(2)
      expect(installmentTx?.installmentInfo?.total).toBe(5)
    })
  })
})
