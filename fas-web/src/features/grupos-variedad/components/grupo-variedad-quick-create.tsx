'use client'

import { useState } from 'react'
import { useAppForm, useFormFields } from '@/components/ui/tanstack-form'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Icons } from '@/components/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createMantenedorMutations } from '@/features/mantenedor-simple/mutations'
import { createMantenedorQueries } from '@/features/mantenedor-simple/queries'
import { mantenedorSimpleSchema, type MantenedorSimpleFormValues } from '@/features/mantenedor-simple/schema'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import type { MantenedorSimple } from '@/features/mantenedor-simple/types'

interface GrupoVariedadQuickCreateProps {
  especieId: number | undefined
  onCreated: (grupo: MantenedorSimple) => void
}

function GrupoVariedadQuickDialog({
  especieId,
  open,
  onOpenChange,
  onCreated
}: {
  especieId: number
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: (grupo: MantenedorSimple) => void
}) {
  const queryClient = useQueryClient()
  const mutations = createMantenedorMutations('grupos-variedad')
  const { keys } = createMantenedorQueries('grupos-variedad')

  const mutation = useMutation({
    ...mutations.create,
    onSuccess: (newGrupo) => {
      queryClient.invalidateQueries({ queryKey: keys.all })
      toast.success(`Grupo de Variedad "${newGrupo.descripcion}" creado`)
      onCreated(newGrupo)
      onOpenChange(false)
      form.reset()
    },
    onError: () => toast.error('Error al crear el grupo de variedad')
  })

  const form = useAppForm({
    defaultValues: {
      codigo: '',
      descripcion: '',
      descripcionExtranjera: '',
      bloqueado: false
    } as MantenedorSimpleFormValues,
    validators: { onSubmit: mantenedorSimpleSchema },
    onSubmit: async ({ value }) => { await mutation.mutateAsync({ ...value, especieId }) }
  })

  const { FormTextField } = useFormFields<MantenedorSimpleFormValues>()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-sm'>
        <DialogHeader>
          <DialogTitle>Nuevo Grupo de Variedad</DialogTitle>
          <DialogDescription>
            El grupo quedará disponible inmediatamente en el selector, para la especie ya seleccionada.
          </DialogDescription>
        </DialogHeader>

        <form.AppForm>
          <form.Form id='grupo-variedad-quick-form' className='space-y-3'>
            <FormTextField name='codigo' label='Código' required placeholder='Ej: UVA-MESA' />
            <FormTextField name='descripcion' label='Descripción' required placeholder='Ej: Uva de Mesa' />
            <FormTextField name='descripcionExtranjera' label='Descripción extranjera' placeholder='Ej: Table Grape' />
          </form.Form>
        </form.AppForm>

        <DialogFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type='submit' form='grupo-variedad-quick-form' isLoading={mutation.isPending}>
            <Icons.check className='mr-1 h-4 w-4' />
            Crear grupo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function GrupoVariedadQuickCreate({ especieId, onCreated }: GrupoVariedadQuickCreateProps) {
  const [open, setOpen] = useState(false)
  const puedeEscribir = usePuedeEscribir('CONFIG_MANTENEDORES')

  if (!puedeEscribir) return null

  return (
    <>
      <Button
        type='button'
        variant='outline'
        size='icon'
        className='h-9 w-9 shrink-0 self-end'
        onClick={() => setOpen(true)}
        disabled={!especieId}
        title={especieId ? 'Crear nuevo grupo de variedad' : 'Selecciona una especie primero'}
      >
        <Icons.add className='h-4 w-4' />
      </Button>
      {open && especieId && (
        <GrupoVariedadQuickDialog especieId={especieId} open onOpenChange={setOpen} onCreated={onCreated} />
      )}
    </>
  )
}
