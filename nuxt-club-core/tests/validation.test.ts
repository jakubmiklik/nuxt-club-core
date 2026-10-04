import { describe, it, expect } from 'vitest'
import {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  FORBIDDEN_REGISTRATION_ROLES
} from '../server/utils/validation'

describe('Zod Validation Schemas', () => {
  describe('registerSchema', () => {
    const validRegisterData = {
      name: 'Jan Novák',
      email: 'jan.novak@example.com',
      password: 'Password123',
      passwordConfirm: 'Password123',
      gdprConsent: true,
      role: 'user'
    }

    it('passes with valid registration input', () => {
      const result = registerSchema.safeParse(validRegisterData)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.email).toBe('jan.novak@example.com')
        expect(result.data.role).toBe('user')
      }
    })

    it('defaults role to "user" when not provided', () => {
      const { role, ...dataWithoutRole } = validRegisterData
      const result = registerSchema.safeParse(dataWithoutRole)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.role).toBe('user')
      }
    })

    it('rejects forbidden registration roles ("admin", "superadmin", etc.) to prevent privilege escalation', () => {
      for (const forbiddenRole of FORBIDDEN_REGISTRATION_ROLES) {
        const result = registerSchema.safeParse({
          ...validRegisterData,
          role: forbiddenRole
        })
        expect(result.success).toBe(false)
        if (!result.success) {
          const fieldErrors = result.error.flatten().fieldErrors
          expect(fieldErrors.role).toBeDefined()
          expect(fieldErrors.role?.[0]).toContain('nemohou být zvolena')
        }
      }
    })

    it('rejects forbidden roles case-insensitively (e.g. "ADMIN", "SuperAdmin")', () => {
      const resultUpper = registerSchema.safeParse({
        ...validRegisterData,
        role: 'ADMIN'
      })
      expect(resultUpper.success).toBe(false)

      const resultMixed = registerSchema.safeParse({
        ...validRegisterData,
        role: 'SuperAdmin'
      })
      expect(resultMixed.success).toBe(false)
    })

    it('rejects mismatched password and passwordConfirm', () => {
      const result = registerSchema.safeParse({
        ...validRegisterData,
        passwordConfirm: 'DifferentPassword123'
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        const fieldErrors = result.error.flatten().fieldErrors
        expect(fieldErrors.passwordConfirm?.[0]).toBe('Zadaná hesla se neshodují')
      }
    })

    it('rejects password without uppercase letter', () => {
      const result = registerSchema.safeParse({
        ...validRegisterData,
        password: 'password123',
        passwordConfirm: 'password123'
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        const fieldErrors = result.error.flatten().fieldErrors
        expect(fieldErrors.password?.[0]).toBe('Heslo musí obsahovat alespoň jedno velké písmeno')
      }
    })

    it('rejects password without digit', () => {
      const result = registerSchema.safeParse({
        ...validRegisterData,
        password: 'PasswordNoDigit',
        passwordConfirm: 'PasswordNoDigit'
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        const fieldErrors = result.error.flatten().fieldErrors
        expect(fieldErrors.password?.[0]).toBe('Heslo musí obsahovat alespoň jedno číslo')
      }
    })

    it('rejects password shorter than 8 characters', () => {
      const result = registerSchema.safeParse({
        ...validRegisterData,
        password: 'Pass1',
        passwordConfirm: 'Pass1'
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        const fieldErrors = result.error.flatten().fieldErrors
        expect(fieldErrors.password?.[0]).toBe('Heslo musí mít minimálně 8 znaků')
      }
    })

    it('rejects invalid email format', () => {
      const result = registerSchema.safeParse({
        ...validRegisterData,
        email: 'invalid-email-address'
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        const fieldErrors = result.error.flatten().fieldErrors
        expect(fieldErrors.email?.[0]).toBe('Zadejte platnou e-mailovou adresu')
      }
    })

    it('rejects missing or false gdprConsent', () => {
      const resultFalse = registerSchema.safeParse({
        ...validRegisterData,
        gdprConsent: false
      })
      expect(resultFalse.success).toBe(false)
      if (!resultFalse.success) {
        expect(resultFalse.error.flatten().fieldErrors.gdprConsent?.[0]).toBe('Musíte souhlasit se zpracováním osobních údajů')
      }

      const { gdprConsent, ...dataWithoutGdpr } = validRegisterData
      const resultMissing = registerSchema.safeParse(dataWithoutGdpr)
      expect(resultMissing.success).toBe(false)
    })
  })

  describe('loginSchema', () => {
    it('passes with valid email and password', () => {
      const result = loginSchema.safeParse({
        email: 'user@example.com',
        password: 'password123'
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.email).toBe('user@example.com')
      }
    })

    it('normalizes email to lowercase and trims whitespace', () => {
      const result = loginSchema.safeParse({
        email: '   User@Example.COM   ',
        password: 'password123'
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.email).toBe('user@example.com')
      }
    })

    it('rejects invalid email', () => {
      const result = loginSchema.safeParse({
        email: 'not-an-email',
        password: 'password123'
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.email?.[0]).toBe('Zadejte platnou e-mailovou adresu')
      }
    })

    it('rejects password shorter than 8 characters', () => {
      const result = loginSchema.safeParse({
        email: 'user@example.com',
        password: '123'
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.password?.[0]).toBe('Heslo musí mít minimálně 8 znaků')
      }
    })

    it('rejects missing required fields', () => {
      const result = loginSchema.safeParse({})
      expect(result.success).toBe(false)
      if (!result.success) {
        const fieldErrors = result.error.flatten().fieldErrors
        expect(fieldErrors.email).toBeDefined()
        expect(fieldErrors.password).toBeDefined()
      }
    })
  })

  describe('changePasswordSchema', () => {
    const validChangePasswordData = {
      currentPassword: 'CurrentPassword123',
      newPassword: 'NewSecurePassword999',
      newPasswordConfirm: 'NewSecurePassword999'
    }

    it('passes with valid passwords matching requirements', () => {
      const result = changePasswordSchema.safeParse(validChangePasswordData)
      expect(result.success).toBe(true)
    })

    it('rejects when newPassword and newPasswordConfirm do not match', () => {
      const result = changePasswordSchema.safeParse({
        ...validChangePasswordData,
        newPasswordConfirm: 'DifferentPassword888'
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        const fieldErrors = result.error.flatten().fieldErrors
        expect(fieldErrors.newPasswordConfirm?.[0]).toBe('Zadaná hesla se neshodují')
      }
    })

    it('rejects empty currentPassword', () => {
      const result = changePasswordSchema.safeParse({
        ...validChangePasswordData,
        currentPassword: ''
      })
      expect(result.success).toBe(false)
    })

    it('validates complexity rules on newPassword (min 8 chars, uppercase, digit)', () => {
      // Missing uppercase
      const resultNoUpper = changePasswordSchema.safeParse({
        ...validChangePasswordData,
        newPassword: 'nouppercasepassword123',
        newPasswordConfirm: 'nouppercasepassword123'
      })
      expect(resultNoUpper.success).toBe(false)

      // Missing digit
      const resultNoDigit = changePasswordSchema.safeParse({
        ...validChangePasswordData,
        newPassword: 'NoDigitPasswordHere',
        newPasswordConfirm: 'NoDigitPasswordHere'
      })
      expect(resultNoDigit.success).toBe(false)

      // Short
      const resultShort = changePasswordSchema.safeParse({
        ...validChangePasswordData,
        newPassword: 'Ab1',
        newPasswordConfirm: 'Ab1'
      })
      expect(resultShort.success).toBe(false)
    })
  })

  describe('createInvitationSchema', () => {
    it('passes with valid email and role', async () => {
      const { createInvitationSchema } = await import('../server/utils/validation')
      const result = createInvitationSchema.safeParse({
        email: 'newbie@club.cz',
        role: 'member',
        category: 'U14'
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.email).toBe('newbie@club.cz')
        expect(result.data.role).toBe('member')
        expect(result.data.category).toBe('U14')
      }
    })

    it('rejects invalid email', async () => {
      const { createInvitationSchema } = await import('../server/utils/validation')
      const result = createInvitationSchema.safeParse({
        email: 'invalid-email',
        role: 'coach'
      })
      expect(result.success).toBe(false)
    })
  })

  describe('acceptInvitationSchema', () => {
    it('passes with valid token, name, matching strong passwords and gdpr consent', async () => {
      const { acceptInvitationSchema } = await import('../server/utils/validation')
      const result = acceptInvitationSchema.safeParse({
        token: 'uuid-token-1234',
        name: 'Nový Trenér',
        password: 'Password123',
        passwordConfirm: 'Password123',
        gdprConsent: true
      })
      expect(result.success).toBe(true)
    })

    it('rejects without gdprConsent', async () => {
      const { acceptInvitationSchema } = await import('../server/utils/validation')
      const result = acceptInvitationSchema.safeParse({
        token: 'uuid-token-1234',
        name: 'Nový Trenér',
        password: 'Password123',
        passwordConfirm: 'Password123',
        gdprConsent: false
      })
      expect(result.success).toBe(false)
    })

    it('rejects mismatched passwords', async () => {
      const { acceptInvitationSchema } = await import('../server/utils/validation')
      const result = acceptInvitationSchema.safeParse({
        token: 'uuid-token-1234',
        name: 'Nový Trenér',
        password: 'Password123',
        passwordConfirm: 'Password456',
        gdprConsent: true
      })
      expect(result.success).toBe(false)
    })
  })
})
