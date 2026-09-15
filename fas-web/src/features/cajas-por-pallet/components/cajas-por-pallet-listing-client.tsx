'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import { AlertModal } from '@/components/modal/alert-modal'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { cajasPorPalletService } from '../service'
import type { CajasPorPallet } from '../types'
import { CajasPorPalletFormSheet } from './cajas-por-pallet-form-sheet'

const ITEM = 'CONFIG_CAJAS_POR_PALLET'

export function CajasPorPalletListingClient() {
  const puedeEscribir = usePuedeEscribir(ITEM)
  const queryClient = useQueryClient()
  const [editItem, setEditItem] = useState<CajasPorPallet | undefined>()
  const [formOpen, setFormOpen] = useState(false)
  const [deleteItem, setDeleteItem] = useState<CajasPorPallet | undefined>()

  const { data, isPending } = useQuery({
    queryKey: ['cajas-por-pallet'],
    queryFn: () => cajasPorPalletService.list({ limit: 500 }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => cajasPorPalletService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cajas-por-pallet'] })
      toast.success('Cifra eliminada')
      setDeleteItem(undefined)
    },
    onError: (e: Error) => toast.error(e.message || 'Error al eliminar'),
  })

  if (isPending) return <p className='text-muted-foreground text-sm'>Cargando...</p>

  const rows = data?.data ?? []

  return (
    <div className='space-y-3'>
      {rows.length === 0 ? (
        <p className='text-muted-foreground text-sm'>No hay cifras de cajas por pallet cargadas.</p>
      ) : (
        <div className='overflow-x-auto rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Embalaje</TableHead>
                <TableHead>Tipo de Pallet</TableHead>
                <TableHead className='text-right'>Cajas por Pallet</TableHead>
                {puedeEscribir && <TableHead className='w-24 text-right'>Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.articulo ? `${r.articulo.codigo} — ${r.articulo.descripcion}` : r.articuloId}</TableCell>
                  <TableCell>{r.tipoPallet ? `${r.tipoPallet.codigo} — ${r.tipoPallet.descripcion}` : r.tipoPalletId}</TableCell>
                  <TableCell className='text-right font-medium'>{r.cajasPorPallet}</TableCell>
                  {puedeEscribir && (
                    <TableCell className='text-right'>
                      <div className='flex justify-end gap-1'>
                        <Button variant='ghost' size='icon' className='h-8 w-8' onClick={() => { setEditItem(r); setFormOpen(true) }}>
                          <Icons.edit className='h-4 w-4' />
                        </Button>
                        <Button variant='ghost' size='icon' className='h-8 w-8' onClick={() => setDeleteItem(r)}>
                          <Icons.trash className='h-4 w-4' />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CajasPorPalletFormSheet
        item={editItem}
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o)
          if (!o) setEditItem(undefined)
        }}
      />

      <AlertModal
        isOpen={!!deleteItem}
        onClose={() => setDeleteItem(undefined)}
        onConfirm={() => deleteItem && deleteMutation.mutate(deleteItem.id)}
        loading={deleteMutation.isPending}
        title='Eliminar Cajas por Pallet'
        description='¿Eliminar esta cifra? Las OC/Instructivos/Notas de Venta que ya la usaron conservan el valor en su línea.'
      />
    </div>
  )
}
