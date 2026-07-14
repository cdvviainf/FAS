'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { AlertModal } from '@/components/modal/alert-modal';
import { Icons } from '@/components/icons';
import { deleteRecetaMutation } from '../../api/mutations';
import { recetaKeys } from '../../api/queries';
import type { Receta } from '../../api/types';
import { RecetaFormSheet } from '../receta-form-sheet';

interface CellActionProps {
  receta: Receta;
}

export function CellAction({ receta }: CellActionProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const queryClient = useQueryClient();

  const { mutate: remove, isPending } = useMutation({
    ...deleteRecetaMutation,
    onSuccess: () => {
      toast.success('Receta desactivada');
      setDeleteOpen(false);
      queryClient.invalidateQueries({ queryKey: recetaKeys.all });
    },
    onError: () => toast.error('Error al desactivar la receta')
  });

  return (
    <>
      <RecetaFormSheet receta={receta} open={editOpen} onOpenChange={setEditOpen} />
      <AlertModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => remove(receta.id)}
        loading={isPending}
        title='¿Desactivar receta?'
        description={`La receta "${receta.codigo}" quedará inactiva. Podrás reactivarla editándola.`}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant='ghost' className='h-8 w-8 p-0'>
            <span className='sr-only'>Abrir menú</span>
            <Icons.ellipsis className='h-4 w-4' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end'>
          <DropdownMenuLabel>Acciones</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Icons.edit className='mr-2 h-4 w-4' />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setDeleteOpen(true)}
            disabled={!receta.activo}
            className='text-destructive focus:text-destructive'
          >
            <Icons.trash className='mr-2 h-4 w-4' />
            Desactivar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
