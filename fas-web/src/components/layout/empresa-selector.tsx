'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command'
import { IconBuilding, IconCheck, IconChevronDown } from '@tabler/icons-react'
import { useEmpresa, type EmpresaItem } from '@/contexts/empresa-context'
import { cn } from '@/lib/utils'

// Espejo de TemporadaSelector (decisión #7, Docs/empresas.md). Siempre
// visible, igual que TemporadaSelector — con una sola empresa queda
// auto-seleccionada pero el selector se muestra igual.
export function EmpresaSelector() {
  const { empresaActiva, empresas, setEmpresaActiva } = useEmpresa()
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          size='sm'
          className='h-8 gap-1.5 text-xs font-medium'
          title='Cambiar empresa activa'
        >
          <IconBuilding className='h-3.5 w-3.5 text-muted-foreground' />
          <span className='hidden sm:inline'>
            {empresaActiva ? empresaActiva.codigo : 'Sin empresa'}
          </span>
          <IconChevronDown className='h-3 w-3 text-muted-foreground' />
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-64 p-0' align='end'>
        <Command>
          <CommandInput placeholder='Buscar empresa...' className='h-9' />
          <CommandEmpty>Sin resultados.</CommandEmpty>
          <CommandGroup>
            {empresas.map((e: EmpresaItem) => (
              <CommandItem
                key={e.id}
                value={e.razonSocial}
                onSelect={() => {
                  setEmpresaActiva(e)
                  setOpen(false)
                }}
                className='cursor-pointer'
              >
                <IconCheck
                  className={cn('mr-2 h-4 w-4', empresaActiva?.id === e.id ? 'opacity-100' : 'opacity-0')}
                />
                <div>
                  <span className='font-medium'>{e.codigo}</span>
                  <p className='text-xs text-muted-foreground'>{e.razonSocial}</p>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
