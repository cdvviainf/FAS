import { api } from '@/lib/api'

// Motor de Documentos (Etapa 4) — todo pasa por `api` (ky), NUNCA por
// navegación directa (<a href>/<iframe src>): ky es lo único que adjunta el
// header X-Empresa-Id (ver api.ts beforeRequestHook) — una navegación plana
// perdería la empresa activa en multiempresa y podría traer/mostrar el
// documento de la empresa equivocada (DOC-QA-002, ronda 1).
export const documentosService = {
  async previewHtml(tipo: string, id: number): Promise<string> {
    return api.get(`documentos/${tipo}/${id}/preview`).text()
  },

  async descargarPdfBlob(tipo: string, id: number): Promise<Blob> {
    return api.get(`documentos/${tipo}/${id}.pdf`).blob()
  },

  // Emisión oficial (Etapa 4 §4) — congela el payload y persiste
  // documentos_emitidos (backend, ver documentos.service.ts). Idempotente:
  // reemitir sin cambios en el documento origen reusa la emisión anterior
  // en vez de duplicar.
  async emitir(tipo: string, id: number): Promise<{ blob: Blob; documentoEmitidoId: number | null }> {
    const res = await api.post(`documentos/${tipo}/${id}/emitir`)
    const documentoEmitidoId = res.headers.get('X-Documento-Emitido-Id')
    const blob = await res.blob()
    return { blob, documentoEmitidoId: documentoEmitidoId ? Number(documentoEmitidoId) : null }
  },

  // Abre el PDF en una pestaña nueva a partir del blob descargado con el
  // contexto correcto — reemplaza el <a href> directo.
  async abrirPdf(tipo: string, id: number): Promise<void> {
    const blob = await this.descargarPdfBlob(tipo, id)
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank', 'noopener,noreferrer')
    // Revoca después de dar tiempo a que la pestaña nueva cargue el blob.
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  },
}
