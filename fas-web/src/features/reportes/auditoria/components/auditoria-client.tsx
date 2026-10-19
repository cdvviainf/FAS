'use client'

import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Combobox } from '@/components/ui/combobox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Icons } from '@/components/icons'
import { auditoriaService } from '../service'
import { ACCION_LABELS } from '../types'
import type { AccionAuditoria, AuditLogRow, AuditoriaListParams } from '../types'

const fmtFechaHora = new Intl.DateTimeFormat('es-CL', {
  dateStyle: 'short',
  timeStyle: 'medium',
  timeZone: 'America/Santiago',
})

const ACCIONES: AccionAuditoria[] = ['LOGIN', 'LOGOUT', 'LOGIN_FALLIDO', 'ACCESO_MENU', 'CREAR', 'EDITAR', 'ELIMINAR']

// Las acciones de datos llevan color distinto para leer la bitácora de un vistazo.
function accionVariant(accion: AccionAuditoria): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (accion === 'CREAR') return 'default'
  if (accion === 'ELIMINAR' || accion === 'LOGIN_FALLIDO') return 'destructive'
  if (accion === 'EDITAR') return 'secondary'
  return 'outline'
}

interface FiltroForm {
  usuarioId: string
  accion: string
  entidad: string
  desde: string
  hasta: string
  q: string
}

const FILTRO_VACIO: FiltroForm = { usuarioId: '', accion: '', entidad: '', desde: '', hasta: '', q: '' }

const LIMIT = 20
// Debe coincidir con MAX_EXPORT del backend (auditoria.service.ts) — solo para
// el mensaje de truncado; el tope real lo aplica el servidor.
const MAX_EXPORT = 10_000

export function AuditoriaClient() {
  const [form, setForm] = useState<FiltroForm>(FILTRO_VACIO)
  const [aplicados, setAplicados] = useState<AuditoriaListParams>({})
  const [page, setPage] = useState(1)
  const [detalle, setDetalle] = useState<AuditLogRow | null>(null)
  const [exportando, setExportando] = useState(false)

  // Opciones desde la propia bitácora (mismo permiso CONFIG_AUDITORIA): no
  // depende del mantenedor de Usuarios (que exige CONFIG_USUARIOS).
  const { data: facetasData } = useQuery({
    queryKey: ['auditoria-facetas'],
    queryFn: () => auditoriaService.facetas(),
    staleTime: 60_000,
  })

  const { data, isPending, error } = useQuery({
    queryKey: ['auditoria', aplicados, page],
    queryFn: () => auditoriaService.list({ ...aplicados, page, limit: LIMIT }),
    placeholderData: keepPreviousData,
  })

  // Convierte el form a los filtros de API (fechas → datetime inicio/fin de día).
  function construirFiltros(): AuditoriaListParams {
    return {
      usuarioId: form.usuarioId || undefined,
      accion: (form.accion as AccionAuditoria) || undefined,
      entidad: form.entidad || undefined,
      q: form.q.trim() || undefined,
      // El backend compara creadoEn con `new Date(valor)`: para incluir el día
      // final completo, mando datetimes de inicio/fin de día (ISO con zona).
      desde: form.desde ? new Date(`${form.desde}T00:00:00`).toISOString() : undefined,
      hasta: form.hasta ? new Date(`${form.hasta}T23:59:59.999`).toISOString() : undefined,
    }
  }

  function aplicar() {
    setAplicados(construirFiltros())
    setPage(1)
  }

  async function exportar() {
    setExportando(true)
    try {
      const { blob, total, truncado } = await auditoriaService.exportCsv(aplicados)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'auditoria.csv'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      if (truncado) {
        toast.warning(`Exportación parcial: se descargaron las ${MAX_EXPORT.toLocaleString('es-CL')} filas más recientes de ${total.toLocaleString('es-CL')} coincidencias. Acota los filtros para exportar el resto.`)
      } else {
        toast.success(`CSV exportado (${total.toLocaleString('es-CL')} registro(s)).`)
      }
    } catch {
      toast.error('No se pudo exportar la auditoría.')
    } finally {
      setExportando(false)
    }
  }

  function limpiar() {
    setForm(FILTRO_VACIO)
    setAplicados({})
    setPage(1)
  }

  const usuarioOptions = (facetasData?.usuarios ?? []).map((u) => ({
    value: u.usuarioId,
    label: u.usuarioEmail ?? u.usuarioId,
  }))
  const entidadOptions = (facetasData?.entidades ?? []).map((e) => ({ value: e, label: e }))

  const rows = data?.data ?? []
  const totalPages = data?.meta.totalPages ?? 0
  const total = data?.meta.total ?? 0

  return (
    <div className='space-y-4'>
      <Card>
        <CardContent className='pt-6'>
          <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-5'>
            <div className='space-y-1.5 lg:col-span-2'>
              <Label>Usuario</Label>
              <Combobox
                options={usuarioOptions}
                value={form.usuarioId || null}
                onChange={(v) => setForm((f) => ({ ...f, usuarioId: v ?? '' }))}
                placeholder='Todos los usuarios'
                searchPlaceholder='Buscar usuario...'
              />
            </div>
            <div className='space-y-1.5'>
              <Label>Desde</Label>
              <Input type='date' value={form.desde} onChange={(e) => setForm((f) => ({ ...f, desde: e.target.value }))} />
            </div>
            <div className='space-y-1.5'>
              <Label>Hasta</Label>
              <Input type='date' value={form.hasta} onChange={(e) => setForm((f) => ({ ...f, hasta: e.target.value }))} />
            </div>
            <div className='space-y-1.5'>
              <Label>Acción</Label>
              <Select value={form.accion || 'TODAS'} onValueChange={(v) => setForm((f) => ({ ...f, accion: v === 'TODAS' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder='Todas' /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='TODAS'>Todas</SelectItem>
                  {ACCIONES.map((a) => (
                    <SelectItem key={a} value={a}>{ACCION_LABELS[a]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-1.5'>
              <Label>Entidad</Label>
              <Combobox
                options={entidadOptions}
                value={form.entidad || null}
                onChange={(v) => setForm((f) => ({ ...f, entidad: v ?? '' }))}
                placeholder='Todas'
                searchPlaceholder='Buscar entidad...'
              />
            </div>
            <div className='space-y-1.5 lg:col-span-2'>
              <Label>Buscar (ruta, email, id...)</Label>
              <Input
                value={form.q}
                onChange={(e) => setForm((f) => ({ ...f, q: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') aplicar() }}
                placeholder='Texto libre...'
              />
            </div>
            <div className='flex items-end gap-2 lg:col-span-5'>
              <Button onClick={aplicar}>Buscar</Button>
              <Button variant='outline' onClick={limpiar}>Limpiar</Button>
              <Button variant='outline' onClick={() => void exportar()} disabled={exportando} className='ml-auto'>
                <Icons.download className='mr-1 h-4 w-4' />
                {exportando ? 'Exportando...' : 'Exportar CSV'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <p className='text-destructive text-sm'>{(error as Error).message || 'Error al cargar la auditoría'}</p>
      ) : (
        <div className='space-y-3'>
          <div className='overflow-x-auto rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='whitespace-nowrap'>Fecha / Hora</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Acción</TableHead>
                  <TableHead>Entidad</TableHead>
                  <TableHead>Ruta</TableHead>
                  <TableHead className='w-20 text-right'>Detalle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isPending ? (
                  <TableRow><TableCell colSpan={6} className='text-muted-foreground py-6 text-center text-sm'>Cargando...</TableCell></TableRow>
                ) : rows.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className='text-muted-foreground py-6 text-center text-sm'>Sin registros para los filtros seleccionados.</TableCell></TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className='whitespace-nowrap'>{fmtFechaHora.format(new Date(row.creadoEn))}</TableCell>
                      <TableCell className='text-muted-foreground'>{row.usuarioEmail ?? '—'}</TableCell>
                      <TableCell><Badge variant={accionVariant(row.accion)}>{ACCION_LABELS[row.accion]}</Badge></TableCell>
                      <TableCell className='text-muted-foreground'>
                        {row.entidad ? `${row.entidad}${row.entidadId ? ` #${row.entidadId}` : ''}` : '—'}
                      </TableCell>
                      <TableCell className='text-muted-foreground max-w-[220px] truncate' title={row.ruta ?? ''}>{row.ruta ?? '—'}</TableCell>
                      <TableCell className='text-right'>
                        <Button variant='ghost' size='sm' onClick={() => setDetalle(row)}>Ver</Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className='flex items-center justify-between'>
            <p className='text-muted-foreground text-sm'>{total} registro(s)</p>
            <div className='flex items-center gap-2'>
              <Button variant='outline' size='sm' disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
              <span className='text-sm'>Página {page} de {Math.max(totalPages, 1)}</span>
              <Button variant='outline' size='sm' disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Siguiente</Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={detalle != null} onOpenChange={(open) => { if (!open) setDetalle(null) }}>
        <DialogContent className='max-h-[85vh] overflow-y-auto sm:max-w-2xl'>
          <DialogHeader>
            <DialogTitle>Detalle del evento</DialogTitle>
            <DialogDescription>
              {detalle ? `${ACCION_LABELS[detalle.accion]} · ${fmtFechaHora.format(new Date(detalle.creadoEn))}` : ''}
            </DialogDescription>
          </DialogHeader>
          {detalle && (
            <div className='space-y-3 text-sm'>
              <div className='grid grid-cols-2 gap-2'>
                <div><span className='text-muted-foreground'>Usuario:</span> {detalle.usuarioEmail ?? '—'}</div>
                <div><span className='text-muted-foreground'>Entidad:</span> {detalle.entidad ? `${detalle.entidad}${detalle.entidadId ? ` #${detalle.entidadId}` : ''}` : '—'}</div>
                <div><span className='text-muted-foreground'>Ruta:</span> {detalle.ruta ?? '—'}</div>
                <div><span className='text-muted-foreground'>IP:</span> {detalle.ip ?? '—'}</div>
              </div>
              {detalle.resumen != null && (
                <JsonBlock titulo='Resumen (operación masiva)' valor={detalle.resumen} />
              )}
              {detalle.datosAntes != null && <JsonBlock titulo='Datos antes' valor={detalle.datosAntes} />}
              {detalle.datosDespues != null && <JsonBlock titulo='Datos después' valor={detalle.datosDespues} />}
              {detalle.datosAntes == null && detalle.datosDespues == null && detalle.resumen == null && (
                <p className='text-muted-foreground'>Este evento no tiene datos de cambios asociados.</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function JsonBlock({ titulo, valor }: { titulo: string; valor: unknown }) {
  return (
    <div className='space-y-1'>
      <p className='text-muted-foreground text-xs font-medium'>{titulo}</p>
      <pre className='bg-muted max-h-64 overflow-auto rounded-md p-3 text-xs'>{JSON.stringify(valor, null, 2)}</pre>
    </div>
  )
}
