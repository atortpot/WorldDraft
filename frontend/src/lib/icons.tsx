import type { SVGProps } from 'react'

// Set de iconos propio, trazo uniforme (outline, stroke=currentColor), en
// vez de emoji: mismo criterio en toda la app (marcador, eventos del
// partido, trofeo, tarjetas...).

export function DiceIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <rect x={3.5} y={3.5} width={17} height={17} rx={4} />
      <circle cx={8.2} cy={8.2} r={1.3} fill="currentColor" stroke="none" />
      <circle cx={15.8} cy={8.2} r={1.3} fill="currentColor" stroke="none" />
      <circle cx={12} cy={12} r={1.3} fill="currentColor" stroke="none" />
      <circle cx={8.2} cy={15.8} r={1.3} fill="currentColor" stroke="none" />
      <circle cx={15.8} cy={15.8} r={1.3} fill="currentColor" stroke="none" />
    </svg>
  )
}

export function BallIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} {...props}>
      <circle cx={12} cy={12} r={9} />
      <path d="M12 6.5 16.5 9.7 14.8 15.1H9.2L7.5 9.7Z" fill="currentColor" stroke="none" />
      <path d="M12 6.5V3.3M16.5 9.7l3-2M14.8 15.1l1.9 2.7M9.2 15.1 7.3 17.8M7.5 9.7l-3-2" />
    </svg>
  )
}

export function PenaltyMissIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}

export function YellowCardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <rect x={5} y={2.5} width={14} height={19} rx={2.2} fill="#eab308" stroke="#a16207" strokeWidth={1} />
    </svg>
  )
}

export function RedCardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <rect x={5} y={2.5} width={14} height={19} rx={2.2} fill="#ef4444" stroke="#991b1b" strokeWidth={1} />
    </svg>
  )
}

export function TrophyIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M7 4h10v5a5 5 0 0 1-10 0Z" />
      <path d="M7 5.5H4a1 1 0 0 0-1 1v1a4 4 0 0 0 4 4M17 5.5h3a1 1 0 0 1 1 1v1a4 4 0 0 1-4 4" />
      <path d="M12 14v3M9 20.5h6M9.5 17.5h5l.5 3h-6Z" />
    </svg>
  )
}

export function ShieldCrackIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 3 20 6.5v5c0 5-3.4 8.4-8 9.5-4.6-1.1-8-4.5-8-9.5v-5Z" />
      <path d="m13 8-2.5 4h3L11 16" />
    </svg>
  )
}

export function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M5 12.5 10 17 19 7" />
    </svg>
  )
}

export function CrossIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}

export function ShirtIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" {...props}>
      <path d="M8 3 3 6.5 5.5 10 8 8.5V21h8V8.5l2.5 1.5L21 6.5 16 3l-2 2h-4Z" />
    </svg>
  )
}

export function SparkleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2 13.8 9.4 21 12 13.8 14.6 12 22 10.2 14.6 3 12 10.2 9.4Z" />
    </svg>
  )
}

// Figuras geometricas simples, usadas como indicador visual por posicion
// (portero/defensa/mediocampo/delantera) en vez de un icono figurativo.
export function DiamondIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2 22 12 12 22 2 12Z" />
    </svg>
  )
}

export function ShieldIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2 20 5.5v5c0 5-3.4 8.4-8 9.5-4.6-1.1-8-4.5-8-9.5v-5Z" />
    </svg>
  )
}

export function HexagonIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M8 2.5h8L21.5 12 16 21.5H8L2.5 12Z" />
    </svg>
  )
}

export function TriangleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2.5 22 21H2Z" />
    </svg>
  )
}
