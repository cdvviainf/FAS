interface PieFirmaProps {
  nota?: string
  firmantes: string[]
}

export function PieFirma({ nota, firmantes }: PieFirmaProps) {
  return (
    <>
      {nota && <p className='doc-nota-legal'>{nota}</p>}
      <div className='doc-pie-firma'>
        {firmantes.map((f, i) => (
          <div className='doc-firma' key={i}>
            <div className='doc-firma-linea' />
            <div>{f}</div>
          </div>
        ))}
      </div>
    </>
  )
}
