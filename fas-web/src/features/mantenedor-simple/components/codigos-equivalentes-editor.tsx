'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Icons } from '@/components/icons'

// Editor de códigos alternativos de un maestro (Especie/Variedad/Categoría/
// Calibre) — mismo patrón que el de Artículos. La carga de stock los acepta
// además del código y la descripción del maestro (2026-10-14).
export interface CodigoEquivalenteDraft {
  codigo: string
  descripcion: string
}

// Hidrata el estado del editor desde el item (edición): descripción null → ''.
export function codigosEquivalentesDesdeItem(
  item?: { codigosEquivalentes?: { codigo: string; descripcion: string | null }[] },
): CodigoEquivalenteDraft[] {
  return (item?.codigosEquivalentes ?? []).map((c) => ({ codigo: c.codigo, descripcion: c.descripcion ?? '' }))
}

// Normaliza para el payload: trim, descripción vacía → null, descarta filas sin código.
export function codigosEquivalentesParaPayload(
  value: CodigoEquivalenteDraft[],
): { codigo: string; descripcion?: string | null }[] {
  return value
    .map((c) => ({ codigo: c.codigo.trim(), descripcion: c.descripcion.trim() || null }))
    .filter((c) => c.codigo !== '')
}

export function CodigosEquivalentesEditor({
  value,
  onChange,
}: {
  value: CodigoEquivalenteDraft[]
  onChange: (next: CodigoEquivalenteDraft[]) => void
}) {
  return (
    <div className='space-y-2'>
      <div className='flex items-center justify-between'>
        <Label>Códigos alternativos</Label>
        <Button type='button' variant='ghost' size='sm' onClick={() => onChange([...value, { codigo: '', descripcion: '' }])}>
          <Icons.add className='mr-1 h-4 w-4' /> Agregar
        </Button>
      </div>
      <p className='text-muted-foreground text-xs'>
        Otros códigos con los que la planta identifica este registro (cliente, proveedor, legacy). La carga de stock
        los acepta además del código y la descripción.
      </p>
      {value.length === 0 ? (
        <p className='text-muted-foreground text-xs italic'>Sin códigos alternativos.</p>
      ) : (
        <div className='space-y-2'>
          {value.map((c, i) => (
            <div key={i} className='flex items-center gap-2'>
              <Input
                value={c.codigo}
                onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, codigo: e.target.value } : x)))}
                placeholder='Código'
                className='w-32'
              />
              <Input
                value={c.descripcion}
                onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, descripcion: e.target.value } : x)))}
                placeholder='A qué corresponde (opcional)'
                className='flex-1'
              />
              <Button
                type='button'
                variant='ghost'
                size='icon'
                className='h-8 w-8 shrink-0'
                onClick={() => onChange(value.filter((_, j) => j !== i))}
              >
                <Icons.trash className='h-4 w-4' />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
