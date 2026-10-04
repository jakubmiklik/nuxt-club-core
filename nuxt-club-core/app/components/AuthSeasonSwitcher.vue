<script setup lang="ts">
import type { ClubSeason, ClubBranch } from '../../types/auth'
import { useClubAuth } from '../composables/useClubAuth'

const props = withDefaults(
  defineProps<{
    /**
     * Zobrazit také přepínač pobočky (oddílu)
     */
    showBranch?: boolean
    /**
     * Kompaktní styl zobrazení
     */
    compact?: boolean
    /**
     * Předvyplněný seznam sezón (pokud nechceme načítat z endpointu /auth/seasons)
     */
    seasons?: ClubSeason[]
    /**
     * Předvyplněný seznam poboček (pokud nechceme načítat z endpointu /auth/branches)
     */
    branches?: ClubBranch[]
  }>(),
  {
    showBranch: false,
    compact: false,
    seasons: undefined,
    branches: undefined
  }
)

const emit = defineEmits<{
  (e: 'season-changed', seasonId: string | number): void
  (e: 'branch-changed', branchId: string | number): void
  (e: 'error', error: unknown): void
}>()

const { loggedIn, activeSeasonId, activeBranchId, switchSeason, switchBranch } = useClubAuth()

const seasonList = ref<ClubSeason[]>([])
const branchList = ref<ClubBranch[]>([])
const isLoadingSeasons = ref(false)
const isLoadingBranches = ref(false)
const isSwitchingSeason = ref(false)
const isSwitchingBranch = ref(false)

const currentSeason = computed(() => {
  if (!activeSeasonId.value) return seasonList.value.find((s) => s.isCurrent) || seasonList.value[0] || null
  return seasonList.value.find((s) => String(s.id) === String(activeSeasonId.value)) || null
})

const currentBranch = computed(() => {
  if (!activeBranchId.value) return branchList.value.find((b) => b.isPrimary) || branchList.value[0] || null
  return branchList.value.find((b) => String(b.id) === String(activeBranchId.value)) || null
})

async function fetchSeasons(): Promise<void> {
  if (props.seasons) {
    seasonList.value = props.seasons
    return
  }
  isLoadingSeasons.value = true
  try {
    const data = await $fetch<{ seasons: ClubSeason[] } | ClubSeason[]>('/auth/seasons')
    seasonList.value = Array.isArray(data) ? data : (data?.seasons || [])
  } catch (err) {
    console.error('[AuthSeasonSwitcher] Nepodařilo se načíst sezóny:', err)
  } finally {
    isLoadingSeasons.value = false
  }
}

async function fetchBranches(): Promise<void> {
  if (!props.showBranch) return
  if (props.branches) {
    branchList.value = props.branches
    return
  }
  isLoadingBranches.value = true
  try {
    const data = await $fetch<{ branches: ClubBranch[] } | ClubBranch[]>('/auth/branches')
    branchList.value = Array.isArray(data) ? data : (data?.branches || [])
  } catch (err) {
    console.error('[AuthSeasonSwitcher] Nepodařilo se načíst pobočky:', err)
  } finally {
    isLoadingBranches.value = false
  }
}

async function handleSeasonChange(event: Event): Promise<void> {
  const target = event.target as HTMLSelectElement
  const newSeasonId = target.value
  if (!newSeasonId || String(newSeasonId) === String(activeSeasonId.value)) return

  isSwitchingSeason.value = true
  try {
    await switchSeason(newSeasonId)
    emit('season-changed', newSeasonId)
  } catch (error) {
    console.error('[AuthSeasonSwitcher] Chyba při přepnutí sezóny:', error)
    emit('error', error)
  } finally {
    isSwitchingSeason.value = false
  }
}

async function handleBranchChange(event: Event): Promise<void> {
  const target = event.target as HTMLSelectElement
  const newBranchId = target.value
  if (!newBranchId || String(newBranchId) === String(activeBranchId.value)) return

  isSwitchingBranch.value = true
  try {
    await switchBranch(newBranchId)
    emit('branch-changed', newBranchId)
  } catch (error) {
    console.error('[AuthSeasonSwitcher] Chyba při přepnutí pobočky:', error)
    emit('error', error)
  } finally {
    isSwitchingBranch.value = false
  }
}

watch(() => props.seasons, (val) => {
  if (val) seasonList.value = val
})

watch(() => props.branches, (val) => {
  if (val) branchList.value = val
})

onMounted(async () => {
  if (loggedIn.value) {
    await Promise.all([fetchSeasons(), fetchBranches()])
  }
})
</script>

<template>
  <div v-if="loggedIn" class="inline-flex items-center gap-2">
    <!-- Přepínač sezóny -->
    <div class="relative flex items-center">
      <label for="club-season-select" class="sr-only">Vyberte sezónu</label>
      <div class="relative flex items-center">
        <!-- Ikona kalendáře -->
        <span class="pointer-events-none absolute left-2.5 text-slate-400 dark:text-slate-500">
          <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </span>

        <select
          id="club-season-select"
          :value="activeSeasonId ?? currentSeason?.id ?? ''"
          :disabled="isSwitchingSeason || isLoadingSeasons || seasonList.length <= 1"
          class="appearance-none rounded-xl border border-slate-200 bg-white py-1.5 pr-8 pl-8 text-xs font-semibold text-slate-700 shadow-2xs transition-all hover:bg-slate-50 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-default disabled:opacity-75 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          :class="[compact ? 'py-1 pr-7 pl-7 text-[11px]' : '']"
          @change="handleSeasonChange"
        >
          <option v-if="seasonList.length === 0" value="" disabled>
            {{ isLoadingSeasons ? 'Načítání...' : 'Žádná sezóna' }}
          </option>
          <option
            v-for="season in seasonList"
            :key="season.id"
            :value="season.id"
          >
            {{ season.name }} {{ season.isCurrent ? '★' : '' }}
          </option>
        </select>

        <!-- Spinner nebo šipka -->
        <div class="pointer-events-none absolute right-2.5 flex items-center text-slate-400 dark:text-slate-500">
          <svg
            v-if="isSwitchingSeason"
            class="h-3.5 w-3.5 animate-spin text-blue-600 dark:text-blue-400"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <svg
            v-else-if="seasonList.length > 1"
            class="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </div>

    <!-- Přepínač pobočky (pokud je povolen) -->
    <div v-if="showBranch && (branchList.length > 0 || isLoadingBranches)" class="relative flex items-center">
      <label for="club-branch-select" class="sr-only">Vyberte pobočku</label>
      <div class="relative flex items-center">
        <!-- Ikona pobočky / budovy -->
        <span class="pointer-events-none absolute left-2.5 text-slate-400 dark:text-slate-500">
          <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </span>

        <select
          id="club-branch-select"
          :value="activeBranchId ?? currentBranch?.id ?? ''"
          :disabled="isSwitchingBranch || isLoadingBranches || branchList.length <= 1"
          class="appearance-none rounded-xl border border-slate-200 bg-white py-1.5 pr-8 pl-8 text-xs font-semibold text-slate-700 shadow-2xs transition-all hover:bg-slate-50 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-default disabled:opacity-75 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          :class="[compact ? 'py-1 pr-7 pl-7 text-[11px]' : '']"
          @change="handleBranchChange"
        >
          <option v-if="branchList.length === 0" value="" disabled>
            {{ isLoadingBranches ? 'Načítání...' : 'Žádná pobočka' }}
          </option>
          <option
            v-for="branch in branchList"
            :key="branch.id"
            :value="branch.id"
          >
            {{ branch.name }} {{ branch.isPrimary ? '(Hlavní)' : '' }}
          </option>
        </select>

        <!-- Spinner nebo šipka -->
        <div class="pointer-events-none absolute right-2.5 flex items-center text-slate-400 dark:text-slate-500">
          <svg
            v-if="isSwitchingBranch"
            class="h-3.5 w-3.5 animate-spin text-blue-600 dark:text-blue-400"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <svg
            v-else-if="branchList.length > 1"
            class="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </div>
  </div>
</template>
