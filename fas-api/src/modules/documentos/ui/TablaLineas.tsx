export interface ColumnaTabla<Fila> {
  titulo: string
  render: (fila: Fila) => React.ReactNode
  numerica?: boolean // alinea a la derecha con tabular-nums (fmt.* ya trae el signo/símbolo)
}

interface TablaLineasProps<Fila> {
  titulo: string
  filas: Fila[]
  columnas: ColumnaTabla<Fila>[]
  totales?: React.ReactNode[] // una celda por columna, en el mismo orden — undefined/'' si no aplica en esa columna
}

// Tabla de líneas genérica — Etapa 4 §5 (TablaLotes) y §6 (thead/tfoot
// repetidos por página cuando el documento pagina). Un documento define sus
// columnas por configuración, no reimplementando la tabla.
export function TablaLineas<Fila>({ titulo, filas, columnas, totales }: TablaLineasProps<Fila>) {
  return (
    <div className='doc-grupo'>
      <div className='doc-grupo-titulo'>{titulo}</div>
      <table className='doc-tabla'>
        <thead>
          <tr>
            {columnas.map((c, i) => (
              <th key={i} className={c.numerica ? 'doc-num' : undefined}>{c.titulo}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, i) => (
            <tr key={i}>
              {columnas.map((c, j) => (
                <td key={j} className={c.numerica ? 'doc-num' : undefined}>{c.render(fila)}</td>
              ))}
            </tr>
          ))}
        </tbody>
        {totales && (
          <tfoot>
            <tr>
              {columnas.map((c, i) => (
                <td key={i} className={c.numerica ? 'doc-num' : undefined}>{totales[i] ?? ''}</td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
