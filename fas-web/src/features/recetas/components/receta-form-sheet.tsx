'use client';

import { useRef, useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Icons } from '@/components/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createRecetaMutation, updateRecetaMutation } from '../api/mutations';
import { recetaKeys } from '../api/queries';
import { EMBALAJE_OPTIONS, COMPONENTE_OPTIONS } from '../api/service';
import type { Receta, RecetaDetallePayload } from '../api/types';
import { toast } from 'sonner';
import { recetaSchema, type RecetaFormValues } from '../schemas/receta';
import { Separator } from '@/components/ui/separator';

interface LocalDetalleItem {
  tempId: number;
  componenteId: number;
  cantidadAConsumir: number;
}

interface RecetaFormSheetProps {
  receta?: Receta;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

let tempIdCounter = 1000;

export function RecetaFormSheet({ receta, open, onOpenChange }: RecetaFormSheetProps) {
  const isEdit = !!receta;
  const queryClient = useQueryClient();

  const [detalleItems, setDetalleItems] = useState<LocalDetalleItem[]>(
    () =>
      receta?.detalle.map((d) => ({
        tempId: tempIdCounter++,
        componenteId: d.componenteId,
        cantidadAConsumir: d.cantidadAConsumir
      })) ?? []
  );
  const detalleRef = useRef(detalleItems);
  detalleRef.current = detalleItems;

  const createMutation = useMutation({
    ...createRecetaMutation,
    onSuccess: () => {
      toast.success('Receta creada correctamente');
      onOpenChange(false);
      form.reset();
      setDetalleItems([]);
      queryClient.invalidateQueries({ queryKey: recetaKeys.all });
    },
    onError: () => toast.error('Error al crear la receta')
  });

  const updateMutation = useMutation({
    ...updateRecetaMutation,
    onSuccess: () => {
      toast.success('Receta actualizada correctamente');
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: recetaKeys.all });
    },
    onError: () => toast.error('Error al actualizar la receta')
  });

  const form = useAppForm({
    defaultValues: {
      embalajeId: receta ? String(receta.embalajeId) : '',
      codigo: receta?.codigo ?? '',
      descripcion: receta?.descripcion ?? '',
      cantidadAProducir: receta ? String(receta.cantidadAProducir) : '',
      activo: receta?.activo ?? true
    } as unknown as RecetaFormValues,
    validators: { onSubmit: recetaSchema },
    onSubmit: async ({ value }) => {
      const detalle: RecetaDetallePayload[] = detalleRef.current.map(
        ({ componenteId, cantidadAConsumir }) => ({ componenteId, cantidadAConsumir })
      );
      const payload = { ...value, detalle };
      if (isEdit) {
        await updateMutation.mutateAsync({ id: receta.id, values: payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
    }
  });

  const { FormTextField, FormSelectField, FormSwitchField } = useFormFields<RecetaFormValues>();
  const isPending = createMutation.isPending || updateMutation.isPending;

  function addItem() {
    setDetalleItems((prev) => [
      ...prev,
      { tempId: tempIdCounter++, componenteId: 0, cantidadAConsumir: 0 }
    ]);
  }

  function removeItem(tempId: number) {
    setDetalleItems((prev) => prev.filter((i) => i.tempId !== tempId));
  }

  function updateItem(tempId: number, field: keyof Omit<LocalDetalleItem, 'tempId'>, value: number) {
    setDetalleItems((prev) =>
      prev.map((i) => (i.tempId === tempId ? { ...i, [field]: value } : i))
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex flex-col sm:max-w-xl'>
        <SheetHeader>
          <SheetTitle>{isEdit ? 'Editar Receta' : 'Nueva Receta'}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? 'Modifica los datos de la receta y sus componentes.'
              : 'Define un embalaje y los materiales/servicios necesarios para producirlo.'}
          </SheetDescription>
        </SheetHeader>

        <div className='flex-1 overflow-auto py-2'>
          <form.AppForm>
            <form.Form id='receta-form' className='space-y-4 px-1'>
              {/* Datos principales */}
              <div className='grid grid-cols-2 gap-4'>
                <div className='col-span-2'>
                  <FormSelectField
                    name='embalajeId'
                    label='Embalaje a producir'
                    required
                    options={EMBALAJE_OPTIONS}
                    placeholder='Seleccionar embalaje'
                  />
                </div>
              </div>

              <div className='grid grid-cols-2 gap-4'>
                <FormTextField
                  name='codigo'
                  label='Código'
                  required
                  placeholder='REC-001'
                  disabled={isEdit}
                />
                <FormTextField
                  name='cantidadAProducir'
                  label='Cantidad a producir'
                  required
                  type='number'
                  placeholder='100'
                />
              </div>

              <FormTextField
                name='descripcion'
                label='Descripción'
                required
                placeholder='Ej: Receta Uva Madera Exportación'
              />

              <FormSwitchField name='activo' label='Receta activa' />

              {/* Sección de componentes */}
              <div className='space-y-3'>
                <Separator />
                <div className='flex items-center justify-between'>
                  <div>
                    <p className='text-sm font-medium'>Componentes</p>
                    <p className='text-xs text-muted-foreground'>
                      Materiales y servicios necesarios
                    </p>
                  </div>
                  <Button type='button' variant='outline' size='sm' onClick={addItem}>
                    <Icons.add className='mr-1 h-3.5 w-3.5' />
                    Agregar
                  </Button>
                </div>

                {detalleItems.length === 0 ? (
                  <div className='rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground'>
                    Sin componentes. Haz clic en "Agregar" para añadir uno.
                  </div>
                ) : (
                  <div className='space-y-2'>
                    <div className='grid grid-cols-[1fr_100px_32px] gap-2 text-xs font-medium text-muted-foreground px-1'>
                      <span>Componente</span>
                      <span>Cantidad</span>
                      <span />
                    </div>
                    {detalleItems.map((item) => (
                      <div key={item.tempId} className='grid grid-cols-[1fr_100px_32px] gap-2 items-center'>
                        <Select
                          value={item.componenteId ? String(item.componenteId) : ''}
                          onValueChange={(v) => updateItem(item.tempId, 'componenteId', Number(v))}
                        >
                          <SelectTrigger className='h-8 text-xs'>
                            <SelectValue placeholder='Seleccionar…' />
                          </SelectTrigger>
                          <SelectContent>
                            {COMPONENTE_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value} className='text-xs'>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type='number'
                          min='0'
                          step='0.001'
                          className='h-8 text-xs'
                          value={item.cantidadAConsumir || ''}
                          onChange={(e) =>
                            updateItem(item.tempId, 'cantidadAConsumir', parseFloat(e.target.value) || 0)
                          }
                          placeholder='0'
                        />
                        <Button
                          type='button'
                          variant='ghost'
                          size='icon'
                          className='h-8 w-8 text-destructive hover:text-destructive'
                          onClick={() => removeItem(item.tempId)}
                        >
                          <Icons.close className='h-3.5 w-3.5' />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </form.Form>
          </form.AppForm>
        </div>

        <SheetFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type='submit' form='receta-form' isLoading={isPending}>
            <Icons.check className='mr-1 h-4 w-4' />
            {isEdit ? 'Guardar cambios' : 'Crear receta'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export function RecetaFormSheetTrigger() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Icons.add className='mr-2 h-4 w-4' />
        Nueva receta
      </Button>
      <RecetaFormSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
