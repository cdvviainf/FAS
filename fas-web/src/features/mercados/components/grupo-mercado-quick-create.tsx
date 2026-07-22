'use client';

import { useState } from 'react';
import { useAppForm, useFormFields } from '@/components/ui/tanstack-form';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Icons } from '@/components/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { grupoMercadoKeys } from '@/features/grupos-mercado/api/queries';
import { createGrupoMercadoMutation } from '@/features/grupos-mercado/api/mutations';
import { grupoMercadoSchema, type GrupoMercadoFormValues } from '@/features/grupos-mercado/schemas/grupo-mercado';
import type { GrupoMercado } from '@/features/grupos-mercado/api/types';
import { usePuedeEscribir } from '@/hooks/use-item-acceso';

interface GrupoMercadoQuickCreateProps {
  onCreated: (grupo: GrupoMercado) => void;
}

function GrupoMercadoQuickDialog({
  open,
  onOpenChange,
  onCreated
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (grupo: GrupoMercado) => void;
}) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    ...createGrupoMercadoMutation,
    onSuccess: (newGrupo) => {
      queryClient.invalidateQueries({ queryKey: grupoMercadoKeys.all });
      toast.success(`Grupo "${newGrupo.descripcion}" creado`);
      onCreated(newGrupo);
      onOpenChange(false);
      form.reset();
    },
    onError: () => toast.error('Error al crear el grupo de mercado')
  });

  const form = useAppForm({
    defaultValues: { codigo: '', descripcion: '', descripcionExtranjera: '' } as GrupoMercadoFormValues,
    validators: { onSubmit: grupoMercadoSchema },
    onSubmit: async ({ value }) => { await mutation.mutateAsync(value); }
  });

  const { FormTextField } = useFormFields<GrupoMercadoFormValues>();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-sm'>
        <DialogHeader>
          <DialogTitle>Nuevo Grupo de Mercado</DialogTitle>
          <DialogDescription>
            El grupo quedará disponible inmediatamente en el selector.
          </DialogDescription>
        </DialogHeader>

        <form.AppForm>
          <form.Form id='grupo-quick-form' className='space-y-3'>
            <FormTextField name='codigo' label='Código' required placeholder='Ej: ASIA' />
            <FormTextField name='descripcion' label='Descripción' required placeholder='Ej: Asia' />
            <FormTextField name='descripcionExtranjera' label='Descripción extranjera' placeholder='Ej: Asia' />
          </form.Form>
        </form.AppForm>

        <DialogFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type='submit' form='grupo-quick-form' isLoading={mutation.isPending}>
            <Icons.check className='mr-1 h-4 w-4' />
            Crear grupo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function GrupoMercadoQuickCreate({ onCreated }: GrupoMercadoQuickCreateProps) {
  const [open, setOpen] = useState(false);
  const puedeEscribir = usePuedeEscribir('config.grupos-mercado');

  if (!puedeEscribir) return null;

  return (
    <>
      <Button
        type='button'
        variant='outline'
        size='icon'
        className='h-9 w-9 shrink-0 self-end'
        onClick={() => setOpen(true)}
        title='Crear nuevo grupo de mercado'
      >
        <Icons.add className='h-4 w-4' />
      </Button>
      {open && <GrupoMercadoQuickDialog open onOpenChange={setOpen} onCreated={onCreated} />}
    </>
  );
}
