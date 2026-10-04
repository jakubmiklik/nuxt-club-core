import type { H3Event } from 'h3'
import { z, type ZodSchema } from 'zod'
import { createClubError } from './errors'

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
 * Seznam chráněných rolí, které nesmí být nikdy přiřazeny prostřednictvím veřejné registrace (ochrana proti Privilege Escalation)
 */
export const FORBIDDEN_REGISTRATION_ROLES = ['admin', 'superadmin', 'administrator', 'root'] as const

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
      .trim()
      .refine(
        (val) => {
          if (!val) return true
          const normalized = val.toLowerCase()
          return !FORBIDDEN_REGISTRATION_ROLES.includes(normalized as (typeof FORBIDDEN_REGISTRATION_ROLES)[number])
        },
        {
          message: 'Role "admin" nebo administrátorská oprávnění nemohou být zvolena při veřejné registraci'
        }
      )
      .optional()
      .default('user'),
    gdprConsent: z
      .boolean({
        required_error: 'Musíte souhlasit se zpracováním osobních údajů',
        invalid_type_error: 'Musíte souhlasit se zpracováním osobních údajů'
      })
      .refine((val) => val === true, 'Musíte souhlasit se zpracováním osobních údajů')
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: 'Zadaná hesla se neshodují',
    path: ['passwordConfirm']
  })

export type RegisterInput = z.infer<typeof registerSchema>

/**
 * Validační schéma pro změnu hesla přihlášeného uživatele
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string({ required_error: 'Současné heslo je povinné' })
      .min(1, 'Současné heslo je povinné'),
    newPassword: z
      .string({ required_error: 'Nové heslo je povinné' })
      .min(8, 'Heslo musí mít minimálně 8 znaků')
      .regex(/[A-Z]/, 'Heslo musí obsahovat alespoň jedno velké písmeno')
      .regex(/[0-9]/, 'Heslo musí obsahovat alespoň jedno číslo'),
    newPasswordConfirm: z
      .string({ required_error: 'Potvrzení hesla je povinné' })
      .min(8, 'Potvrzení hesla musí mít alespoň 8 znaků')
  })
  .refine((data) => data.newPassword === data.newPasswordConfirm, {
    message: 'Zadaná hesla se neshodují',
    path: ['newPasswordConfirm']
  })

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>

/**
 * Validační schéma pro aktualizaci profilu uživatele
 */
export const updateProfileSchema = z.object({
  name: z
    .string({ required_error: 'Jméno je povinné' })
    .trim()
    .min(2, 'Jméno musí mít alespoň 2 znaky')
    .max(100, 'Jméno je příliš dlouhé'),
  avatar: z
    .string()
    .url('Avatar musí být platná URL adresa')
    .optional()
    .or(z.literal(''))
})

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>

/**
 * Validační schéma pro žádost o obnovu hesla (zapomenuté heslo)
 */
export const forgotPasswordSchema = z.object({
  email: z
    .string({ required_error: 'E-mail je povinný' })
    .trim()
    .toLowerCase()
    .email('Zadejte platnou e-mailovou adresu')
})

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>

/**
 * Validační schéma pro nastavení nového hesla pomocí tokenu
 */
export const resetPasswordSchema = z
  .object({
    token: z
      .string({ required_error: 'Token pro obnovu hesla je povinný' })
      .trim()
      .min(1, 'Token nesmí být prázdný'),
    password: z
      .string({ required_error: 'Heslo je povinné' })
      .min(8, 'Heslo musí mít minimálně 8 znaků')
      .regex(/[A-Z]/, 'Heslo musí obsahovat alespoň jedno velké písmeno')
      .regex(/[0-9]/, 'Heslo musí obsahovat alespoň jedno číslo'),
    passwordConfirm: z
      .string({ required_error: 'Potvrzení hesla je povinné' })
      .min(8, 'Potvrzení hesla musí mít alespoň 8 znaků')
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: 'Zadaná hesla se neshodují',
    path: ['passwordConfirm']
  })

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>

/**
 * Validační schéma pro přepnutí aktivního členského profilu
 */
export const switchMemberSchema = z.object({
  memberId: z.union([
    z.string().trim().min(1, 'ID člena nesmí být prázdné'),
    z.number()
  ])
})

export type SwitchMemberInput = z.infer<typeof switchMemberSchema>

/**
 * Validační schéma pro přepnutí kontextu sezóny a pobočky
 */
export const switchContextSchema = z.object({
  seasonId: z.union([
    z.string().trim().min(1),
    z.number()
  ]).optional(),
  branchId: z.union([
    z.string().trim().min(1),
    z.number()
  ]).optional()
}).refine((data) => data.seasonId !== undefined || data.branchId !== undefined, {
  message: 'Musí být zadáno alespoň seasonId nebo branchId'
})

export type SwitchContextInput = z.infer<typeof switchContextSchema>

/**
 * Validační schéma pro změnu role uživatele administrátorem
 */
export const adminUpdateRoleSchema = z.object({
  role: z.string().trim().min(1, 'Role nesmí být prázdná')
})

export type AdminUpdateRoleInput = z.infer<typeof adminUpdateRoleSchema>

/**
 * Validační schéma pro změnu stavu uživatele administrátorem
 */
export const adminUpdateStatusSchema = z.object({
  status: z.enum(['active', 'suspended'], {
    required_error: 'Stav je povinný',
    invalid_type_error: 'Stav musí být "active" nebo "suspended"'
  })
})

export type AdminUpdateStatusInput = z.infer<typeof adminUpdateStatusSchema>

/**
 * Validační schéma pro ověření e-mailu pomocí tokenu
 */
export const verifyEmailSchema = z.object({
  token: z
    .string({ required_error: 'Ověřovací token je povinný' })
    .trim()
    .min(1, 'Ověřovací token nesmí být prázdný')
})

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>

/**
 * Validační schéma pro vytvoření pozvánky člena klubu (admin / coach)
 */
export const createInvitationSchema = z.object({
  email: z
    .string({ required_error: 'E-mail je povinný' })
    .trim()
    .toLowerCase()
    .email('Zadejte platnou e-mailovou adresu'),
  role: z
    .string({ required_error: 'Role je povinná' })
    .trim()
    .min(1, 'Role nesmí být prázdná'),
  category: z
    .string()
    .trim()
    .optional()
})

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>

/**
 * Validační schéma pro přijetí pozvánky člena klubu
 */
export const acceptInvitationSchema = z
  .object({
    token: z
      .string({ required_error: 'Token je povinný' })
      .trim()
      .min(1, 'Token nesmí být prázdný'),
    name: z
      .string({ required_error: 'Jméno a příjmení je povinné' })
      .trim()
      .min(2, 'Jméno musí mít alespoň 2 znaky')
      .max(100, 'Jméno je příliš dlouhé'),
    password: z
      .string({ required_error: 'Heslo je povinné' })
      .min(8, 'Heslo musí mít minimálně 8 znaků')
      .regex(/[A-Z]/, 'Heslo musí obsahovat alespoň jedno velké písmeno')
      .regex(/[0-9]/, 'Heslo musí obsahovat alespoň jedno číslo'),
    passwordConfirm: z
      .string({ required_error: 'Potvrzení hesla je povinné' })
      .min(8, 'Potvrzení hesla musí mít alespoň 8 znaků'),
    gdprConsent: z
      .boolean({
        required_error: 'Musíte souhlasit se zpracováním osobních údajů',
        invalid_type_error: 'Musíte souhlasit se zpracováním osobních údajů'
      })
      .refine((val) => val === true, 'Musíte souhlasit se zpracováním osobních údajů')
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: 'Zadaná hesla se neshodují',
    path: ['passwordConfirm']
  })

export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>

/**
 * Bezpečně zvaliduje tělo požadavku (H3Event) pomocí Zod schématu.
 * Při nevalidních datech vyhodí formátovanou chybu VALIDATION_ERROR s detaily fieldErrors.
 */
export async function readValidatedBodyStrict<T>(
  event: H3Event,
  schema: ZodSchema<T>
): Promise<T> {
  let body: unknown
  try {
    body = await readBody(event)
  } catch {
    throw createClubError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Tělo požadavku není validní JSON'
    })
  }

  const result = schema.safeParse(body ?? {})
  if (!result.success) {
    const flattened = result.error.flatten()
    const rawFieldErrors = flattened.fieldErrors as Record<string, string[] | undefined>
    const fieldErrors: Record<string, string[]> = {}

    for (const [key, val] of Object.entries(rawFieldErrors)) {
      if (val && val.length > 0) {
        fieldErrors[key] = val
      }
    }

    const firstField = Object.keys(fieldErrors)[0]
    const firstFieldMessage = firstField ? fieldErrors[firstField]?.[0] : undefined
    const firstErrorMessage =
      firstFieldMessage ||
      flattened.formErrors[0] ||
      'Neplatná vstupní data'

    throw createClubError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: firstErrorMessage,
      fieldErrors
    })
  }

  return result.data
}
