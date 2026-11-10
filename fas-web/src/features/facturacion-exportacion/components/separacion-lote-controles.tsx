'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TableCell, TableRow } from '@/components/ui/table'
import { formatMonto } from '@/lib/format'
import type { ProformaLineaSugerida } from '../types'
import { agregarLote, quitarLote, tieneLote } from '../separacion-lote'

// Casilla "Separar cantidades" + texto y valor unitario general (2026-11-10).
export function SeparacionCantidadesControl({
  activa,
  texto,
  valor,
  disabled,
  onChange,
}: {
  activa: boolean
  texto: string
  valor: string
  disabled?: boolean
  onChange: (cambios: { activa?: boolean; texto?: string; valor?: string }) => void
}) {
  return (
    <div className='space-y-2'>
      <label className='flex items-center gap-2 text-sm'>
        <Checkbox checked={activa} disabled={disabled} onCheckedChange={(c) => onChange({ activa: !!c })} />
        Separar cantidades
      </label>
      {activa && (
        <div className='flex flex-wrap items-end gap-4 pl-6'>
          <div className='w-[260px] space-y-1.5'>
            <Label>Texto</Label>
            <Input
              value={texto}
              maxLength={80}
              disabled={disabled}
              placeholder='Ej.: CAJAS PLASTICAS'
              onChange={(e) => onChange({ texto: e.target.value })}
              className='h-9'
            />
          </div>
          <div className='w-[160px] space-y-1.5'>
            <Label>Valor unitario</Label>
            <Input
              type='number'
              min={0}
              step='0.0001'
              value={valor}
              disabled={disabled}
              placeholder='0,5000'
              onChange={(e) => onChange({ valor: e.target.value })}
              className='h-9 text-right'
            />
          </div>
          <p className='text-muted-foreground max-w-md text-xs'>
            Cada línea agrega una fila con este texto y valor por las mismas cajas; el precio de la fruta baja en ese
            valor, así que el total no cambia. El valor se puede ajustar por línea.
          </p>
        </div>
      )}
    </div>
  )
}

// Fila de la cantidad separada bajo su línea de fruta (valor editable por línea).
export function FilaSeparacion({
  linea,
  disabled,
  onValorChange,
}: {
  linea: ProformaLineaSugerida
  disabled?: boolean
  onValorChange: (valor: number) => void
}) {
  if (!linea.separacion) return null
  const monto = Math.round(linea.separacion.precioUnitario * linea.cantidadCajas * 100) / 100
  return (
    <TableRow className='bg-muted/30'>
      <TableCell className='pl-6 text-sm'>↳ {linea.separacion.descripcion}</TableCell>
      <TableCell className='text-right tabular-nums'>{formatMonto(linea.cantidadCajas, 0)}</TableCell>
      <TableCell>
        <Input
          type='number'
          min={0}
          step='0.0001'
          value={linea.separacion.precioUnitario}
          disabled={disabled}
          onChange={(e) => onValorChange(Number(e.target.value))}
          className='h-8 text-right'
        />
      </TableCell>
      <TableCell className='text-right tabular-nums'>{formatMonto(monto)}</TableCell>
    </TableRow>
  )
}

// Casilla "Incluir LOTE": agrega/quita "LOTE: {N° Instructivo}" en Observaciones.
export function IncluirLoteCheckbox({
  observaciones,
  numeroInstructivo,
  disabled,
  onChange,
}: {
  observaciones: string
  numeroInstructivo: string | null
  disabled?: boolean
  onChange: (observaciones: string) => void
}) {
  const sinNumero = !numeroInstructivo?.trim()
  return (
    <label className='flex items-center gap-2 text-sm' title={sinNumero ? 'El Embarque no tiene N° de Instructivo' : undefined}>
      <Checkbox
        checked={tieneLote(observaciones, numeroInstructivo)}
        disabled={disabled || sinNumero}
        onCheckedChange={(c) => {
          if (sinNumero) return
          onChange(c ? agregarLote(observaciones, numeroInstructivo!) : quitarLote(observaciones, numeroInstructivo!))
        }}
      />
      Incluir LOTE{numeroInstructivo?.trim() ? ` (${numeroInstructivo.trim()})` : ''}
    </label>
  )
}
