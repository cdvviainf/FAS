'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Icons } from '@/components/icons'

interface SelectMultipleOption {
  id: number
  label: string
}

interface SelectMultipleProps {
  options: SelectMultipleOption[]
  selectedIds: number[]
  onChange: (ids: number[]) => void
  placeholder?: string
  disabled?: boolean
}

export function SelectMultiple({ options, selectedIds, onChange, placeholder, disabled }: SelectMultipleProps) {
  const disponibles = options.filter((o) => !selectedIds.includes(o.id))

  function agregar(idStr: string) {
    onChange([...selectedIds, Number(idStr)])
  }
  function quitar(id: number) {
    onChange(selectedIds.filter((x) => x !== id))
  }

  return (
    <div className='space-y-1.5'>
      <Select value='' onValueChange={agregar} disabled={disabled || disponibles.length === 0}>
        <SelectTrigger>
          <SelectValue placeholder={disabled ? placeholder : (disponibles.length === 0 && options.length > 0 ? 'Todas agregadas' : (placeholder ?? 'Agregar...'))} />
        </SelectTrigger>
        <SelectContent>
          {disponibles.map((o) => (
            <SelectItem key={o.id} value={String(o.id)}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedIds.length > 0 && (
        <div className='flex flex-wrap gap-1.5'>
          {selectedIds.map((id) => {
            const opt = options.find((o) => o.id === id)
            return (
              <Badge key={id} variant='secondary' className='gap-1 pr-1'>
                {opt?.label ?? id}
                <button
                  type='button'
                  onClick={() => quitar(id)}
                  className='ml-0.5 rounded-sm hover:bg-muted-foreground/20'
                >
                  <Icons.close className='h-3 w-3' />
                </button>
              </Badge>
            )
          })}
        </div>
      )}
    </div>
  )
}
