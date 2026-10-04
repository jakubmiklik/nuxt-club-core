import { requireUser, getClubSeasons } from '../../utils/auth'
import type { ClubSeason } from '../../../types/auth'

export interface GetSeasonsResponse {
  seasons: ClubSeason[]
}

export default defineEventHandler(async (event): Promise<GetSeasonsResponse> => {
  // Ověříme, zda je uživatel přihlášen
  await requireUser(event)

  const seasons = await getClubSeasons()

  return {
    seasons
  }
})
