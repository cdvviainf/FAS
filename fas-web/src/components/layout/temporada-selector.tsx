'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command'
import { IconCalendarClock, IconCheck, IconChevronDown } from '@tabler/icons-react'
import { createMantenedorQueries } from '@/features/mantenedor-simple/queries'
import { useTemporada } from '@/contexts/temporada-context'
import { cn } from '@/lib/utils'
import type { MantenedorSimple } from '@/features/mantenedor-simple/types'

export function TemporadaSelector() {
  const { temporada, setTemporada } = useTemporada()
  const [open, setOpen] = useState(false)

  const temporadasQueries = createMantenedorQueries('temporadas')
  const { data } = useQuery(temporadasQueries.listOptions({ limit: 100, soloActivos: true }))
  const temporadas = (data?.data ?? []) as MantenedorSimple[]

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          size='sm'
          className='h-8 gap-1.5 text-xs font-medium'
          title='Cambiar temporada activa'
        >
          <IconCalendarClock className='h-3.5 w-3.5 text-muted-foreground' />
          <span className='hidden sm:inline'>
            {temporada ? temporada.codigo : 'Sin temporada'}
          </span>
          <IconChevronDown className='h-3 w-3 text-muted-foreground' />
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-64 p-0' align='end'>
        <Command>
          <CommandInput placeholder='Buscar temporada...' className='h-9' />
          <CommandEmpty>Sin resultados.</CommandEmpty>
          <CommandGroup>
            {temporadas.map((t) => (
              <CommandItem
                key={t.id}
                value={t.descripcion}
                onSelect={() => {
                  setTemporada({ id: t.id, codigo: t.codigo, descripcion: t.descripcion })
                  setOpen(false)
                }}
                className='cursor-pointer'
              >
                <IconCheck
                  className={cn('mr-2 h-4 w-4', temporada?.id === t.id ? 'opacity-100' : 'opacity-0')}
                />
                <div>
                  <span className='font-medium'>{t.codigo}</span>
                  <p className='text-xs text-muted-foreground'>{t.descripcion}</p>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
