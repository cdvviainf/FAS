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
import { createArticuloMutation, updateArticuloMutation } from '../api/mutations';
import { articuloKeys } from '../api/queries';
import type { Articulo } from '../api/types';
import { toast } from 'sonner';
import { articuloSchema, type ArticuloFormValues } from '../schemas/articulo';
import { TIPO_OPTIONS, COSTEO_OPTIONS, UNIDAD_OPTIONS } from './articulos-table/options';

interface ArticuloFormSheetProps {
  articulo?: Articulo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ArticuloFormSheet({ articulo, open, onOpenChange }: ArticuloFormSheetProps) {
  const isEdit = !!articulo;
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    ...createArticuloMutation,
    onSuccess: () => {
      toast.success('Artículo creado correctamente');
      onOpenChange(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: articuloKeys.all });
    },
    onError: () => toast.error('Error al crear el artículo')
  });

  const updateMutation = useMutation({
    ...updateArticuloMutation,
    onSuccess: () => {
      toast.success('Artículo actualizado correctamente');
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: articuloKeys.all });
    },
    onError: () => toast.error('Error al actualizar el artículo')
  });

  const form = useAppForm({
    defaultValues: {
      tipo: articulo?.tipo ?? 'EMBALAJE',
      codigo: articulo?.codigo ?? '',
      descripcion: articulo?.descripcion ?? '',
      descripcionExtranjera: articulo?.descripcionExtranjera ?? '',
      unidad: articulo?.unidad ?? 'UN',
      tipoCosteo: articulo?.tipoCosteo ?? 'PROMEDIO_PONDERADO',
      valorEstandar: articulo?.valorEstandar ?? undefined,
      stockCritico: articulo?.stockCritico ?? undefined,
      activo: articulo?.activo ?? true
    } as ArticuloFormValues,
    validators: { onSubmit: articuloSchema },
    onSubmit: async ({ value }) => {
      if (isEdit) {
        await updateMutation.mutateAsync({ id: articulo.id, values: value });
      } else {
        await createMutation.mutateAsync(value);
      }
    }
  });

  const { FormTextField, FormSelectField, FormSwitchField } =
    useFormFields<ArticuloFormValues>();

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex flex-col sm:max-w-lg'>
        <SheetHeader>
          <SheetTitle>{isEdit ? 'Editar Artículo' : 'Nuevo Artículo'}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? 'Modifica los datos del artículo. El stock y los movimientos no se alteran.'
              : 'Completa los datos para crear un nuevo artículo en el catálogo.'}
          </SheetDescription>
        </SheetHeader>

        <div className='flex-1 overflow-auto py-2'>
          <form.AppForm>
            <form.Form id='articulo-form' className='space-y-4 px-1'>
              <div className='grid grid-cols-2 gap-4'>
                <FormSelectField
                  name='tipo'
                  label='Tipo'
                  required
                  options={TIPO_OPTIONS}
                  placeholder='Seleccionar tipo'
                />
                <FormTextField
                  name='codigo'
                  label='Código'
                  required
                  placeholder='EMB-001'
                  disabled={isEdit}
                />
              </div>

              <FormTextField
                name='descripcion'
                label='Descripción'
                required
                placeholder='Ej: Caja Madera Uva 8.2 kg'
              />

              <FormTextField
                name='descripcionExtranjera'
                label='Descripción extranjera'
                placeholder='Ej: Wood Box Grape 8.2 kg'
              />

              <FormSelectField
                name='unidad'
                label='Unidad de medida'
                required
                options={UNIDAD_OPTIONS}
                placeholder='Seleccionar unidad'
              />

              {/* Costeo y campos condicionales — observar tipo y tipoCosteo */}
              <form.Subscribe
                selector={(state) =>
                  [state.values.tipo, state.values.tipoCosteo] as const
                }
              >
                {([tipo, tipoCosteo]) => (
                  <>
                    <FormSelectField
                      name='tipoCosteo'
                      label='Tipo de costeo'
                      required
                      options={
                        tipo === 'SERVICIO'
                          ? COSTEO_OPTIONS.filter((o) => o.value === 'ESTANDAR')
                          : COSTEO_OPTIONS
                      }
                      placeholder='Seleccionar costeo'
                    />

                    {tipoCosteo === 'ESTANDAR' && (
                      <FormTextField
                        name='valorEstandar'
                        label='Valor estándar (CLP)'
                        required
                        type='number'
                        placeholder='0'
                      />
                    )}

                    {tipoCosteo === 'PROMEDIO_PONDERADO' && (
                      <FormTextField
                        name='stockCritico'
                        label='Stock crítico (alerta)'
                        type='number'
                        placeholder='0'
                      />
                    )}
                  </>
                )}
              </form.Subscribe>

              <FormSwitchField name='activo' label='Artículo activo' />
            </form.Form>
          </form.AppForm>
        </div>

        <SheetFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type='submit' form='articulo-form' isLoading={isPending}>
            <Icons.check className='mr-1 h-4 w-4' />
            {isEdit ? 'Guardar cambios' : 'Crear artículo'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export function ArticuloFormSheetTrigger() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Icons.add className='mr-2 h-4 w-4' />
        Nuevo artículo
      </Button>
      <ArticuloFormSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
