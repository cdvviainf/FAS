'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Icons } from '@/components/icons'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { empresasService } from '../service'
import { empresasKeys } from '../queries'
import { ICONO_CLAUSULA_LABELS, type ClausulaOcInput, type EmpresaDetalle, type IconoClausula } from '../types'

const ITEM = 'CONFIG_EMPRESAS'

const CLAUSULA_VACIA: ClausulaOcInput = { icono: 'DOCUMENTO', tituloEs: '', textoEs: '', tituloEn: '', textoEn: '' }

// Términos y Condiciones del PDF de Orden de Compra (2026-11-06, plantilla v3):
// cláusulas ordenables (ícono + título/texto ES/EN) y nota final ES/EN. Se
// guardan con un reemplazo completo. Sin cláusulas → la OC sale sin hoja de
// términos. `{empresa}` en el texto se reemplaza por la razón social.
export function TerminosOcForm({ empresa }: { empresa: EmpresaDetalle }) {
  const queryClient = useQueryClient()
  const puedeEscribir = usePuedeEscribir(ITEM)
  const [clausulas, setClausulas] = useState<ClausulaOcInput[]>(() =>
    (empresa.clausulasOc ?? []).map(({ icono, tituloEs, textoEs, tituloEn, textoEn }) => ({ icono, tituloEs, textoEs, tituloEn, textoEn })),
  )
  const [notaEs, setNotaEs] = useState(empresa.notaTerminosOcEs ?? '')
  const [notaEn, setNotaEn] = useState(empresa.notaTerminosOcEn ?? '')
  // Reclamos del Cierre Comercial (2026-11-06): texto + línea de referencia, ES/EN.
  const [reclamos, setReclamos] = useState({
    textoEs: empresa.reclamosCierreEs ?? '',
    textoEn: empresa.reclamosCierreEn ?? '',
    refEs: empresa.reclamosCierreRefEs ?? '',
    refEn: empresa.reclamosCierreRefEn ?? '',
  })
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      empresasService.updateTerminosOc(empresa.id, {
        notaEs: notaEs.trim() || null,
        notaEn: notaEn.trim() || null,
        clausulas: clausulas.map((c) => ({ ...c, tituloEs: c.tituloEs.trim(), textoEs: c.textoEs.trim(), tituloEn: c.tituloEn.trim(), textoEn: c.textoEn.trim() })),
        reclamosCierre: {
          textoEs: reclamos.textoEs.trim() || null,
          textoEn: reclamos.textoEn.trim() || null,
          refEs: reclamos.refEs.trim() || null,
          refEn: reclamos.refEn.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success('Términos de documentos guardados')
      queryClient.invalidateQueries({ queryKey: empresasKeys.detail(empresa.id) })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al guardar los términos'),
  })

  function set(idx: number, patch: Partial<ClausulaOcInput>) {
    setClausulas((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)))
  }
  function mover(idx: number, delta: -1 | 1) {
    setClausulas((prev) => {
      const j = idx + delta
      if (j < 0 || j >= prev.length) return prev
      const copia = [...prev]
      ;[copia[idx], copia[j]] = [copia[j], copia[idx]]
      return copia
    })
  }
  function guardar() {
    const incompleta = clausulas.findIndex((c) => !c.tituloEs.trim() || !c.textoEs.trim() || !c.tituloEn.trim() || !c.textoEn.trim())
    if (incompleta >= 0) {
      setError(`La cláusula ${incompleta + 1} debe tener título y texto en español e inglés`)
      return
    }
    setError(null)
    mutation.mutate()
  }

  const soloLectura = !puedeEscribir

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>Términos de documentos</CardTitle>
        <CardDescription>
          Términos y Condiciones del PDF de Orden de Compra (sin cláusulas, la OC sale sin esa hoja) y recuadro de
          Reclamos del Cierre Comercial, en español e inglés. En las cláusulas, <code>{'{empresa}'}</code> inserta la razón
          social de la empresa.
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        {clausulas.length === 0 && (
          <p className='text-sm text-muted-foreground'>Sin cláusulas configuradas.</p>
        )}
        {clausulas.map((c, idx) => (
          <div key={idx} className='space-y-3 rounded-md border p-3'>
            <div className='flex items-center gap-2'>
              <span className='flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground'>{idx + 1}</span>
              <Select value={c.icono} onValueChange={(v) => set(idx, { icono: v as IconoClausula })} disabled={soloLectura}>
                <SelectTrigger className='w-56'><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(ICONO_CLAUSULA_LABELS) as IconoClausula[]).map((k) => (
                    <SelectItem key={k} value={k}>Ícono: {ICONO_CLAUSULA_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!soloLectura && (
                <div className='ml-auto flex gap-1'>
                  <Button type='button' variant='ghost' size='icon' className='h-8 w-8' title='Subir' disabled={idx === 0} onClick={() => mover(idx, -1)}>
                    <Icons.chevronUp className='h-4 w-4' />
                  </Button>
                  <Button type='button' variant='ghost' size='icon' className='h-8 w-8' title='Bajar' disabled={idx === clausulas.length - 1} onClick={() => mover(idx, 1)}>
                    <Icons.chevronDown className='h-4 w-4' />
                  </Button>
                  <Button type='button' variant='ghost' size='icon' className='h-8 w-8' title='Eliminar' onClick={() => setClausulas((prev) => prev.filter((_, i) => i !== idx))}>
                    <Icons.trash className='h-4 w-4' />
                  </Button>
                </div>
              )}
            </div>
            <div className='grid gap-3 md:grid-cols-2'>
              <div className='space-y-1.5'>
                <Label>Título (español)</Label>
                <Input value={c.tituloEs} onChange={(e) => set(idx, { tituloEs: e.target.value })} disabled={soloLectura} maxLength={200} />
                <Label>Texto (español)</Label>
                <Textarea value={c.textoEs} onChange={(e) => set(idx, { textoEs: e.target.value })} disabled={soloLectura} rows={4} maxLength={3000} />
              </div>
              <div className='space-y-1.5'>
                <Label>Título (inglés)</Label>
                <Input value={c.tituloEn} onChange={(e) => set(idx, { tituloEn: e.target.value })} disabled={soloLectura} maxLength={200} />
                <Label>Texto (inglés)</Label>
                <Textarea value={c.textoEn} onChange={(e) => set(idx, { textoEn: e.target.value })} disabled={soloLectura} rows={4} maxLength={3000} />
              </div>
            </div>
          </div>
        ))}
        {!soloLectura && (
          <Button type='button' variant='outline' size='sm' onClick={() => setClausulas((prev) => [...prev, { ...CLAUSULA_VACIA }])} disabled={clausulas.length >= 20}>
            <Icons.add className='mr-1 h-4 w-4' /> Agregar cláusula
          </Button>
        )}

        <div className='grid gap-3 md:grid-cols-2'>
          <div className='space-y-1.5'>
            <Label>Nota final (español)</Label>
            <Textarea value={notaEs} onChange={(e) => setNotaEs(e.target.value)} disabled={soloLectura} rows={3} maxLength={2000} />
          </div>
          <div className='space-y-1.5'>
            <Label>Nota final (inglés)</Label>
            <Textarea value={notaEn} onChange={(e) => setNotaEn(e.target.value)} disabled={soloLectura} rows={3} maxLength={2000} />
          </div>
        </div>

        <div className='space-y-3 border-t pt-4'>
          <div>
            <p className='text-sm font-semibold'>Reclamos — Cierre Comercial</p>
            <p className='text-xs text-muted-foreground'>
              Recuadro «Reclamos / Claims» del PDF del Cierre Comercial. Sin texto, el recuadro no se muestra.
            </p>
          </div>
          <div className='grid gap-3 md:grid-cols-2'>
            <div className='space-y-1.5'>
              <Label>Texto (español)</Label>
              <Textarea value={reclamos.textoEs} onChange={(e) => setReclamos((r) => ({ ...r, textoEs: e.target.value }))} disabled={soloLectura} rows={4} maxLength={3000} />
              <Label>Referencia (español)</Label>
              <Input value={reclamos.refEs} onChange={(e) => setReclamos((r) => ({ ...r, refEs: e.target.value }))} disabled={soloLectura} maxLength={300} placeholder='Protocolo de Reclamos — Ver documento adjunto' />
            </div>
            <div className='space-y-1.5'>
              <Label>Texto (inglés)</Label>
              <Textarea value={reclamos.textoEn} onChange={(e) => setReclamos((r) => ({ ...r, textoEn: e.target.value }))} disabled={soloLectura} rows={4} maxLength={3000} />
              <Label>Referencia (inglés)</Label>
              <Input value={reclamos.refEn} onChange={(e) => setReclamos((r) => ({ ...r, refEn: e.target.value }))} disabled={soloLectura} maxLength={300} placeholder='Claim Protocol — See attached document' />
            </div>
          </div>
        </div>

        {error && <p className='text-xs text-destructive'>{error}</p>}
        {!soloLectura && (
          <div className='flex justify-end'>
            <Button type='button' onClick={guardar} isLoading={mutation.isPending}>
              <Icons.check className='mr-1 h-4 w-4' /> Guardar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
