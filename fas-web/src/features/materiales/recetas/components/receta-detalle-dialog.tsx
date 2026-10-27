'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { Receta } from '../types'

interface Props {
  receta?: Receta
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Vista de SOLO LECTURA de una receta: cabecera + grilla de componentes con la
// cantidad consumida. Disponible para usuarios con nivel LECTURA (que no pueden
// abrir el formulario de edición).
export function RecetaDetalleDialog({ receta, open, onOpenChange }: Props) {
  if (!receta) return null
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[90vh] max-w-lg overflow-auto'>
        <DialogHeader>
          <DialogTitle>Receta {receta.codigo}</DialogTitle>
          <DialogDescription>{receta.descripcion}</DialogDescription>
        </DialogHeader>

        <div className='space-y-3 py-1 text-sm'>
          <div className='grid grid-cols-2 gap-2'>
            <div>
              <p className='text-muted-foreground text-xs'>Embalaje</p>
              <p className='font-medium'>{receta.embalaje.codigo} — {receta.embalaje.descripcion}</p>
            </div>
            <div>
              <p className='text-muted-foreground text-xs'>Cantidad a producir</p>
              <p className='font-medium'>{receta.cantidadAProducir}</p>
            </div>
          </div>

          <div>
            <p className='text-muted-foreground mb-1 text-xs'>Componentes ({receta.detalle.length})</p>
            <div className='overflow-x-auto rounded-md border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Componente</TableHead>
                    <TableHead className='text-right'>Cantidad a consumir</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receta.detalle.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className='font-medium'>{d.componente.codigo}</TableCell>
                      <TableCell>{d.componente.descripcion}</TableCell>
                      <TableCell className='text-right'>{d.cantidadAConsumir}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
