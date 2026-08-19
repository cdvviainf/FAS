'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Icons } from '@/components/icons'
import { documentosService } from '../service'

interface DocumentoPreviewDialogProps {
  tipo: string
  id: number
  titulo: string
  open: boolean
  onOpenChange: (open: boolean) => void
  // Nivel TOTAL sobre el itemMenu del documento (lo resuelve el caller, que
  // ya conoce cuál es — ej. usePuedeEscribir('COMPRAS_OC')). Sin esto no se
  // ofrece "Emitir": el backend igual lo exige (documentos.routes.ts), pero
  // no tiene sentido mostrar un botón que va a devolver 403.
  puedeEmitir?: boolean
  // Etapa 4 §8 — "control de copia": documentos como la OC o el Cierre
  // Comercial tienen versión BORRADOR (marca de agua) y versión oficial
  // (Emitir). Documentos sin control de copia (Instructivo, Solicitud) no
  // tienen ese concepto — sin esto, `false` — nunca se ofrece Emitir (aunque
  // `puedeEmitir` venga true) y el preview/descarga se muestran sin ninguna
  // marca de agua ni lenguaje de "borrador" (el backend ya no la estampa,
  // ver documentos.service.ts — este flag solo ajusta el copy de la UI).
  controlCopia?: boolean
  // Orientación de `pagina` en el registro del documento (documentos.registry.ts)
  // — el frontend no puede importar el registro (repos separados, CLAUDE.md
  // §2), así que cada caller la declara junto al `tipo` (ambos son estáticos
  // por documento). Default portrait: todos los documentos salvo el
  // Instructivo de Embalaje son A4 vertical (FAS-DOC-R1-001).
  orientacion?: 'portrait' | 'landscape'
}

// Tamaño de página A4 en px CSS a 96dpi (210mm × 297mm) — mismo formato que
// paginaOpts en las plantillas (ver templates/*/v1/index.tsx). En horizontal
// se invierten (FAS-DOC-R1-001, ronda QA 1): sin esto el iframe forzaba
// siempre el ancho vertical y el Instructivo de Embalaje (A4 horizontal) se
// veía comprimido/cortado en vez del layout real que produce Playwright.
const PAGINA_A4_PORTRAIT = { ancho: 794, alto: 1123 }
const PAGINA_A4_LANDSCAPE = { ancho: 1123, alto: 794 }

// Motor de Documentos — visor de preview (Etapa 4 §9, Sprint A: "iframe con
// páginas A4 y sombra"). Es el MISMO HTML que Playwright fotografía para el
// PDF (§1: "el preview es el PDF") — se pide vía ky (documentosService, ver
// nota sobre X-Empresa-Id) y se inyecta con srcDoc, nunca con src={url}
// directo al endpoint (mismo motivo: perdería la empresa activa).
//
// El iframe mantiene el tamaño A4 real (794×1123px) para que el HTML se
// renderice igual que en el PDF, pero se escala con transform para caber en
// el contenedor — sin esto, en modales angostos o viewports chicos la hoja
// se corta en vez de reducirse (ver nota de ajuste en el dialog).
export function DocumentoPreviewDialog({ tipo, id, titulo, open, onOpenChange, puedeEmitir, controlCopia = true, orientacion = 'portrait' }: DocumentoPreviewDialogProps) {
  const contenedorRef = useRef<HTMLDivElement>(null)
  const [escala, setEscala] = useState(1)
  const { ancho: paginaAncho, alto: paginaAlto } = orientacion === 'landscape' ? PAGINA_A4_LANDSCAPE : PAGINA_A4_PORTRAIT

  useEffect(() => {
    const contenedor = contenedorRef.current
    if (!contenedor) return
    const observer = new ResizeObserver(([entry]) => {
      const anchoDisponible = entry.contentRect.width
      setEscala(Math.min(1, anchoDisponible / paginaAncho))
    })
    observer.observe(contenedor)
    return () => observer.disconnect()
  }, [paginaAncho])

  // keepPreviousData en vez de un useState+useEffect propio: evita mostrar
  // el HTML de un documento anterior como flash en blanco al reabrir el
  // diálogo para otro id, sin el patrón "sincronizar prop a state" que
  // react-hooks/set-state-in-effect bloquea en este proyecto.
  const { data: html, isPending, isError } = useQuery({
    queryKey: ['documento-preview', tipo, id],
    queryFn: () => documentosService.previewHtml(tipo, id),
    enabled: open,
    staleTime: 0,
    placeholderData: keepPreviousData,
  })

  const [descargando, setDescargando] = useState(false)
  async function descargar() {
    setDescargando(true)
    try {
      await documentosService.abrirPdf(tipo, id)
    } catch {
      toast.error('No se pudo descargar el PDF')
    } finally {
      setDescargando(false)
    }
  }

  const [emitiendo, setEmitiendo] = useState(false)
  async function emitir() {
    setEmitiendo(true)
    try {
      const { blob, documentoEmitidoId } = await documentosService.emitir(tipo, id)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener,noreferrer')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
      toast.success(documentoEmitidoId ? `Documento emitido — folio interno #${documentoEmitidoId}` : 'Documento emitido')
    } catch {
      toast.error('No se pudo emitir el documento')
    } finally {
      setEmitiendo(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='flex max-h-[90vh] max-w-[calc(100%-2rem)] flex-col sm:max-w-4xl'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            {titulo}
            {controlCopia && <Badge variant='secondary'>Vista previa — borrador</Badge>}
          </DialogTitle>
          {/* FAS-DOC-R1-001 (ronda QA 2, arbitrado BUG_REAL): antes decía "es
              exactamente este HTML" — falso para un documento largo, donde el
              PDF corta en varias hojas (@page/Chromium) y este visor todavía
              muestra todo en una sola superficie desplazable (sin Paged.js,
              diferido a Sprint B, ver Docs/agrosan_etapa4_motor_documentos.md). */}
          <DialogDescription>
            El diseño y contenido son los del PDF final. En documentos largos, el PDF puede cortar en varias hojas — esta
            vista previa por ahora se desplaza en una sola.
          </DialogDescription>
        </DialogHeader>

        <div ref={contenedorRef} className='flex-1 overflow-auto rounded-md bg-muted/40 p-6'>
          {isPending && <p className='text-sm text-muted-foreground'>Cargando vista previa…</p>}
          {isError && <p className='text-sm text-destructive'>No se pudo cargar la vista previa.</p>}
          {html && (
            <div className='mx-auto' style={{ width: paginaAncho * escala, height: paginaAlto * escala }}>
              <iframe
                title={titulo}
                srcDoc={html}
                className='block origin-top-left border-0 bg-white shadow-lg'
                style={{ width: paginaAncho, height: paginaAlto, transform: `scale(${escala})` }}
              />
            </div>
          )}
        </div>

        <div className='flex justify-end gap-2'>
          <Button variant='outline' onClick={() => onOpenChange(false)}>Cerrar</Button>
          <Button variant='outline' onClick={descargar} isLoading={descargando}>
            <Icons.download className='mr-1 h-4 w-4' /> {controlCopia ? 'Descargar borrador' : 'Descargar PDF'}
          </Button>
          {controlCopia && puedeEmitir && (
            <Button onClick={emitir} isLoading={emitiendo}>
              <Icons.check className='mr-1 h-4 w-4' /> Emitir documento oficial
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
