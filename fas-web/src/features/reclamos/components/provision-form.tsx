'use client'

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TIPO_CALCULO_PROVISION_LABELS } from '../types'
import type { ProvisionInput, TipoCalculoProvision } from '../types'

interface ProvisionFormProps {
  value: ProvisionInput
  onChange: (value: ProvisionInput) => void
  cajasDisponibles: number
}

// Provisión = estimación inicial (reclamos.md RC-D10) — caja/kilo/monto
// cerrado, en la moneda heredada del Embarque (se muestra afuera, no acá).
export function ProvisionForm({ value, onChange, cajasDisponibles }: ProvisionFormProps) {
  function setTipo(tipoCalculo: TipoCalculoProvision) {
    onChange({ tipoCalculo })
  }

  return (
    <div className='grid grid-cols-2 gap-3'>
      <div className='space-y-1.5'>
        <Label>Tipo de cálculo</Label>
        <Select value={value.tipoCalculo} onValueChange={(v) => setTipo(v as TipoCalculoProvision)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(TIPO_CALCULO_PROVISION_LABELS) as TipoCalculoProvision[]).map((t) => (
              <SelectItem key={t} value={t}>{TIPO_CALCULO_PROVISION_LABELS[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {value.tipoCalculo === 'MONTO_FIJO' ? (
        <div className='space-y-1.5'>
          <Label>Monto</Label>
          <Input
            type='number'
            min={0}
            step='0.01'
            value={value.montoFijo ?? ''}
            onChange={(e) => onChange({ ...value, montoFijo: Number(e.target.value) })}
          />
        </div>
      ) : (
        <div className='space-y-1.5'>
          <Label>Valor unitario ({value.tipoCalculo === 'POR_UNIDAD_CAJA' ? 'por caja' : 'por kilo'})</Label>
          <Input
            type='number'
            min={0}
            step='0.01'
            value={value.valorUnitario ?? ''}
            onChange={(e) => onChange({ ...value, valorUnitario: Number(e.target.value) })}
          />
        </div>
      )}

      {value.tipoCalculo !== 'MONTO_FIJO' && (
        <div className='col-span-2 space-y-1.5'>
          <Label>
            Cantidad afectada {value.tipoCalculo === 'POR_UNIDAD_CAJA' ? '(cajas)' : '(kilos)'}{' '}
            <span className='text-muted-foreground text-xs'>— sugerida desde las líneas marcadas, editable</span>
          </Label>
          <Input
            type='number'
            min={0}
            value={value.cantidadAfectada ?? ''}
            placeholder={value.tipoCalculo === 'POR_UNIDAD_CAJA' ? String(cajasDisponibles) : ''}
            onChange={(e) => onChange({ ...value, cantidadAfectada: e.target.value ? Number(e.target.value) : null })}
          />
        </div>
      )}
    </div>
  )
}
