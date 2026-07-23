'use client';

import { useState } from 'react';
import { useAppForm, useFormFields } from '@/components/ui/tanstack-form';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { Icons } from '@/components/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createRegionMutation, updateRegionMutation } from '../api/mutations';
import { regionKeys } from '../api/queries';
import type { Region } from '../api/types';
import { toast } from 'sonner';
import { regionSchema, type RegionFormValues } from '../schemas/region';

interface RegionFormSheetProps {
  region?: Region;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RegionFormSheet({ region, open, onOpenChange }: RegionFormSheetProps) {
  const isEdit = !!region;
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    ...createRegionMutation,
    onSuccess: () => {
      toast.success('Región creada correctamente');
      onOpenChange(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: regionKeys.all });
    },
    onError: () => toast.error('Error al crear la región')
  });

  const updateMutation = useMutation({
    ...updateRegionMutation,
    onSuccess: () => {
      toast.success('Región actualizada correctamente');
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: regionKeys.all });
    },
    onError: () => toast.error('Error al actualizar la región')
  });

  const form = useAppForm({
    defaultValues: {
      codigo: region?.codigo ?? '',
      descripcion: region?.descripcion ?? '',
      descripcionExtranjera: region?.descripcionExtranjera ?? ''
    } as RegionFormValues,
    validators: { onSubmit: regionSchema },
    onSubmit: async ({ value }) => {
      if (isEdit) {
        await updateMutation.mutateAsync({ id: region.id, values: value });
      } else {
        await createMutation.mutateAsync(value);
      }
    }
  });

  const { FormTextField } = useFormFields<RegionFormValues>();

  const isPending = createMutation.isPending || updateMutation.isPending;

  // El Sheet permanece montado entre aperturas (lo controla el padre vía `open`),
  // asi que hay que resetear el form manualmente al cerrar (Cancelar, Escape, click afuera);
  // si no, reabrir "Nuevo" muestra los valores tipeados en la sesion anterior.
  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) form.reset()
    onOpenChange(nextOpen)
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className='flex flex-col sm:max-w-md'>
        <SheetHeader>
          <SheetTitle>{isEdit ? 'Editar Región' : 'Nueva Región'}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? 'Modifica los datos de la región.'
              : 'Completa los datos para registrar una nueva región.'}
          </SheetDescription>
        </SheetHeader>

        <div className='flex-1 overflow-auto py-2'>
          <form.AppForm>
            <form.Form id='region-form' className='space-y-4 px-1'>
              <FormTextField
                name='codigo'
                label='Código'
                required
                placeholder='Ej: RM, V, XV'
                disabled={isEdit}
              />
              <FormTextField
                name='descripcion'
                label='Descripción'
                required
                placeholder='Ej: Región Metropolitana de Santiago'
              />
              <FormTextField
                name='descripcionExtranjera'
                label='Descripción extranjera'
                placeholder='Ej: Metropolitan Region of Santiago'
              />
            </form.Form>
          </form.AppForm>
        </div>

        <SheetFooter>
          <Button type='button' variant='outline' onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button type='submit' form='region-form' isLoading={isPending}>
            <Icons.check className='mr-1 h-4 w-4' />
            {isEdit ? 'Guardar cambios' : 'Crear región'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export function RegionFormSheetTrigger() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Icons.add className='mr-2 h-4 w-4' />
        Nueva región
      </Button>
      <RegionFormSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
