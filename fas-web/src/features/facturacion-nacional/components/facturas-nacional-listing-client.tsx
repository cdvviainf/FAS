'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Icons } from '@/components/icons'
import { formatMonto, formatFechaCorta } from '@/lib/format'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { facturasNacionalListOptions, proformasFacturablesOptions, embarquesFacturablesOptions, facturasNacionalKeys } from '../queries'
import { facturaNacionalService } from '../service'
import type { EstadoFacturaNacional } from '../types'
import { ESTADO_FN_LABELS, ORIGEN_FN_LABELS } from '../types'

const ITEM = 'FACT_NACIONAL'

const ESTADO_VARIANT: Record<EstadoFacturaNacional, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  BORRADOR: 'secondary',
  ENVIADA_SII: 'secondary',
  APROBADA: 'default',
  RECHAZADA: 'destructive',
  ANULADA: 'outline',
}

export function FacturasNacionalListingClient() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const puedeEscribir = usePuedeEscribir(ITEM)

  const [tab, setTab] = useState('facturas')

  // ── Facturas ──
  const [estado, setEstado] = useState<EstadoFacturaNacional | 'TODOS'>('TODOS')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const limit = 20

  const { data: facturasData, isPending: facturasPending } = useQuery(
    facturasNacionalListOptions({
      ...(estado !== 'TODOS' ? { estado } : {}),
      ...(q.trim() ? { q: q.trim() } : {}),
      page,
      limit,
    }),
  )
  const facturas = facturasData?.data ?? []
  const facturasMeta = facturasData?.meta

  // ── Proformas facturables ──
  const [qProf, setQProf] = useState('')
  const [pageProf, setPageProf] = useState(1)
  const { data: facturablesData, isPending: facturablesPending } = useQuery(
    proformasFacturablesOptions({ ...(qProf.trim() ? { q: qProf.trim() } : {}), page: pageProf, limit }),
  )
  const facturables = facturablesData?.data ?? []
  const facturablesMeta = facturablesData?.meta

  // ── Embarques (ventas nacionales) facturables ──
  const [qEmb, setQEmb] = useState('')
  const [pageEmb, setPageEmb] = useState(1)
  const { data: embarquesData, isPending: embarquesPending } = useQuery(
    embarquesFacturablesOptions({ ...(qEmb.trim() ? { q: qEmb.trim() } : {}), page: pageEmb, limit }),
  )
  const embarques = embarquesData?.data ?? []
  const embarquesMeta = embarquesData?.meta

  const crear = useMutation({
    mutationFn: (proformaMaterialId: number) => facturaNacionalService.crearDesdeProforma(proformaMaterialId),
    onSuccess: ({ data }) => {
      queryClient.invalidateQueries({ queryKey: facturasNacionalKeys.all })
      toast.success(`Factura ${data.codigo} creada en borrador`)
      router.push(`/dashboard/facturacion/nacional/factura/${data.id}`)
    },
    onError: (err: Error) => toast.error(err.message || 'No se pudo crear la factura'),
  })

  const crearEmbarque = useMutation({
    mutationFn: (embarqueId: number) => facturaNacionalService.crearDesdeEmbarque(embarqueId),
    onSuccess: ({ data }) => {
      queryClient.invalidateQueries({ queryKey: facturasNacionalKeys.all })
      toast.success(`Factura ${data.codigo} creada en borrador`)
      router.push(`/dashboard/facturacion/nacional/factura/${data.id}`)
    },
    onError: (err: Error) => toast.error(err.message || 'No se pudo crear la factura'),
  })

  return (
    <Tabs value={tab} onValueChange={setTab} className='space-y-4'>
      <TabsList>
        <TabsTrigger value='facturas'>Facturas</TabsTrigger>
        <TabsTrigger value='facturables'>
          Materiales por facturar{facturablesMeta?.total ? ` (${facturablesMeta.total})` : ''}
        </TabsTrigger>
        <TabsTrigger value='embarques'>
          Ventas nacionales por facturar{embarquesMeta?.total ? ` (${embarquesMeta.total})` : ''}
        </TabsTrigger>
      </TabsList>

      {/* ───────────────── Facturas emitidas/borrador ───────────────── */}
      <TabsContent value='facturas' className='space-y-4'>
        <div className='flex flex-wrap items-end gap-3'>
          <div className='grid gap-1'>
            <label className='text-muted-foreground text-xs'>Buscar</label>
            <Input
              placeholder='Código o cliente…'
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setPage(1)
              }}
              className='w-64'
            />
          </div>
          <div className='grid gap-1'>
            <label className='text-muted-foreground text-xs'>Estado</label>
            <Select
              value={estado}
              onValueChange={(v) => {
                setEstado(v as EstadoFacturaNacional | 'TODOS')
                setPage(1)
              }}
            >
              <SelectTrigger className='w-44'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='TODOS'>Todos</SelectItem>
                {(Object.keys(ESTADO_FN_LABELS) as EstadoFacturaNacional[]).map((e) => (
                  <SelectItem key={e} value={e}>
                    {ESTADO_FN_LABELS[e]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className='rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>DTE</TableHead>
                <TableHead>Folio</TableHead>
                <TableHead className='text-right'>Total</TableHead>
                <TableHead>Fecha doc.</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {facturasPending ? (
                <TableRow>
                  <TableCell colSpan={8} className='text-muted-foreground py-8 text-center'>
                    Cargando…
                  </TableCell>
                </TableRow>
              ) : facturas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className='text-muted-foreground py-8 text-center'>
                    No hay facturas.
                  </TableCell>
                </TableRow>
              ) : (
                facturas.map((f) => (
                  <TableRow
                    key={f.id}
                    className='cursor-pointer'
                    onClick={() => router.push(`/dashboard/facturacion/nacional/factura/${f.id}`)}
                  >
                    <TableCell className='font-medium'>{f.codigo}</TableCell>
                    <TableCell className='text-muted-foreground text-sm'>
                      {ORIGEN_FN_LABELS[f.origenClase]}
                      {f.proformaMaterial ? ` · ${f.proformaMaterial.numero}` : ''}
                    </TableCell>
                    <TableCell>{f.cliente.razonSocial ?? f.cliente.descripcion}</TableCell>
                    <TableCell>{f.tipoDte}</TableCell>
                    <TableCell>{f.folio ?? '—'}</TableCell>
                    <TableCell className='text-right'>
                      {f.moneda.codigo} {formatMonto(f.montoTotal)}
                    </TableCell>
                    <TableCell>{f.fechaDocumento ? formatFechaCorta(f.fechaDocumento) : '—'}</TableCell>
                    <TableCell>
                      <Badge variant={ESTADO_VARIANT[f.estado]}>{ESTADO_FN_LABELS[f.estado]}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {facturasMeta && facturasMeta.totalPages > 1 && (
          <Paginacion page={page} totalPages={facturasMeta.totalPages} onChange={setPage} />
        )}
      </TabsContent>

      {/* ───────────────── Proformas por facturar ───────────────── */}
      <TabsContent value='facturables' className='space-y-4'>
        <div className='grid gap-1'>
          <label className='text-muted-foreground text-xs'>Buscar</label>
          <Input
            placeholder='N° proforma o cliente…'
            value={qProf}
            onChange={(e) => {
              setQProf(e.target.value)
              setPageProf(1)
            }}
            className='w-64'
          />
        </div>

        <div className='rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Proforma</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Moneda</TableHead>
                <TableHead className='text-right'>Líneas</TableHead>
                <TableHead>Creada</TableHead>
                <TableHead className='text-right'>Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {facturablesPending ? (
                <TableRow>
                  <TableCell colSpan={6} className='text-muted-foreground py-8 text-center'>
                    Cargando…
                  </TableCell>
                </TableRow>
              ) : facturables.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className='text-muted-foreground py-8 text-center'>
                    No hay proformas de materiales pendientes de facturar.
                  </TableCell>
                </TableRow>
              ) : (
                facturables.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className='font-medium'>{p.numero}</TableCell>
                    <TableCell>{p.entidad.razonSocial ?? '—'}</TableCell>
                    <TableCell>{p.moneda.codigo}</TableCell>
                    <TableCell className='text-right'>{p._count.lineas}</TableCell>
                    <TableCell>{formatFechaCorta(p.creadoEn)}</TableCell>
                    <TableCell className='text-right'>
                      <Button
                        size='sm'
                        disabled={!puedeEscribir || crear.isPending}
                        onClick={() => crear.mutate(p.id)}
                      >
                        <Icons.add className='mr-1 h-4 w-4' />
                        Crear factura
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {facturablesMeta && facturablesMeta.totalPages > 1 && (
          <Paginacion page={pageProf} totalPages={facturablesMeta.totalPages} onChange={setPageProf} />
        )}
      </TabsContent>

      {/* ───────────────── Embarques (ventas nacionales) por facturar ───────────────── */}
      <TabsContent value='embarques' className='space-y-4'>
        <div className='grid gap-1'>
          <label className='text-muted-foreground text-xs'>Buscar</label>
          <Input
            placeholder='Folio embarque o cliente…'
            value={qEmb}
            onChange={(e) => {
              setQEmb(e.target.value)
              setPageEmb(1)
            }}
            className='w-64'
          />
        </div>

        <div className='rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Embarque</TableHead>
                <TableHead>Cierre</TableHead>
                <TableHead>Cliente (exportadora)</TableHead>
                <TableHead>Despachado</TableHead>
                <TableHead className='text-right'>Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {embarquesPending ? (
                <TableRow>
                  <TableCell colSpan={5} className='text-muted-foreground py-8 text-center'>
                    Cargando…
                  </TableCell>
                </TableRow>
              ) : embarques.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className='text-muted-foreground py-8 text-center'>
                    No hay embarques de venta nacional despachados pendientes de facturar.
                  </TableCell>
                </TableRow>
              ) : (
                embarques.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className='font-medium'>{e.numeroInstructivo}</TableCell>
                    <TableCell className='text-muted-foreground'>{e.notaVenta.folio}</TableCell>
                    <TableCell>{e.notaVenta.cliente.razonSocial ?? '—'}</TableCell>
                    <TableCell>{e.despachadoEn ? formatFechaCorta(e.despachadoEn) : '—'}</TableCell>
                    <TableCell className='text-right'>
                      <Button size='sm' disabled={!puedeEscribir || crearEmbarque.isPending} onClick={() => crearEmbarque.mutate(e.id)}>
                        <Icons.add className='mr-1 h-4 w-4' />
                        Crear factura
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {embarquesMeta && embarquesMeta.totalPages > 1 && (
          <Paginacion page={pageEmb} totalPages={embarquesMeta.totalPages} onChange={setPageEmb} />
        )}
      </TabsContent>
    </Tabs>
  )
}

function Paginacion({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  return (
    <div className='flex items-center justify-end gap-2'>
      <Button variant='outline' size='sm' disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Anterior
      </Button>
      <span className='text-muted-foreground text-sm'>
        Página {page} de {totalPages}
      </span>
      <Button variant='outline' size='sm' disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        Siguiente
      </Button>
    </div>
  )
}
