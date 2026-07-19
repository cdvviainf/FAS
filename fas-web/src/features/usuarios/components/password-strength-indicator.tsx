'use client'

import { useMemo } from 'react'
import { Icons } from '@/components/icons'
import { cn } from '@/lib/utils'

interface PasswordRule {
  label: string
  passes: (pw: string) => boolean
}

const PASSWORD_RULES: PasswordRule[] = [
  { label: 'Al menos 8 caracteres', passes: (pw) => pw.length >= 8 },
  { label: 'Una letra mayúscula', passes: (pw) => /[A-Z]/.test(pw) },
  { label: 'Una letra minúscula', passes: (pw) => /[a-z]/.test(pw) },
  { label: 'Un número', passes: (pw) => /[0-9]/.test(pw) },
  { label: 'Un símbolo (ej: !@#$%)', passes: (pw) => /[^A-Za-z0-9]/.test(pw) },
]

interface PasswordStrengthIndicatorProps {
  password: string
}

export function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  const checks = useMemo(() =>
    PASSWORD_RULES.map((rule) => ({
      label: rule.label,
      passes: rule.passes(password),
    })),
    [password]
  )

  if (!password) return null

  return (
    <ul className='mt-2 space-y-1'>
      {checks.map((check) => (
        <li key={check.label} className={cn('flex items-center gap-1.5 text-xs', check.passes ? 'text-green-600' : 'text-muted-foreground')}>
          {check.passes ? (
            <Icons.check className='h-3.5 w-3.5 shrink-0 text-green-600' />
          ) : (
            <Icons.close className='h-3.5 w-3.5 shrink-0 text-muted-foreground' />
          )}
          {check.label}
        </li>
      ))}
    </ul>
  )
}
