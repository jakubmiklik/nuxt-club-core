import { requireUser, getUserBranches } from '../../utils/auth'
import type { ClubBranch } from '../../../types/auth'

export interface GetBranchesResponse {
  branches: ClubBranch[]
}

export default defineEventHandler(async (event): Promise<GetBranchesResponse> => {
  // Ověříme, zda je uživatel přihlášen
  const user = await requireUser(event)

  const branches = await getUserBranches(user.id)

  return {
    branches
  }
})
