<script setup lang="ts">
import type { ClubUser, AppRole } from '../../types/auth'
import { useClubAuth } from '../composables/useClubAuth'

const props = withDefaults(
  defineProps<{
    /**
     * Výchozí počet položek na stránku
     */
    pageSize?: number
    /**
     * Dostupné role pro přiřazení v dropdownu
     */
    availableRoles?: { value: AppRole; label: string }[]
  }>(),
  {
    pageSize: 15,
    availableRoles: () => [
      { value: 'admin', label: 'Administrátor' },
      { value: 'user', label: 'Uživatel' }
    ]
  }
)

const emit = defineEmits<{
  (e: 'role-updated', payload: { userId: string | number; role: AppRole }): void
  (e: 'status-updated', payload: { userId: string | number; status: 'active' | 'suspended' }): void
  (e: 'error', error: unknown): void
}>()

const { isAdmin, user: currentUser } = useClubAuth()

const users = ref<ClubUser[]>([])
const totalUsers = ref(0)
const currentPage = ref(1)
const searchQuery = ref('')
const selectedRoleFilter = ref<string>('')
const isLoading = ref(false)
const actionInProgress = ref<Record<string, boolean>>({})
const statusMessage = ref<{ type: 'success' | 'error'; text: string } | null>(null)

let searchDebounceTimeout: any = null

const totalPages = computed(() => {
  return Math.ceil(totalUsers.value / props.pageSize) || 1
})

async function fetchUsers(): Promise<void> {
  if (!isAdmin.value) return

  isLoading.value = true
  try {
    const params: Record<string, string | number> = {
      page: currentPage.value,
      limit: props.pageSize
    }
    if (searchQuery.value.trim()) {
      params.search = searchQuery.value.trim()
    }
    if (selectedRoleFilter.value) {
      params.role = selectedRoleFilter.value
    }

    const response = await $fetch<{
      users: ClubUser[]
      total: number
      page: number
      limit: number
    }>('/api/admin/users', {
      params
    })

    users.value = response.users || []
    totalUsers.value = response.total || 0
  } catch (err: any) {
    console.error('[AdminUserManagementTable] Chyba při načítání uživatelů:', err)
    statusMessage.value = {
      type: 'error',
      text: err?.data?.message || 'Nepodařilo se načíst seznam uživatelů.'
    }
    emit('error', err)
  } finally {
    isLoading.value = false
  }
}

function handleSearchInput(): void {
  clearTimeout(searchDebounceTimeout)
  searchDebounceTimeout = setTimeout(() => {
    currentPage.value = 1
    fetchUsers()
  }, 350)
}

function handleFilterChange(): void {
  currentPage.value = 1
  fetchUsers()
}

function goToPage(page: number): void {
  if (page < 1 || page > totalPages.value || page === currentPage.value) return
  currentPage.value = page
  fetchUsers()
}

async function handleRoleChange(user: ClubUser, newRole: AppRole): Promise<void> {
  if (user.role === newRole) return

  const actionKey = `role-${user.id}`
  actionInProgress.value[actionKey] = true
  statusMessage.value = null

  try {
    await $fetch(`/api/admin/users/${user.id}/role`, {
      method: 'PUT',
      body: { role: newRole }
    })

    user.role = newRole
    statusMessage.value = {
      type: 'success',
      text: `Role uživatele "${user.name}" byla úspěšně změněna na "${newRole}".`
    }
    emit('role-updated', { userId: user.id, role: newRole })
  } catch (err: any) {
    console.error('[AdminUserManagementTable] Chyba při změně role:', err)
    statusMessage.value = {
      type: 'error',
      text: err?.data?.message || 'Změna role se nezdařila.'
    }
    emit('error', err)
    // Obnovit seznam pro reset neuloženého stavu
    await fetchUsers()
  } finally {
    actionInProgress.value[actionKey] = false
  }
}

async function handleToggleStatus(user: ClubUser): Promise<void> {
  const newStatus: 'active' | 'suspended' = user.status === 'suspended' ? 'active' : 'suspended'
  const actionKey = `status-${user.id}`
  actionInProgress.value[actionKey] = true
  statusMessage.value = null

  try {
    await $fetch(`/api/admin/users/${user.id}/status`, {
      method: 'PUT',
      body: { status: newStatus }
    })

    user.status = newStatus
    statusMessage.value = {
      type: 'success',
      text: `Uživatel "${user.name}" byl úspěšně ${newStatus === 'active' ? 'aktivován' : 'pozastaven'}.`
    }
    emit('status-updated', { userId: user.id, status: newStatus })
  } catch (err: any) {
    console.error('[AdminUserManagementTable] Chyba při změně stavu:', err)
    statusMessage.value = {
      type: 'error',
      text: err?.data?.message || 'Změna stavu uživatele se nezdařila.'
    }
    emit('error', err)
  } finally {
    actionInProgress.value[actionKey] = false
  }
}

function isCurrentUser(user: ClubUser): boolean {
  return String(user.id) === String(currentUser.value?.id)
}

function getUserInitials(user: ClubUser): string {
  if (!user.name) return '?'
  const parts = user.name.trim().split(/\s+/)
  const first = parts[0]
  const second = parts[1]
  if (first && second) {
    return `${first.charAt(0)}${second.charAt(0)}`.toUpperCase()
  }
  return user.name.slice(0, 2).toUpperCase()
}

onMounted(() => {
  if (isAdmin.value) {
    fetchUsers()
  }
})
</script>

<template>
  <div v-if="!isAdmin" class="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
    <div class="flex flex-col items-center gap-2">
      <svg class="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <span class="font-semibold">Přístup odepřen</span>
      <span>Pro správu uživatelů musíte mít oprávnění administrátora.</span>
    </div>
  </div>

  <div v-else class="space-y-4">
    <!-- Horní lišta: vyhledávání a filtrace -->
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="relative flex-1 max-w-sm">
        <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </span>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Hledat podle jména nebo e-mailu..."
          class="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 placeholder-slate-400 shadow-2xs transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
          @input="handleSearchInput"
        />
      </div>

      <div class="flex items-center gap-2">
        <select
          v-model="selectedRoleFilter"
          class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-2xs transition hover:bg-slate-50 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          @change="handleFilterChange"
        >
          <option value="">Všechny role</option>
          <option
            v-for="role in availableRoles"
            :key="role.value"
            :value="role.value"
          >
            {{ role.label }}
          </option>
        </select>

        <button
          type="button"
          :disabled="isLoading"
          class="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-2xs transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          @click="fetchUsers"
        >
          <svg
            class="h-4 w-4"
            :class="{ 'animate-spin': isLoading }"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>Obnovit</span>
        </button>
      </div>
    </div>

    <!-- Zpráva o stavu / výsledku -->
    <div
      v-if="statusMessage"
      class="rounded-xl p-3 text-sm transition-all"
      :class="[
        statusMessage.type === 'success'
          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800/40'
          : 'bg-red-50 text-red-800 border border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800/40'
      ]"
    >
      <div class="flex items-center justify-between">
        <span>{{ statusMessage.text }}</span>
        <button
          type="button"
          class="text-xs font-semibold opacity-70 hover:opacity-100"
          @click="statusMessage = null"
        >
          ✕
        </button>
      </div>
    </div>

    <!-- Tabulka uživatelů -->
    <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm text-slate-600 dark:text-slate-300">
          <thead class="border-b border-slate-200 bg-slate-50/75 text-xs uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
            <tr>
              <th scope="col" class="px-4 py-3">Uživatel</th>
              <th scope="col" class="px-4 py-3">E-mail</th>
              <th scope="col" class="px-4 py-3">Role</th>
              <th scope="col" class="px-4 py-3">Stav</th>
              <th scope="col" class="px-4 py-3 text-right">Akce</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            <tr v-if="isLoading && users.length === 0">
              <td colspan="5" class="py-12 text-center text-slate-500 dark:text-slate-400">
                <div class="flex items-center justify-center gap-2">
                  <svg class="h-5 w-5 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Načítání uživatelů...</span>
                </div>
              </td>
            </tr>

            <tr v-else-if="users.length === 0">
              <td colspan="5" class="py-12 text-center text-slate-500 dark:text-slate-400">
                Žádní uživatelé neodpovídají zadaným kritériím.
              </td>
            </tr>

            <tr
              v-for="userItem in users"
              :key="userItem.id"
              class="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
              :class="{ 'opacity-60': userItem.status === 'suspended' }"
            >
              <!-- Uživatel s avatarem -->
              <td class="px-4 py-3 font-medium text-slate-900 dark:text-white">
                <div class="flex items-center gap-3">
                  <div class="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-100 font-semibold text-xs text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                    <NuxtImg
                      v-if="userItem.avatar"
                      :src="userItem.avatar"
                      :alt="userItem.name"
                      class="h-full w-full object-cover"
                    />
                    <span v-else>{{ getUserInitials(userItem) }}</span>
                  </div>
                  <div>
                    <div class="flex items-center gap-1.5">
                      <span class="font-semibold">{{ userItem.name }}</span>
                      <span
                        v-if="isCurrentUser(userItem)"
                        class="rounded-md bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                      >
                        Vy
                      </span>
                    </div>
                    <span class="text-[11px] text-slate-400">ID: {{ userItem.id }}</span>
                  </div>
                </div>
              </td>

              <!-- E-mail -->
              <td class="px-4 py-3 text-slate-600 dark:text-slate-300">
                {{ userItem.email }}
              </td>

              <!-- Role (dropdown pro změnu) -->
              <td class="px-4 py-3">
                <select
                  :value="userItem.role"
                  :disabled="actionInProgress[`role-${userItem.id}`] || isCurrentUser(userItem)"
                  class="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  @change="(e) => handleRoleChange(userItem, (e.target as HTMLSelectElement).value as AppRole)"
                >
                  <option
                    v-for="role in availableRoles"
                    :key="role.value"
                    :value="role.value"
                  >
                    {{ role.label }}
                  </option>
                </select>
              </td>

              <!-- Stav uživatele -->
              <td class="px-4 py-3">
                <span
                  class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
                  :class="[
                    userItem.status === 'suspended'
                      ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                      : userItem.status === 'pending'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                  ]"
                >
                  <span
                    class="h-1.5 w-1.5 rounded-full"
                    :class="[
                      userItem.status === 'suspended'
                        ? 'bg-red-500'
                        : userItem.status === 'pending'
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                    ]"
                  />
                  {{
                    userItem.status === 'suspended'
                      ? 'Pozastaven'
                      : userItem.status === 'pending'
                        ? 'Čekající'
                        : 'Aktivní'
                  }}
                </span>
              </td>

              <!-- Akce (blokovat / odblokovat) -->
              <td class="px-4 py-3 text-right">
                <button
                  type="button"
                  :disabled="actionInProgress[`status-${userItem.id}`] || isCurrentUser(userItem)"
                  class="rounded-lg px-2.5 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
                  :class="[
                    userItem.status === 'suspended'
                      ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/60'
                      : 'bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-900/60'
                  ]"
                  @click="handleToggleStatus(userItem)"
                >
                  <span v-if="actionInProgress[`status-${userItem.id}`]">
                    Zpracování...
                  </span>
                  <span v-else>
                    {{ userItem.status === 'suspended' ? 'Odblokovat' : 'Zablokovat' }}
                  </span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Stránkování -->
      <div class="flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row dark:border-slate-800">
        <div class="text-xs text-slate-500 dark:text-slate-400">
          Celkem <span class="font-semibold text-slate-700 dark:text-slate-200">{{ totalUsers }}</span> {{ totalUsers === 1 ? 'uživatel' : totalUsers < 5 ? 'uživatelé' : 'uživatelů' }} (strana {{ currentPage }} z {{ totalPages }})
        </div>

        <div class="flex items-center gap-1">
          <button
            type="button"
            :disabled="currentPage <= 1 || isLoading"
            class="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-2xs transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
            @click="goToPage(currentPage - 1)"
          >
            Předchozí
          </button>

          <span class="px-2 text-xs font-medium text-slate-600 dark:text-slate-400">
            {{ currentPage }} / {{ totalPages }}
          </span>

          <button
            type="button"
            :disabled="currentPage >= totalPages || isLoading"
            class="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-2xs transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
            @click="goToPage(currentPage + 1)"
          >
            Další
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
