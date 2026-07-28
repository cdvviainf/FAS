'use client';

import { useState } from 'react';
import { useAppForm, useFormFields } from '@/components/ui/tanstack-form';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Icons } from '@/components/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { paisKeys } from '../api/queries';
import { createPaisMutation } from '../api/mutations';
import { paisSchema, type PaisFormValues } from '../schemas/pais';
import { usePuedeEscribir } from '@/hooks/use-item-acceso';
import { createMantenedorQueries } from '@/features/mantenedor-simple/queries';
import type { Pais } from '../api/types';

interface PaisQuickCreateProps {
  onCreated: (pais: Pais) => void;
}

function PaisQuickDialog({
  open,
  onOpenChange,
  onCreated
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (pais: Pais) => void;
}) {
  const queryClient = useQueryClient();

  const { data: mercadosData } = useQuery(createMantenedorQueries('mercados').listOptions({ limit: 300 }));
  const mercados = mercadosData?.data ?? [];

  const mutation = useMutation({
    ...createPaisMutation,
    onSuccess: (newPais) => {
      queryClient.invalidateQueries({ queryKey: paisKeys.all });
      toast.success(`País "${newPais.descripcion}" creado`);
      onCreated(newPais);
      onOpenChange(false);
      form.reset();
    },
    onError: () => toast.error('Error al crear el país')
  });

  const form = useAppForm({
    defaultValues: {
      codigo: '',
      descripcion: '',
      descripcionExtranjera: '',
      esPaisNacional: false,
      puedeSerOrigen: false,
      mercadoId: 0
    } as PaisFormValues,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validators: { onSubmit: paisSchema as any },
    onSubmit: async ({ value }) => { await mutation.mutateAsync(value); }
  });

  const { FormTextField, FormSwitchField } = useFormFields<PaisFormValues>();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-sm'>
        <DialogHeader>
          <DialogTitle>Nuevo País</DialogTitle>
          <DialogDescription>
            El país quedará disponible inmediatamente en el selector.
          </DialogDescription>
        </DialogHeader>

        <form.AppForm>
          <form.Form id='pais-quick-form' className='space-y-3'>
            <FormTextField
              name='codigo'
              label='Código ISO alfa-3'
              required
              placeholder='Ej: PER'
            />
            <FormTextField
              name='descripcion'
              label='Descripción'
              required
              placeholder='Ej: Perú'
            />
            <FormTextField
              name='descripcionExtranjera'
              label='Descripción extranjera'
              placeholder='Ej: Peru'
            />
            <FormSwitchField
              name='esPaisNacional'
              label='Es país nacional'
            />
            <FormSwitchField
              name='puedeSerOrigen'
              label='Puede ser país de origen'
            />
            <form.Field name='mercadoId'>
              {(field) => (
                <div className='space-y-1.5'>
                  <Label className='text-sm font-medium'>
                    Mercado <span className='text-destructive'>*</span>
                  </Label>
                  <Select
                    value={field.state.value ? String(field.state.value) : ''}
                    onValueChange={(v) => field.handleChange(Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder='Seleccionar mercado...' />
                    </SelectTrigger>
                    <SelectContent>
                      {mercados.map((m) => (
                        <SelectItem key={m.id} value={String(m.id)}>
                          {m.descripcion}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {field.state.meta.errors.length > 0 && (
                    <p className='text-sm text-destructive'>
                      {String(field.state.meta.errors[0])}
                    </p>
                  )}
                </div>
              )}
            </form.Field>
          </form.Form>
        </form.AppForm>

        <DialogFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type='submit' form='pais-quick-form' isLoading={mutation.isPending}>
            <Icons.check className='mr-1 h-4 w-4' />
            Crear país
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PaisQuickCreate({ onCreated }: PaisQuickCreateProps) {
  const [open, setOpen] = useState(false);
  const puedeEscribir = usePuedeEscribir('CONFIG_MANTENEDORES');

  if (!puedeEscribir) return null;

  return (
    <>
      <Button
        type='button'
        variant='outline'
        size='icon'
        className='h-9 w-9 shrink-0 self-end'
        onClick={() => setOpen(true)}
        title='Crear nuevo país'
      >
        <Icons.add className='h-4 w-4' />
      </Button>
      {open && <PaisQuickDialog open onOpenChange={setOpen} onCreated={onCreated} />}
    </>
  );
}
