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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface MultiComboboxOption {
  value: string;
  label: string;
  /** Cantidad (ej. cajas) que representa esta opción bajo el resto de los
   * filtros activos — si es 0 y la opción no está seleccionada, se muestra
   * deshabilitada (patrón de filtros en cascada: no puede elegirse una
   * combinación que ya no tiene datos). Si se omite, no se muestra contador
   * ni se deshabilita nada. */
  count?: number;
}

interface MultiComboboxProps {
  options: MultiComboboxOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  countSuffix?: string;
  disabled?: boolean;
  className?: string;
}

/** Select múltiple con búsqueda (Popover + Command) y soporte para filtros en
 * cascada: cada opción puede traer un contador que la deshabilita cuando
 * queda en 0 bajo los demás filtros activos. */
export function MultiCombobox({
  options,
  selected,
  onChange,
  placeholder = 'Todos',
  searchPlaceholder = 'Buscar...',
  emptyText = 'Sin resultados.',
  countSuffix,
  disabled,
  className
}: MultiComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const selectedSet = React.useMemo(() => new Set(selected), [selected]);

  function toggle(value: string) {
    if (selectedSet.has(value)) onChange(selected.filter((v) => v !== value));
    else onChange([...selected, value]);
  }

  let label = placeholder;
  if (selected.length > 0) {
    if (selected.length <= 2) {
      label = selected
        .map((v) => options.find((o) => o.value === v)?.label ?? v)
        .join(', ');
    } else {
      label = `${selected.length} seleccionados`;
    }
  }

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
            selected.length === 0 && 'text-muted-foreground',
            selected.length > 0 && 'border-primary bg-primary/5',
            className
          )}
        >
          <span className='truncate'>{label}</span>
          <Icons.chevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-(--radix-popover-trigger-width) p-0'>
        <Command filter={(value, search) => (value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selectedSet.has(option.value);
                const isDisabled = option.count === 0 && !isSelected;
                return (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    disabled={isDisabled}
                    onSelect={() => !isDisabled && toggle(option.value)}
                  >
                    <Icons.check className={cn('mr-2 h-4 w-4', isSelected ? 'opacity-100' : 'opacity-0')} />
                    <span className='flex-1 truncate'>{option.label}</span>
                    {option.count !== undefined && (
                      <span className='text-muted-foreground ml-2 text-xs tabular-nums'>
                        {option.count.toLocaleString('es-CL')}{countSuffix ? ` ${countSuffix}` : ''}
                      </span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
          {selected.length > 0 && (
            <button
              type='button'
              className='text-muted-foreground hover:text-destructive w-full border-t p-2 text-center text-xs'
              onClick={() => {
                onChange([]);
                setOpen(false);
              }}
            >
              Quitar filtro
            </button>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
