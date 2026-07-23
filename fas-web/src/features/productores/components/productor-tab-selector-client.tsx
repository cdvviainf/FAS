'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { productoresListOptions } from '../queries'

export function ProductorTabSelectorClient({ tab }: { tab: 'contrato' | 'cuenta-corriente' }) {
  const router = useRouter()
  const { data } = useQuery(productoresListOptions({ limit: 500 }))

  return (
    <div className='max-w-sm space-y-1.5'>
      <Label>Selecciona un productor</Label>
      <Select onValueChange={(v) => router.push(`/dashboard/configuracion/productores/${v}?tab=${tab}`)}>
        <SelectTrigger><SelectValue placeholder='Seleccionar productor...' /></SelectTrigger>
        <SelectContent>
          {(data?.data ?? []).map((p) => (
            <SelectItem key={p.id} value={String(p.id)}>{p.codigo} — {p.descripcion}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
