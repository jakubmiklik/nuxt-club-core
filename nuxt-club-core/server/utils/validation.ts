import type { H3Event } from 'h3'
import { z } from 'zod'

/**
 * Validační schéma pro přihlášení e-mailem a heslem
 */
export const loginSchema = z.object({
  email: z
    .string({ required_error: 'E-mail je povinný' })
    .trim()
    .toLowerCase()
    .email('Zadejte platnou e-mailovou adresu'),
  password: z
    .string({ required_error: 'Heslo je povinné' })
    .min(8, 'Heslo musí mít minimálně 8 znaků')
})

export type LoginInput = z.infer<typeof loginSchema>

/**
 * Validační schéma pro registraci nového člena oddílu / uživatele
 */
export const registerSchema = z
  .object({
    name: z
      .string({ required_error: 'Jméno a příjmení je povinné' })
      .trim()
      .min(2, 'Jméno musí mít alespoň 2 znaky')
      .max(100, 'Jméno je příliš dlouhé'),
    email: z
      .string({ required_error: 'E-mail je povinný' })
      .trim()
      .toLowerCase()
      .email('Zadejte platnou e-mailovou adresu'),
    password: z
      .string({ required_error: 'Heslo je povinné' })
      .min(8, 'Heslo musí mít minimálně 8 znaků')
      .regex(/[A-Z]/, 'Heslo musí obsahovat alespoň jedno velké písmeno')
      .regex(/[0-9]/, 'Heslo musí obsahovat alespoň jedno číslo'),
    passwordConfirm: z
      .string({ required_error: 'Potvrzení hesla je povinné' })
      .min(8, 'Potvrzení hesla musí mít alespoň 8 znaků'),
    role: z
      .enum(['admin', 'coach', 'member', 'parent'] as const)
      .optional()
      .default('member')
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: 'Zadaná hesla se neshodují',
    path: ['passwordConfirm']
  })

export type RegisterInput = z.infer<typeof registerSchema>

/**
 * Helper pro striktní načtení a validaci těla požadavku (H3Event) pomocí Zod schématu.
 * Při nevalidním vstupu vyhazuje strukturovanou HTTP 400 chybu s přehledným seznamem chyb.
 */
export async function readValidatedBodyStrict<T>(
  event: H3Event,
  schema: z.ZodType<T>
): Promise<T> {
  let body: unknown
  try {
    body = await readBody(event)
  } catch {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Tělo požadavku není validní JSON'
    })
  }

  const result = schema.safeParse(body ?? {})
  if (!result.success) {
    const formattedErrors = result.error.errors.map((err) => ({
      field: err.path.join('.'),
      message: err.message
    }))

    const firstErrorMessage = formattedErrors[0]?.message || 'Neplatná vstupní data'

    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: firstErrorMessage,
      data: {
        errors: formattedErrors
      }
    })
  }

  return result.data
}
