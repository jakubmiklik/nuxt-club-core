import { requireRole, listMemberInvitations } from '../../utils/auth'
import type { ClubInvitation, AppRole } from '../../../types/auth'

export interface AdminListInvitationsResponse {
  invitations: ClubInvitation[]
}

export default defineEventHandler(async (event): Promise<AdminListInvitationsResponse> => {
  // 1. Chráněno: přístup mají administrátoři a trenéři
  await requireRole(event, ['admin', 'coach' as AppRole])

  // 2. Načtení seznamu pozvánek
  const invitations = await listMemberInvitations()

  return {
    invitations
  }
})
