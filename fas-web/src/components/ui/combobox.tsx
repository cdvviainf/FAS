'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';

export interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string | null | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  /**
   * Si se define, agrega al tope una opción con este texto (ej. "Sin definir")
   * que devuelve `onNone()` — permite volver a "vacío" después de elegir un valor
   * (2026-11-05). Sin `noneLabel` el comportamiento es el de siempre.
   */
  noneLabel?: string;
  onNone?: () => void;
}

/** Sentinel compartido para la opción "ninguno" de los Select de shadcn/Radix. */
export const NONE_VALUE = '__none__';

/** Select con búsqueda (Popover + Command), para listas largas (comunas, entidades, etc.). */
export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Seleccionar...',
  searchPlaceholder = 'Buscar...',
  emptyText = 'Sin resultados.',
  disabled,
  className,
  noneLabel,
  onNone
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type='button'
          variant='outline'
          role='combobox'
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full justify-between font-normal',
            !selected && 'text-muted-foreground',
            className
          )}
        >
          <span className='truncate' title={selected?.label}>{selected ? selected.label : placeholder}</span>
          <Icons.chevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
        </Button>
      </PopoverTrigger>
      {/* Ancho según contenido (2026-11-20): mínimo el del trigger, máximo
          36rem o el viewport, alineado a la izquierda — los labels largos
          (ej. "código — descripción" de embalajes) se leen completos. */}
      <PopoverContent
        align='start'
        className='w-auto min-w-(--radix-popover-trigger-width) max-w-[min(36rem,calc(100vw_-_2rem))] p-0'
      >
        <Command filter={(value, search) => (value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup className='px-0.5'>
              {noneLabel && (
                <CommandItem
                  key={NONE_VALUE}
                  value={noneLabel}
                  className='px-1.5'
                  onSelect={() => {
                    onNone?.();
                    setOpen(false);
                  }}
                >
                  <span className='text-muted-foreground truncate italic'>{noneLabel}</span>
                  <Icons.check className={cn('ml-auto h-4 w-4 shrink-0', !selected ? 'opacity-100' : 'opacity-0')} />
                </CommandItem>
              )}
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  className='px-1.5'
                  onSelect={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <span className='truncate' title={option.label}>{option.label}</span>
                  <Icons.check
                    className={cn(
                      'ml-auto h-4 w-4 shrink-0',
                      value === option.value ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
