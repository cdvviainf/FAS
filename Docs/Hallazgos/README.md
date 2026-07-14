# Hallazgos QAS — FAS

> Registro vivo de revisión QAS del proyecto FAS.

## Regla de trabajo

- Codex actúa como QAS/revisor.
- Codex no modifica código fuente del proyecto.
- Los hallazgos se documentan en esta carpeta.
- Claude puede editar estos archivos para actualizar estado, comentarios, evidencia de corrección y referencias a commits/PRs.
- Cada módulo revisado debe tener un archivo propio.

## Estados sugeridos

| Estado | Uso |
|---|---|
| `Pendiente` | Hallazgo levantado, aún sin corrección. |
| `En corrección` | Claude tomó el hallazgo y está trabajando en él. |
| `Corregido` | Claude indica que el cambio fue aplicado. |
| `Validado` | Codex volvió a revisar y confirma que el hallazgo quedó resuelto. |
| `Descartado` | Se decide no corregir; debe quedar justificación. |

## Severidades sugeridas

| Severidad | Criterio |
|---|---|
| `Bloqueante` | Impide usar el módulo, rompe una regla crítica o afecta seguridad/datos. |
| `Alta` | Incumple un criterio de aceptación importante o genera riesgo operacional relevante. |
| `Media` | Desviación funcional corregible sin bloquear el flujo principal. |
| `Baja` | Mejora menor, detalle visual, consistencia o deuda controlada. |

## Archivos por módulo

| Módulo | Archivo |
|---|---|
| Mantenedores Generales | `mantenedores-generales.md` |

