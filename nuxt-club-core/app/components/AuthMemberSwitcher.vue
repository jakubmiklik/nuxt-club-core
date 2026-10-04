<script setup lang="ts">
import type { ClubMemberProfile } from '../../types/auth'
import { useClubAuth } from '../composables/useClubAuth'

const props = withDefaults(
  defineProps<{
    /**
     * Skrýt komponentu, pokud uživatel nemá přiřazený žádný profil
     */
    hideIfEmpty?: boolean
    /**
     * Skrýt přepínač (rozbalovací nabídku), pokud má uživatel pouze jeden profil
     */
    hideIfSingle?: boolean
    /**
     * Zobrazit kompaktní variantu (vhodné pro mobilní hlavičky)
     */
    compact?: boolean
  }>(),
  {
    hideIfEmpty: true,
    hideIfSingle: false,
    compact: false
  }
)

const emit = defineEmits<{
  (e: 'switched', member: ClubMemberProfile): void
  (e: 'error', error: unknown): void
}>()

const { loggedIn, members, activeMember, switchMember, fetchMembers } = useClubAuth()

const isOpen = ref(false)
const isSwitching = ref(false)
const switchingMemberId = ref<string | number | null>(null)
const switcherRef = ref<HTMLElement | null>(null)

// Získání iniciál profilu pro zobrazení avataru
function getMemberInitials(member?: ClubMemberProfile | null): string {
  if (!member) return '?'
  const first = member.firstName ? member.firstName.trim().charAt(0) : ''
  const last = member.lastName ? member.lastName.trim().charAt(0) : ''
  const combined = `${first}${last}`.toUpperCase()
  return combined || member.firstName.slice(0, 2).toUpperCase() || '?'
}

// Získání celého jména člena
function getMemberFullName(member?: ClubMemberProfile | null): string {
  if (!member) return 'Neznámý profil'
  return `${member.firstName} ${member.lastName}`.trim()
}

// Kontrola, zda je profil aktuálně aktivní
function isCurrent(memberId: string | number): boolean {
  return String(activeMember.value?.id) === String(memberId)
}

function toggleDropdown(): void {
  if (props.hideIfSingle && members.value.length <= 1) {
    return
  }
  isOpen.value = !isOpen.value
}

function closeDropdown(): void {
  isOpen.value = false
}

// Obsluha kliknutí mimo komponentu
function handleClickOutside(event: MouseEvent): void {
  if (switcherRef.value && !switcherRef.value.contains(event.target as Node)) {
    closeDropdown()
  }
}

// Přepnutí aktivního člena
async function handleSelect(member: ClubMemberProfile): Promise<void> {
  if (isCurrent(member.id)) {
    closeDropdown()
    return
  }

  if (isSwitching.value) return

  isSwitching.value = true
  switchingMemberId.value = member.id

  try {
    await switchMember(member.id)
    emit('switched', member)
    closeDropdown()
  } catch (error) {
    console.error('[AuthMemberSwitcher] Chyba při přepínání aktivního člena:', error)
    emit('error', error)
  } finally {
    isSwitching.value = false
    switchingMemberId.value = null
  }
}

onMounted(async () => {
  document.addEventListener('click', handleClickOutside)
  // Pokud uživatel je přihlášen a seznam členů je prázdný, načteme jej
  if (loggedIn.value && members.value.length === 0) {
    await fetchMembers()
  }
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <!-- Komponenta se nezobrazuje, pokud uživatel není přihlášen nebo nemá profily a hideIfEmpty je zapnuto -->
  <div
    v-if="loggedIn && (!hideIfEmpty || members.length > 0)"
    ref="switcherRef"
    class="relative inline-block text-left"
  >
    <!-- Tlačítko pro zobrazení aktivního člena / otevření nabídky -->
    <button
      type="button"
      :disabled="isSwitching || (hideIfSingle && members.length <= 1)"
      class="group flex items-center gap-2.5 rounded-2xl border border-slate-200/90 bg-white px-3 py-1.5 text-left text-sm font-medium shadow-xs transition-all hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600/30 disabled:cursor-default dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800/80"
      :class="[
        isOpen ? 'ring-2 ring-blue-600/20 dark:ring-blue-500/20 border-blue-500/40' : '',
        compact ? 'px-2 py-1' : ''
      ]"
      :aria-expanded="isOpen"
      aria-haspopup="listbox"
      @click="toggleDropdown"
    >
      <!-- Avatar aktivního člena -->
      <div
        class="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-blue-100 font-bold text-xs text-blue-700 ring-1 ring-blue-600/10 dark:bg-blue-950 dark:text-blue-300 dark:ring-blue-400/20"
      >
        <NuxtImg
          v-if="activeMember?.avatar"
          :src="activeMember.avatar"
          :alt="getMemberFullName(activeMember)"
          class="h-full w-full object-cover"
          loading="lazy"
        />
        <span v-else>{{ getMemberInitials(activeMember) }}</span>

        <!-- Indikátor načítání na avataru -->
        <span
          v-if="isSwitching"
          class="absolute inset-0 flex items-center justify-center bg-blue-600/60 backdrop-blur-xs"
        >
          <svg class="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </span>
      </div>

      <!-- Informace o aktivním profilu -->
      <div v-if="!compact" class="flex flex-col pr-1">
        <span class="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100 leading-tight">
          {{ getMemberFullName(activeMember) }}
          <span
            v-if="activeMember?.category"
            class="rounded-md bg-slate-100 px-1.5 py-0.2 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400"
          >
            {{ activeMember.category }}
          </span>
        </span>
        <span class="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
          {{ activeMember?.licenseNumber ? `Ev. č. ${activeMember.licenseNumber}` : 'Aktivní profil' }}
        </span>
      </div>

      <!-- Šipka dolů (zobrazena pouze, pokud je k dispozici více profilů nebo není vypnuta) -->
      <svg
        v-if="!hideIfSingle || members.length > 1"
        class="h-4 w-4 text-slate-400 transition-transform duration-200 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300"
        :class="{ 'rotate-180': isOpen }"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <!-- Dropdown nabídka profilů -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="transform scale-95 opacity-0"
      enter-to-class="transform scale-100 opacity-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="transform scale-100 opacity-100"
      leave-to-class="transform scale-95 opacity-0"
    >
      <div
        v-if="isOpen"
        class="absolute right-0 z-50 mt-2 min-w-64 max-w-xs origin-top-right rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-xl shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none"
        role="listbox"
      >
        <!-- Hlavička dropdownu -->
        <div class="border-b border-slate-100 px-3 py-2 dark:border-slate-800">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Přepnout profil
            </span>
            <span
              v-if="members.length > 0"
              class="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            >
              {{ members.length }} {{ members.length === 1 ? 'profil' : members.length < 5 ? 'profily' : 'profilů' }}
            </span>
          </div>
        </div>

        <!-- Seznam profilů -->
        <div class="max-h-72 overflow-y-auto py-1">
          <div
            v-if="members.length === 0"
            class="px-3 py-4 text-center text-xs text-slate-500 dark:text-slate-400"
          >
            Žádné profily k dispozici
          </div>

          <button
            v-for="member in members"
            :key="member.id"
            type="button"
            role="option"
            :aria-selected="isCurrent(member.id)"
            :disabled="isSwitching"
            class="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-slate-100 focus:bg-slate-100 focus:outline-none dark:hover:bg-slate-800/80 dark:focus:bg-slate-800/80"
            :class="[
              isCurrent(member.id)
                ? 'bg-blue-50/80 font-medium text-blue-900 dark:bg-blue-950/40 dark:text-blue-200'
                : 'text-slate-700 dark:text-slate-300'
            ]"
            @click="handleSelect(member)"
          >
            <div class="flex items-center gap-2.5 min-w-0">
              <!-- Avatar profilu -->
              <div
                class="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl text-xs font-bold ring-1 transition-colors"
                :class="[
                  isCurrent(member.id)
                    ? 'bg-blue-600 text-white ring-blue-600/30'
                    : 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700'
                ]"
              >
                <NuxtImg
                  v-if="member.avatar"
                  :src="member.avatar"
                  :alt="getMemberFullName(member)"
                  class="h-full w-full object-cover"
                  loading="lazy"
                />
                <span v-else>{{ getMemberInitials(member) }}</span>

                <!-- Spinner při probíhajícím přepínání -->
                <span
                  v-if="isSwitching && switchingMemberId === member.id"
                  class="absolute inset-0 flex items-center justify-center bg-blue-600/70"
                >
                  <svg class="h-3.5 w-3.5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                </span>
              </div>

              <!-- Jméno a doplňující info -->
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5 truncate text-xs font-medium">
                  <span class="truncate">{{ getMemberFullName(member) }}</span>
                  <span
                    v-if="member.isPrimary"
                    class="shrink-0 rounded-sm bg-blue-100 px-1 text-[9px] font-semibold text-blue-700 dark:bg-blue-900/60 dark:text-blue-300"
                  >
                    Primární
                  </span>
                </div>
                <div class="flex items-center gap-2 truncate text-[11px] text-slate-500 dark:text-slate-400">
                  <span v-if="member.category">{{ member.category }}</span>
                  <span v-if="member.category && member.licenseNumber">•</span>
                  <span v-if="member.licenseNumber">{{ member.licenseNumber }}</span>
                </div>
              </div>
            </div>

            <!-- Fajfka pro aktivní profil -->
            <div v-if="isCurrent(member.id)" class="shrink-0 text-blue-600 dark:text-blue-400">
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </button>
        </div>

        <!-- Volitelný slot pro akce ve spodní části nabídky (např. 'Přidat dalšího sportovce') -->
        <div v-if="$slots.footer" class="border-t border-slate-100 pt-1 dark:border-slate-800">
          <slot name="footer" :close="closeDropdown" />
        </div>
      </div>
    </Transition>
  </div>
</template>
