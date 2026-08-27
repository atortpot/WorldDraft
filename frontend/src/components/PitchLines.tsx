import { useId } from 'react'

// Lineas de un campo de futbol en un sistema de coordenadas 0-100 x 0-100,
// pensado para dibujarse dentro de un contenedor mas alto que ancho (la
// porteria propia queda abajo). Se reutiliza tal cual en el campo grande
// (Pitch) y en las miniaturas de FormationThumbnail.
const LINE_STYLE = { stroke: 'rgba(255,255,255,0.42)', strokeWidth: 0.7 } as const

// Franjas de siega alternas, muy sutiles, para dar textura de hierba real.
const STRIPE_COUNT = 10
const STRIPE_HEIGHT = 100 / STRIPE_COUNT

export function PitchLines() {
  const gradientId = useId()

  return (
    <>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e6b45" />
          <stop offset="55%" stopColor="#175538" />
          <stop offset="100%" stopColor="#0f3b28" />
        </linearGradient>
      </defs>

      <rect x={0} y={0} width={100} height={100} fill={`url(#${gradientId})`} />
      {Array.from({ length: STRIPE_COUNT }, (_, i) => (
        <rect
          key={i}
          x={0}
          y={i * STRIPE_HEIGHT}
          width={100}
          height={STRIPE_HEIGHT}
          fill={i % 2 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.035)'}
        />
      ))}

      <rect x={2} y={2} width={96} height={96} rx={2} fill="none" {...LINE_STYLE} />
      <line x1={2} y1={50} x2={98} y2={50} {...LINE_STYLE} />
      <circle cx={50} cy={50} r={9} fill="none" {...LINE_STYLE} />
      <circle cx={50} cy={50} r={0.7} fill="rgba(255,255,255,0.42)" />
      <rect x={26} y={80} width={48} height={16} fill="none" {...LINE_STYLE} />
      <rect x={39} y={90} width={22} height={6} fill="none" {...LINE_STYLE} />
      <path d="M2 6 A4 4 0 0 0 6 2" fill="none" {...LINE_STYLE} />
      <path d="M94 2 A4 4 0 0 0 98 6" fill="none" {...LINE_STYLE} />
    </>
  )
}
