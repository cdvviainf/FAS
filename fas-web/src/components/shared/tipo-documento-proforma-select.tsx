'use client'

import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TIPO_DTE_PROFORMA_LABELS, type TipoDteProforma } from '@/lib/tipo-documento-proforma'

export function TipoDocumentoProformaSelect({
  value,
  onChange,
  disabled,
}: {
  value: TipoDteProforma
  onChange: (v: TipoDteProforma) => void
  disabled?: boolean
}) {
  return (
    <div className='space-y-1.5'>
      <Label>Tipo de documento <span className='text-destructive'>*</span></Label>
      <Select value={String(value)} onValueChange={(v) => onChange(Number(v) as TipoDteProforma)} disabled={disabled}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {([33, 34] as const).map((t) => (
            <SelectItem key={t} value={String(t)}>{TIPO_DTE_PROFORMA_LABELS[t]}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className='text-xs text-muted-foreground'>Define si la factura es afecta (IVA 19%) o exenta. La factura generada desde esta proforma hereda el tipo.</p>
    </div>
  )
}
