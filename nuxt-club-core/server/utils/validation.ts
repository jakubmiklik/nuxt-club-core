import type { H3Event } from 'h3'
import { z, type ZodSchema } from 'zod'

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
      .string()
      .optional()
      .default('user')
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: 'Zadaná hesla se neshodují',
    path: ['passwordConfirm']
  })

export type RegisterInput = z.infer<typeof registerSchema>

/**
 * Bezpečně zvaliduje tělo požadavku (H3Event) pomocí Zod schématu.
 * Při nevalidních datech vyhodí formátovanou chybu 400 s detaily z result.error.flatten().
 */
export async function readValidatedBodyStrict<T>(
  event: H3Event,
  schema: ZodSchema<T>
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
    const flattened = result.error.flatten()
    const fieldErrorsMap = flattened.fieldErrors as Record<string, string[] | undefined>
    const firstField = Object.keys(fieldErrorsMap)[0]
    const firstFieldMessage = firstField ? fieldErrorsMap[firstField]?.[0] : undefined
    const firstErrorMessage =
      firstFieldMessage ||
      flattened.formErrors[0] ||
      'Neplatná vstupní data'

    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: firstErrorMessage,
      data: flattened
    })
  }

  return result.data
}
