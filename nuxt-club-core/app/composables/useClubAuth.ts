import type { ComputedRef, Ref } from 'vue'
import type { User, UserSession } from '#auth-utils'
import type { AppRole, ClubUser, ClubMemberProfile } from '../../types/auth'
import type { LoginInput } from '../../server/utils/validation'

export interface LoginResponse {
  success: boolean
  user: ClubUser
}

export interface UseClubAuthReturn {
  /**
   * Reaktivní uživatel přihlášený v aktuální relaci (nebo null)
   */
  user: ComputedRef<User | null>
  /**
   * Příznak, zda je uživatel přihlášen
   */
  loggedIn: ComputedRef<boolean>
  /**
   * Příznak, zda je stav session inicializován a připraven
   */
  ready: ComputedRef<boolean>
  /**
   * Celý session objekt z nuxt-auth-utils
   */
  session: Ref<UserSession | null>
  /**
   * Příznak, zda má aktuální uživatel roli správce (admin)
   */
  isAdmin: ComputedRef<boolean>
  /**
   * Seznam profilů členů / sportovců přiřazených k uživateli
   */
  members: ComputedRef<ClubMemberProfile[]>
  /**
   * Aktuálně aktivní vybraný profil člena / sportovce (nebo null)
   */
  activeMember: ComputedRef<ClubMemberProfile | null>
  /**
   * ID aktuálně aktivní sezóny v kontextu uživatele
   */
  activeSeasonId: ComputedRef<string | number | undefined>
  /**
   * ID aktuálně aktivní pobočky v kontextu uživatele
   */
  activeBranchId: ComputedRef<string | number | undefined>
  /**
   * Zkontroluje, zda má uživatel požadovanou roli nebo alespoň jednu z požadovaných rolí.
   * Uživatel s rolí 'admin' má automatický pass.
   */
  hasRole: (roles: AppRole | AppRole[]) => boolean
  /**
   * Přihlášení uživatele e-mailem a heslem přes /auth/login
   */
  login: (credentials: LoginInput) => Promise<LoginResponse>
  /**
   * Odhlášení uživatele přes /auth/logout a pročištění session
   */
  logout: () => Promise<void>
  /**
   * Znovunačtení / obnovení stavu session ze serveru
   */
  refresh: () => Promise<void>
  /**
   * Přepnutí aktivního člena v relaci
   */
  switchMember: (memberId: string | number) => Promise<void>
  /**
   * Přepnutí aktivní sezóny v relaci
   */
  switchSeason: (seasonId: string | number) => Promise<void>
  /**
   * Přepnutí aktivní pobočky v relaci
   */
  switchBranch: (branchId: string | number) => Promise<void>
  /**
   * Načtení nebo obnovení seznamu profilů členů ze serveru
   */
  fetchMembers: () => Promise<ClubMemberProfile[]>
}

/**
 * Klíčová composable pro správu autentizace a autorizace v klubovém systému.
 * Obaluje `nuxt-auth-utils` a rozšiřuje jej o kontrolu rolí (Hybridní RBAC model)
 * a podporu pro přepínání členských / sportovních profilů.
 */
export function useClubAuth(): UseClubAuthReturn {
  const { user, loggedIn, ready, session, fetch: refreshSession, clear } = useUserSession()
  const fetchedMembers = useState<ClubMemberProfile[]>('club-auth-fetched-members', () => [])

  const isAdmin = computed<boolean>(() => {
    return user.value?.role === 'admin'
  })

  const members = computed<ClubMemberProfile[]>(() => {
    // 1. Přednost má pole members v root session
    if (session.value?.members && session.value.members.length > 0) {
      return session.value.members
    }
    // 2. Případně v user objektu
    if (session.value?.user?.members && session.value.user.members.length > 0) {
      return session.value.user.members
    }
    // 3. Fallback na stav z fetchMembers
    return fetchedMembers.value
  })

  const activeMember = computed<ClubMemberProfile | null>(() => {
    if (!loggedIn.value || members.value.length === 0) {
      return null
    }

    const activeId = session.value?.activeMemberId ?? session.value?.user?.activeMemberId

    if (activeId !== undefined && activeId !== null) {
      const found = members.value.find((m) => String(m.id) === String(activeId))
      if (found) {
        return found
      }
    }

    // Fallback: profil označený jako primární, popř. první dostupný profil
    return members.value.find((m) => m.isPrimary) || members.value[0] || null
  })

  const activeSeasonId = computed<string | number | undefined>(() => {
    return session.value?.activeSeasonId ?? session.value?.user?.activeSeasonId
  })

  const activeBranchId = computed<string | number | undefined>(() => {
    return session.value?.activeBranchId ?? session.value?.user?.activeBranchId
  })

  function hasRole(roles: AppRole | AppRole[]): boolean {
    if (!loggedIn.value || !user.value) {
      return false
    }

    const currentRole = user.value.role as AppRole

    // Admin má vždy plný přístup (superadmin pass)
    if (currentRole === 'admin') {
      return true
    }

    if (Array.isArray(roles)) {
      return roles.includes(currentRole)
    }

    return currentRole === roles
  }

  async function login(credentials: LoginInput): Promise<LoginResponse> {
    const response = await $fetch<LoginResponse>('/auth/login', {
      method: 'POST',
      body: credentials
    })

    // Aktualizujeme stav relace v nuxt-auth-utils
    await refreshSession()

    return response
  }

  async function logout(): Promise<void> {
    try {
      await $fetch('/auth/logout', {
        method: 'POST'
      })
    } finally {
      // Vždy vyčistíme klientskou session i při případné chybě síťového volání
      fetchedMembers.value = []
      await clear()
    }
  }

  async function refresh(): Promise<void> {
    await refreshSession()
  }

  async function fetchMembers(): Promise<ClubMemberProfile[]> {
    if (!loggedIn.value) {
      fetchedMembers.value = []
      return []
    }

    try {
      const data = await $fetch<ClubMemberProfile[] | { members: ClubMemberProfile[] }>('/auth/members')
      const result = Array.isArray(data) ? data : (data?.members || [])
      fetchedMembers.value = result
      return result
    } catch {
      return []
    }
  }

  async function switchMember(memberId: string | number): Promise<void> {
    await $fetch('/auth/switch-member', {
      method: 'POST',
      body: { memberId }
    })

    // Aktualizujeme stav relace v nuxt-auth-utils
    await refreshSession()
  }

  async function switchSeason(seasonId: string | number): Promise<void> {
    await $fetch('/auth/context', {
      method: 'POST',
      body: { seasonId }
    })

    // Aktualizujeme stav relace v nuxt-auth-utils
    await refreshSession()
  }

  async function switchBranch(branchId: string | number): Promise<void> {
    await $fetch('/auth/context', {
      method: 'POST',
      body: { branchId }
    })

    // Aktualizujeme stav relace v nuxt-auth-utils
    await refreshSession()
  }

  return {
    user,
    loggedIn,
    ready,
    session,
    isAdmin,
    members,
    activeMember,
    activeSeasonId,
    activeBranchId,
    hasRole,
    login,
    logout,
    refresh,
    switchMember,
    switchSeason,
    switchBranch,
    fetchMembers
  }
}
