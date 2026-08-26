import { z } from 'zod'

// Debe coincidir exactamente con validate_password() en
// app/auth/security.py (mismas 4 reglas, mismo orden), para que el
// registro se comporte igual en cliente y servidor.
export const passwordSchema = z
  .string()
  .min(8, 'Debe tener al menos 8 caracteres')
  .regex(/[A-Z]/, 'Debe incluir al menos una mayuscula')
  .regex(/[a-z]/, 'Debe incluir al menos una minuscula')
  .regex(/[^A-Za-z0-9]/, 'Debe incluir al menos un caracter especial')

export const registerSchema = z.object({
  email: z.string().email('Introduce un email valido'),
  password: passwordSchema,
})

export function collectRegisterErrors(email: string, password: string): string[] {
  const result = registerSchema.safeParse({ email, password })
  if (result.success) return []
  return result.error.issues.map((issue) => issue.message)
}
