import { requireUser, switchActiveMember } from '../../utils/auth'
import { readValidatedBodyStrict, switchMemberSchema } from '../../utils/validation'
import type { ClubMemberProfile } from '../../../types/auth'

export interface SwitchMemberResponse {
  success: boolean
  activeMemberId: string | number
  member: ClubMemberProfile
}

export default defineEventHandler(async (event): Promise<SwitchMemberResponse> => {
  // 1. Ověříme, zda je uživatel přihlášen
  await requireUser(event)

  // 2. Zvalidujeme vstupní data požadavku
  const { memberId } = await readValidatedBodyStrict(event, switchMemberSchema)

  // 3. Přepneme aktivního člena v relaci (aktualizuje session přes setUserSession)
  const member = await switchActiveMember(event, memberId)

  return {
    success: true,
    activeMemberId: member.id,
    member
  }
})
