// Lineas de un campo de futbol en un sistema de coordenadas 0-100 x 0-100,
// pensado para dibujarse dentro de un contenedor mas alto que ancho (la
// porteria propia queda abajo). Se reutiliza tal cual en el campo grande
// (Pitch) y en las miniaturas de FormationThumbnail.
const LINE_STYLE = { stroke: 'rgba(255,255,255,0.3)', strokeWidth: 0.6 } as const

export function PitchLines() {
  return (
    <>
      <rect x={0} y={0} width={100} height={100} fill="#1a4a2e" />
      <rect x={2} y={2} width={96} height={96} rx={2} fill="none" {...LINE_STYLE} />
      <line x1={2} y1={50} x2={98} y2={50} {...LINE_STYLE} />
      <circle cx={50} cy={50} r={9} fill="none" {...LINE_STYLE} />
      <circle cx={50} cy={50} r={0.6} fill="rgba(255,255,255,0.3)" />
      <rect x={26} y={80} width={48} height={16} fill="none" {...LINE_STYLE} />
      <rect x={39} y={90} width={22} height={6} fill="none" {...LINE_STYLE} />
    </>
  )
}
