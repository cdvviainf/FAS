'use client';

import { useState } from 'react';
import { useAppForm, useFormFields } from '@/components/ui/tanstack-form';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
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
import { Icons } from '@/components/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createMercadoMutation, updateMercadoMutation } from '../api/mutations';
import { mercadoKeys } from '../api/queries';
import type { Mercado } from '../api/types';
import { toast } from 'sonner';
import { mercadoSchema } from '../schemas/mercado';
import { gruposMercadoQueryOptions } from '@/features/grupos-mercado/api/queries';
import type { GrupoMercado } from '@/features/grupos-mercado/api/types';
import { GrupoMercadoQuickCreate } from './grupo-mercado-quick-create';
import { paisesQueryOptions } from '@/features/paises/api/queries';
import type { Pais } from '@/features/paises/api/types';
import { PaisQuickCreate } from '@/features/paises/components/pais-quick-create';

// Form values con IDs como números (coercionados por zod en submit)
type FormValues = {
  codigo: string;
  descripcion: string;
  descripcionExtranjera: string;
  grupoMercadoId: number;
  paisId: number;
};

interface MercadoFormSheetProps {
  mercado?: Mercado;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MercadoFormSheet({ mercado, open, onOpenChange }: MercadoFormSheetProps) {
  const isEdit = !!mercado;
  const queryClient = useQueryClient();

  const { data: gruposData } = useQuery(gruposMercadoQueryOptions({ limit: 300 }));
  const grupos = gruposData?.grupos ?? [];

  const { data: paisesData } = useQuery(paisesQueryOptions({ limit: 300 }));
  const paises = paisesData?.paises ?? [];

  const createMutation = useMutation({
    ...createMercadoMutation,
    onSuccess: () => {
      toast.success('Mercado creado correctamente');
      onOpenChange(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: mercadoKeys.all });
    },
    onError: (e: Error) => toast.error(e.message || 'Error al crear el mercado')
  });

  const updateMutation = useMutation({
    ...updateMercadoMutation,
    onSuccess: () => {
      toast.success('Mercado actualizado correctamente');
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: mercadoKeys.all });
    },
    onError: (e: Error) => toast.error(e.message || 'Error al actualizar el mercado')
  });

  const form = useAppForm({
    defaultValues: {
      codigo: mercado?.codigo ?? '',
      descripcion: mercado?.descripcion ?? '',
      descripcionExtranjera: mercado?.descripcionExtranjera ?? '',
      grupoMercadoId: mercado?.grupoMercadoId ?? 0,
      paisId: mercado?.paisId ?? 0
    } as FormValues,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validators: { onSubmit: mercadoSchema as any },
    onSubmit: async ({ value }) => {
      if (isEdit) {
        await updateMutation.mutateAsync({ id: mercado.id, values: value });
      } else {
        await createMutation.mutateAsync(value);
      }
    }
  });

  const { FormTextField } = useFormFields<FormValues>();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleGrupoCreado = (grupo: GrupoMercado) => {
    form.setFieldValue('grupoMercadoId', grupo.id);
  };

  const handlePaisCreado = (pais: Pais) => {
    form.setFieldValue('paisId', pais.id);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex flex-col sm:max-w-lg'>
        <SheetHeader>
          <SheetTitle>{isEdit ? 'Editar Mercado' : 'Nuevo Mercado'}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? 'Modifica los datos del mercado de destino.'
              : 'Registra un nuevo mercado de exportación.'}
          </SheetDescription>
        </SheetHeader>

        <div className='flex-1 overflow-auto py-2'>
          <form.AppForm>
            <form.Form id='mercado-form' className='space-y-4 px-1'>

              <FormTextField
                name='codigo'
                label='Código'
                required
                placeholder='Ej: USA-WEST'
                disabled={isEdit}
              />
              <FormTextField
                name='descripcion'
                label='Descripción'
                required
                placeholder='Ej: Estados Unidos — Costa Oeste'
              />

              <FormTextField
                name='descripcionExtranjera'
                label='Descripción extranjera'
                placeholder='Ej: United States — West Coast'
              />

              {/* Grupo de Mercado con botón de creación inline */}
              <form.Field name='grupoMercadoId'>
                {(field) => (
                  <div className='space-y-1.5'>
                    <Label className='text-sm font-medium'>
                      Grupo de Mercado <span className='text-destructive'>*</span>
                    </Label>
                    <div className='flex gap-2'>
                      <Select
                        value={field.state.value ? String(field.state.value) : ''}
                        onValueChange={(v) => field.handleChange(Number(v))}
                      >
                        <SelectTrigger className='flex-1'>
                          <SelectValue placeholder='Seleccionar grupo...' />
                        </SelectTrigger>
                        <SelectContent>
                          {grupos.map((g) => (
                            <SelectItem key={g.id} value={String(g.id)}>
                              {g.descripcion}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <GrupoMercadoQuickCreate onCreated={handleGrupoCreado} />
                    </div>
                    <p className='text-xs text-muted-foreground'>
                      Usa <Icons.add className='inline h-3 w-3' /> para crear un grupo sin cerrar este formulario.
                    </p>
                    {field.state.meta.errors.length > 0 && (
                      <p className='text-sm text-destructive'>
                        {String(field.state.meta.errors[0])}
                      </p>
                    )}
                  </div>
                )}
              </form.Field>

              {/* País */}
              <form.Field name='paisId'>
                {(field) => (
                  <div className='space-y-1.5'>
                    <Label className='text-sm font-medium'>
                      País <span className='text-destructive'>*</span>
                    </Label>
                    <div className='flex gap-2'>
                      <Select
                        value={field.state.value ? String(field.state.value) : ''}
                        onValueChange={(v) => field.handleChange(Number(v))}
                      >
                        <SelectTrigger className='flex-1'>
                          <SelectValue placeholder='Seleccionar país...' />
                        </SelectTrigger>
                        <SelectContent>
                          {paises.map((p) => (
                            <SelectItem key={p.id} value={String(p.id)}>
                              <span className='font-mono text-xs text-muted-foreground mr-2'>{p.codigo}</span>
                              {p.descripcion}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <PaisQuickCreate onCreated={handlePaisCreado} />
                    </div>
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
        </div>

        <SheetFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type='submit' form='mercado-form' isLoading={isPending}>
            <Icons.check className='mr-1 h-4 w-4' />
            {isEdit ? 'Guardar cambios' : 'Crear mercado'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export function MercadoFormSheetTrigger() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Icons.add className='mr-2 h-4 w-4' />
        Nuevo mercado
      </Button>
      <MercadoFormSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
