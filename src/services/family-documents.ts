import { supabase } from '@/lib/supabase/client'
import {
  QuadCorners,
  ScanFilterMode,
  warpPerspectiveCanvas,
  applyScanFiltersToImageData,
} from './document-scanner-core'

export type DocumentCategory = 'identidade' | 'familia' | 'residencia' | 'saude' | 'outros'

export interface DocumentCategoryMeta {
  id: DocumentCategory
  label: string
  description: string
  iconName: string
  examples: string
}

export const DOCUMENT_CATEGORIES: DocumentCategoryMeta[] = [
  {
    id: 'identidade',
    label: 'Identidade',
    description: 'Documentos pessoais civis',
    iconName: 'UserCheck',
    examples: 'RG, CNH, Passaporte, CPF',
  },
  {
    id: 'familia',
    label: 'Família',
    description: 'Atos civis e certidões familiares',
    iconName: 'Users',
    examples: 'Certidão de Casamento, Nascimento, União Estável',
  },
  {
    id: 'residencia',
    label: 'Residência',
    description: 'Comprovantes e moradia',
    iconName: 'Home',
    examples: 'Conta de Luz, Água, Contrato de Aluguel, IPTU',
  },
  {
    id: 'saude',
    label: 'Saúde',
    description: 'Convênios e prontuários',
    iconName: 'HeartPulse',
    examples: 'Carteirinha do Plano, Vacinas, Laudos, Receitas',
  },
  {
    id: 'outros',
    label: 'Outros',
    description: 'Diversos e profissionais',
    iconName: 'Folder',
    examples: 'Diploma, Contrato de Trabalho, Título de Eleitor',
  },
]

export interface FamilyDocument {
  id: string
  family_id: string
  uploaded_by: string
  uploaded_by_name: string
  title: string
  category: DocumentCategory
  storage_path: string
  file_name: string
  file_size_bytes: number
  mime_type: string
  expires_at: string | null // YYYY-MM-DD
  is_shared_with_family: boolean
  created_at: string
  updated_at: string
}

export interface FamilyDocumentShare {
  id: string
  document_id: string
  family_id: string
  created_by: string
  token: string
  expires_at: string
  revoked_at: string | null
  view_count: number
  last_viewed_at: string | null
  created_at: string
}

export interface SharedDocumentPublicInfo {
  valid: boolean
  error?: string
  share_id?: string
  expires_at?: string
  document_id?: string
  title?: string
  category?: DocumentCategory
  file_name?: string
  mime_type?: string
  file_size_bytes?: number
  storage_path?: string
  doc_expires_at?: string | null
}

const STORAGE_BUCKET = 'family-documents'
export const MAX_DOCUMENT_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

/**
 * Retorna status de expiração / validade para documento com data
 */
export function getDocumentExpirationStatus(expiresAtStr: string | null | undefined): {
  isExpired: boolean
  isExpiringSoon: boolean
  daysRemaining: number | null
  label: string | null
} {
  if (!expiresAtStr) {
    return { isExpired: false, isExpiringSoon: false, daysRemaining: null, label: null }
  }

  // Compara com a data atual no fuso local (apenas dia/mês/ano)
  const [year, month, day] = expiresAtStr.split('-').map(Number)
  if (!year || !month || !day) {
    return { isExpired: false, isExpiringSoon: false, daysRemaining: null, label: null }
  }

  const expiryDate = new Date(year, month - 1, day, 23, 59, 59)
  const now = new Date()
  const diffTime = expiryDate.getTime() - now.getTime()
  const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  if (days < 0) {
    return {
      isExpired: true,
      isExpiringSoon: false,
      daysRemaining: days,
      label: 'Vencido',
    }
  }

  if (days === 0) {
    return {
      isExpired: false,
      isExpiringSoon: true,
      daysRemaining: 0,
      label: 'Vence hoje',
    }
  }

  if (days <= 30) {
    return {
      isExpired: false,
      isExpiringSoon: true,
      daysRemaining: days,
      label: `Vence em ${days} ${days === 1 ? 'dia' : 'dias'}`,
    }
  }

  return {
    isExpired: false,
    isExpiringSoon: false,
    daysRemaining: days,
    label: null,
  }
}

/**
 * Formata tamanho em MB/KB
 */
export function formatDocumentSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 KB'
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Retorna o rótulo amigável do formato do arquivo em caixa alta (ex: 'PDF', 'JPEG', 'PNG', 'WEBP', 'DOCX').
 * É derivado primariamente do mime_type e secundariamente do nome do arquivo (extensão).
 * Nunca retorna categoria interna ('outros', etc.).
 */
export function getDocumentFormatLabel(mimeType?: string | null, fileName?: string | null): string {
  const cleanMime = (mimeType || '').trim().toLowerCase()
  const cleanFile = (fileName || '').trim().toLowerCase()
  const fileExt = cleanFile.includes('.') ? cleanFile.split('.').pop() || '' : ''

  if (cleanMime === 'application/pdf' || fileExt === 'pdf') {
    return 'PDF'
  }
  if (cleanMime === 'image/jpeg' || fileExt === 'jpg' || fileExt === 'jpeg') {
    return 'JPEG'
  }
  if (cleanMime === 'image/png' || fileExt === 'png') {
    return 'PNG'
  }
  if (cleanMime === 'image/webp' || fileExt === 'webp') {
    return 'WEBP'
  }
  if (cleanMime === 'image/gif' || fileExt === 'gif') {
    return 'GIF'
  }
  if (cleanMime === 'image/svg+xml' || fileExt === 'svg') {
    return 'SVG'
  }
  if (
    cleanMime === 'application/msword' ||
    cleanMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    fileExt === 'doc' ||
    fileExt === 'docx'
  ) {
    return fileExt === 'doc' ? 'DOC' : 'DOCX'
  }
  if (
    cleanMime === 'application/vnd.ms-excel' ||
    cleanMime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    fileExt === 'xls' ||
    fileExt === 'xlsx'
  ) {
    return fileExt === 'xls' ? 'XLS' : 'XLSX'
  }
  if (cleanMime === 'text/plain' || fileExt === 'txt') {
    return 'TXT'
  }

  // Se tiver extensão de arquivo identificável, usa a extensão em maiúsculas
  if (fileExt && fileExt.length <= 5) {
    return fileExt.toUpperCase()
  }

  // Se for mime de imagem genérico
  if (cleanMime.startsWith('image/')) {
    const sub = cleanMime.replace('image/', '').toUpperCase()
    return sub || 'IMAGEM'
  }

  return 'ARQUIVO'
}

/**
 * Retorna o subtítulo combinado padronizado "FORMATO • TAMANHO" (ex: "PDF • 100 KB", "JPEG • 11 KB")
 */
export function formatDocumentSubtitle(
  mimeType?: string | null,
  fileSizeBytes?: number | null,
  fileName?: string | null,
): string {
  const format = getDocumentFormatLabel(mimeType, fileName)
  const size = formatDocumentSize(fileSizeBytes || 0)
  return `${format} • ${size}`
}

/**
 * Busca todos os documentos acessíveis da família
 */
export async function fetchFamilyDocuments(familyId: string): Promise<FamilyDocument[]> {
  const { data, error } = await (supabase as any)
    .from('family_documents')
    .select('*')
    .eq('family_id', familyId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Erro ao buscar documentos da família:', error)
    throw new Error('Não foi possível carregar os documentos da família.')
  }

  return (data as FamilyDocument[]) || []
}

/**
 * Faz upload do arquivo para o bucket privado e registra metadados na tabela family_documents
 */
export interface CreateDocumentInput {
  familyId: string
  file: File | Blob
  fileName: string
  mimeType: string
  title: string
  category: DocumentCategory
  expiresAt?: string | null // YYYY-MM-DD
  isSharedWithFamily: boolean
  uploadedByName: string
}

export async function uploadFamilyDocument(input: CreateDocumentInput): Promise<FamilyDocument> {
  const {
    familyId,
    file,
    fileName,
    mimeType,
    title,
    category,
    expiresAt,
    isSharedWithFamily,
    uploadedByName,
  } = input

  // Checagem de tamanho limite (~10MB)
  if (file.size > MAX_DOCUMENT_FILE_SIZE) {
    throw new Error(
      'O arquivo excede o limite prático de 10 MB. Escolha um arquivo menor ou reduza a resolução.',
    )
  }

  const { data: authData, error: authErr } = await supabase.auth.getUser()
  if (authErr || !authData?.user) {
    throw new Error('Usuário não autenticado.')
  }
  const userId = authData.user.id

  // Gera id do documento
  const docId = crypto.randomUUID()
  const cleanExt = fileName.includes('.')
    ? fileName.split('.').pop()?.toLowerCase() || 'bin'
    : 'bin'
  const storagePath = `${familyId}/${docId}.${cleanExt}`

  // 1. Upload no Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, file, {
      contentType: mimeType || 'application/octet-stream',
      upsert: false,
    })

  if (uploadError) {
    console.error('Erro ao subir arquivo no storage:', uploadError)
    throw new Error(`Falha no envio do arquivo: ${uploadError.message}`)
  }

  // 2. Insere registro no banco
  const { data, error: dbError } = await (supabase as any)
    .from('family_documents')
    .insert({
      id: docId,
      family_id: familyId,
      uploaded_by: userId,
      uploaded_by_name: uploadedByName || 'Membro',
      title: title.trim(),
      category,
      storage_path: storagePath,
      file_name: fileName,
      file_size_bytes: file.size,
      mime_type: mimeType,
      expires_at: expiresAt || null,
      is_shared_with_family: isSharedWithFamily,
    })
    .select()
    .single()

  if (dbError) {
    // Tenta reverter o arquivo do storage para não deixar órfão
    await supabase.storage.from(STORAGE_BUCKET).remove([storagePath])
    console.error('Erro ao salvar metadados do documento:', dbError)
    throw new Error('Não foi possível registrar o documento no banco de dados.')
  }

  return data as FamilyDocument
}

/**
 * Atualiza metadados (nome, categoria, validade, visibilidade na família)
 */
export async function updateFamilyDocument(
  docId: string,
  updates: {
    title?: string
    category?: DocumentCategory
    expiresAt?: string | null
    isSharedWithFamily?: boolean
  },
): Promise<FamilyDocument> {
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (updates.title !== undefined) payload.title = updates.title.trim()
  if (updates.category !== undefined) payload.category = updates.category
  if (updates.expiresAt !== undefined) payload.expires_at = updates.expiresAt || null
  if (updates.isSharedWithFamily !== undefined)
    payload.is_shared_with_family = updates.isSharedWithFamily

  const { data, error } = await (supabase as any)
    .from('family_documents')
    .update(payload)
    .eq('id', docId)
    .select()
    .single()

  if (error) {
    console.error('Erro ao atualizar documento:', error)
    throw new Error('Não foi possível atualizar o documento.')
  }

  return data as FamilyDocument
}

/**
 * Exclui o documento da tabela e do storage
 */
export async function deleteFamilyDocument(doc: FamilyDocument): Promise<void> {
  // 1. Remove registro do banco
  const { error: dbError } = await (supabase as any)
    .from('family_documents')
    .delete()
    .eq('id', doc.id)

  if (dbError) {
    console.error('Erro ao excluir documento:', dbError)
    throw new Error('Não foi possível excluir o documento do banco.')
  }

  // 2. Remove arquivo do storage
  if (doc.storage_path) {
    const { error: storageError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([doc.storage_path])

    if (storageError) {
      console.warn('Aviso: falha ao remover arquivo do storage:', storageError)
    }
  }
}

/**
 * Obtém URL assinada temporária para visualização/download privado (autenticado)
 * Default: 1 hora de validade
 */
export async function getDocumentSignedUrl(
  storagePath: string,
  expiresInSeconds: number = 3600,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds)

  if (error || !data?.signedUrl) {
    console.error('Erro ao gerar URL assinada:', error)
    throw new Error('Não foi possível obter link de acesso seguro ao arquivo.')
  }

  return data.signedUrl
}

/**
 * Cria link temporário seguro para compartilhamento externo (15 min, 1 h ou 24 h)
 */
export type ShareDurationOption = '15m' | '1h' | '24h'

export const SHARE_DURATION_CONFIG: Record<
  ShareDurationOption,
  { label: string; seconds: number }
> = {
  '15m': { label: '15 minutos (rápido)', seconds: 15 * 60 },
  '1h': { label: '1 hora (padrão)', seconds: 60 * 60 },
  '24h': { label: '24 horas (máximo)', seconds: 24 * 60 * 60 },
}

/**
 * Resultado do compartilhamento rápido/nativo de documento
 */
export type ShareDocumentResult =
  | { method: 'native-file'; success: true }
  | { method: 'native-link'; success: true }
  | { method: 'clipboard-link'; success: true; publicUrl: string }

/**
 * Compartilha o documento usando a melhor estratégia disponível:
 * 1. Mobile/Aparelho com navigator.canShare({ files }): baixa o arquivo real via URL assinada e
 *    chama navigator.share({ files: [file], title }) -> envia imagem/PDF direto pro WhatsApp/Telegram
 * 2. Mobile/Aparelho com navigator.share mas sem suporte a arquivos: cria link temporário de 24h
 *    e chama navigator.share({ title, url })
 * 3. Desktop / Navegador sem navigator.share: cria link temporário de 24h e copia para o clipboard
 */
export async function shareDocumentFileOrLink(
  doc: FamilyDocument,
  defaultDuration: ShareDurationOption = '24h',
): Promise<ShareDocumentResult> {
  const isNavShareAvailable =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  // Caso 1: Testar suporte ao compartilhamento nativo de arquivos
  if (isNavShareAvailable && typeof navigator.canShare === 'function') {
    try {
      const signedUrl = await getDocumentSignedUrl(doc.storage_path, 3600)
      const res = await fetch(signedUrl)
      if (!res.ok) {
        throw new Error(`Falha ao obter arquivo: HTTP ${res.status}`)
      }
      const blob = await res.blob()
      const mime = doc.mime_type || blob.type || 'application/octet-stream'
      const file = new File([blob], doc.file_name, { type: mime })

      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: doc.title,
        })
        return { method: 'native-file', success: true }
      }
    } catch (err: any) {
      // Se o usuário cancelou o share nativo (AbortError), não tenta fallback para não abrir popup duplicado
      if (err?.name === 'AbortError') {
        return { method: 'native-file', success: true }
      }
      console.warn(
        '[shareDocumentFileOrLink] Falha ao compartilhar arquivo nativo, tentando link:',
        err,
      )
    }
  }

  // Se não foi possível compartilhar o arquivo nativo, precisa do link temporário público
  const { publicUrl } = await createDocumentTemporaryShare(doc, defaultDuration)

  // Caso 2: Aparelho suporta navigator.share apenas com URL/texto
  if (isNavShareAvailable) {
    try {
      await navigator.share({
        title: doc.title,
        url: publicUrl,
      })
      return { method: 'native-link', success: true }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return { method: 'native-link', success: true }
      }
      console.warn(
        '[shareDocumentFileOrLink] Falha ao compartilhar URL nativa, caindo para clipboard:',
        err,
      )
    }
  }

  // Caso 3: Desktop ou sem navigator.share -> copia link para área de transferência
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(publicUrl)
  }
  return { method: 'clipboard-link', success: true, publicUrl }
}

export async function createDocumentTemporaryShare(
  doc: FamilyDocument,
  duration: ShareDurationOption,
): Promise<{ share: FamilyDocumentShare; publicUrl: string }> {
  const config = SHARE_DURATION_CONFIG[duration] || SHARE_DURATION_CONFIG['1h']
  const token = crypto.randomUUID().replace(/-/g, '') + Math.random().toString(36).substring(2, 8)
  const expiresAt = new Date(Date.now() + config.seconds * 1000).toISOString()

  const { data: authData } = await supabase.auth.getUser()
  const userId = authData?.user?.id
  if (!userId) {
    throw new Error('Usuário não autenticado.')
  }

  const { data, error } = await (supabase as any)
    .from('family_document_shares')
    .insert({
      document_id: doc.id,
      family_id: doc.family_id,
      created_by: userId,
      token,
      expires_at: expiresAt,
    })
    .select()
    .single()

  if (error) {
    console.error('Erro ao criar link de compartilhamento:', error)
    throw new Error('Não foi possível gerar o link de compartilhamento.')
  }

  const origin = window.location.origin
  const publicUrl = `${origin}/doc/${token}`

  return {
    share: data as FamilyDocumentShare,
    publicUrl,
  }
}

/**
 * Revoga um link temporário de compartilhamento
 */
export async function revokeDocumentShare(shareId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('family_document_shares')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', shareId)

  if (error) {
    console.error('Erro ao revogar link:', error)
    throw new Error('Não foi possível revogar o link de compartilhamento.')
  }
}

/**
 * Lista shares ativos de um documento
 */
export async function fetchDocumentActiveShares(
  documentId: string,
): Promise<FamilyDocumentShare[]> {
  const { data, error } = await (supabase as any)
    .from('family_document_shares')
    .select('*')
    .eq('document_id', documentId)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Erro ao buscar shares do documento:', error)
    return []
  }

  return (data as FamilyDocumentShare[]) || []
}

/**
 * Consulta RPC para rota pública /doc/:token (navegador sem login)
 */
export async function fetchSharedDocumentByToken(token: string): Promise<SharedDocumentPublicInfo> {
  const { data, error } = await (supabase as any).rpc('get_shared_document_by_token', {
    p_token: token,
  })

  if (error) {
    console.error('Erro ao consultar documento compartilhado:', error)
    return {
      valid: false,
      error: 'Não foi possível carregar os detalhes do documento.',
    }
  }

  return data as SharedDocumentPublicInfo
}

/**
 * Processamento simples no cliente para imagem escaneada:
 * - Redimensiona para resolução máx (ex.: 1800px)
 * - Aplica ajuste de contraste, brilho e nitidez para visual de documento impresso digitalizado
 * - Exporta como JPEG otimizado
 */

export interface ScanProcessingOptions {
  contrast?: number // ex: 1.25 (padrão)
  brightness?: number // ex: 1.05 (padrão)
  grayscale?: boolean // ex: false
  quality?: number // 0.88
  filterMode?: ScanFilterMode // 'color' | 'grayscale' | 'bw'
  corners?: QuadCorners | null // se fornecido, faz correção de perspectiva
  sharpen?: boolean // unsharp mask leve
}

export async function processScannedImage(
  imageSource: File | Blob | string,
  options: ScanProcessingOptions = {},
): Promise<Blob> {
  const {
    contrast = 1.25,
    brightness = 1.05,
    grayscale = false,
    quality = 0.88,
    filterMode = grayscale ? 'grayscale' : 'color',
    corners = null,
    sharpen = false,
  } = options

  return new Promise((resolve, reject) => {
    const img = new Image()

    let objectUrl = ''
    if (typeof imageSource === 'string') {
      img.src = imageSource
    } else {
      objectUrl = URL.createObjectURL(imageSource)
      img.src = objectUrl
    }

    img.onload = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)

      // Limita tamanho para não sobrecarregar mobile
      const maxDim = 1920
      let w = img.width
      let h = img.height

      let scaleFactor = 1
      if (w > maxDim || h > maxDim) {
        if (w > h) {
          scaleFactor = maxDim / w
          h = Math.round((h * maxDim) / w)
          w = maxDim
        } else {
          scaleFactor = maxDim / h
          w = Math.round((w * maxDim) / h)
          h = maxDim
        }
      }

      // 1. Desenha no canvas base redimensionado
      const baseCanvas = document.createElement('canvas')
      baseCanvas.width = w
      baseCanvas.height = h
      const baseCtx = baseCanvas.getContext('2d')

      if (!baseCtx) {
        reject(new Error('Canvas 2D context não suportado'))
        return
      }

      baseCtx.drawImage(img, 0, 0, w, h)

      // 2. Se houver cantos definidos, aplica homografia de perspectiva
      let processedCanvas: HTMLCanvasElement = baseCanvas

      if (corners) {
        // Ajusta cantos para a escala redimensionada caso img original tenha tamanho diferente
        const scaledCorners: QuadCorners = {
          topLeft: {
            x: Math.round(corners.topLeft.x * scaleFactor),
            y: Math.round(corners.topLeft.y * scaleFactor),
          },
          topRight: {
            x: Math.round(corners.topRight.x * scaleFactor),
            y: Math.round(corners.topRight.y * scaleFactor),
          },
          bottomRight: {
            x: Math.round(corners.bottomRight.x * scaleFactor),
            y: Math.round(corners.bottomRight.y * scaleFactor),
          },
          bottomLeft: {
            x: Math.round(corners.bottomLeft.x * scaleFactor),
            y: Math.round(corners.bottomLeft.y * scaleFactor),
          },
        }

        processedCanvas = warpPerspectiveCanvas(baseCanvas, scaledCorners)
      }

      // 3. Aplica pós-processamento (Colorido, Cinza, P&B adaptativo, Contraste, Brilho e Sharpening)
      const pCtx = processedCanvas.getContext('2d')
      if (pCtx) {
        const pImgData = pCtx.getImageData(0, 0, processedCanvas.width, processedCanvas.height)
        applyScanFiltersToImageData(pImgData, {
          contrast,
          brightness,
          filterMode,
          sharpen,
        })
        pCtx.putImageData(pImgData, 0, 0)
      }

      // 4. Exporta blob JPEG
      processedCanvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Falha ao exportar imagem escaneada'))
            return
          }
          resolve(blob)
        },
        'image/jpeg',
        quality,
      )
    }

    img.onerror = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      reject(new Error('Não foi possível ler a imagem para escaneamento.'))
    }
  })
}

/**
 * Função utilitária para acionar download local do arquivo como backup antes de exclusão
 */
export async function triggerLocalDocumentBackup(
  storagePath: string,
  fileName: string,
): Promise<void> {
  const signedUrl = await getDocumentSignedUrl(storagePath, 300)
  const response = await fetch(signedUrl)
  const blob = await response.blob()

  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.style.display = 'none'
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  window.URL.revokeObjectURL(url)
  document.body.removeChild(a)
}
