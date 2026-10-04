import { requireUser } from '../../utils/auth'
import { readValidatedBodyStrict, switchContextSchema } from '../../utils/validation'

export interface SwitchContextResponse {
  success: boolean
  activeSeasonId?: string | number
  activeBranchId?: string | number
}

export default defineEventHandler(async (event): Promise<SwitchContextResponse> => {
  // 1. Ověříme, zda je uživatel přihlášen
  const user = await requireUser(event)

  // 2. Zvalidujeme vstupní body
  const body = await readValidatedBodyStrict(event, switchContextSchema)

  // 3. Načteme stávající session
  const currentSession = await getUserSession(event)

  const activeSeasonId = body.seasonId !== undefined
    ? body.seasonId
    : (currentSession.activeSeasonId ?? user.activeSeasonId)

  const activeBranchId = body.branchId !== undefined
    ? body.branchId
    : (currentSession.activeBranchId ?? user.activeBranchId)

  // 4. Aktualizujeme session
  await setUserSession(event, {
    ...currentSession,
    user: {
      ...user,
      activeSeasonId,
      activeBranchId
    },
    activeSeasonId,
    activeBranchId
  })

  return {
    success: true,
    activeSeasonId,
    activeBranchId
  }
})
