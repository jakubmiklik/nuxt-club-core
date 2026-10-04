import { requireUser, getUserMembers } from '../../utils/auth'
import type { ClubMemberProfile } from '../../../types/auth'

export default defineEventHandler(async (event): Promise<ClubMemberProfile[]> => {
  // 1. Ověříme, zda je uživatel přihlášen
  const user = await requireUser(event)

  // 2. Načteme profily členů / sportovců asociované s uživatelem
  const members = await getUserMembers(user.id)

  return members
})
