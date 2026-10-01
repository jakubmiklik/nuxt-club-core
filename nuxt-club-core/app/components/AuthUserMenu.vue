<script setup lang="ts">
import type { UserRole } from '../../types/auth'

const props = withDefaults(
  defineProps<{
    loginUrl?: string
    redirectAfterLogout?: string
  }>(),
  {
    loginUrl: '/login',
    redirectAfterLogout: '/login'
  }
)

const { user, loggedIn, clear } = useUserSession()
const isOpen = ref(false)
const isLoggingOut = ref(false)
const menuRef = ref<HTMLElement | null>(null)

// Mapování rolí na české názvy a styly odznaků (badges)
const roleConfig: Record<
  UserRole,
  { label: string; badgeClass: string; dotClass: string }
> = {
  admin: {
    label: 'Správce',
    badgeClass:
      'bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/20 dark:bg-purple-950/40 dark:text-purple-300 dark:ring-purple-500/30',
    dotClass: 'bg-purple-500'
  },
  coach: {
    label: 'Trenér',
    badgeClass:
      'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-500/30',
    dotClass: 'bg-blue-500'
  },
  member: {
    label: 'Člen oddílu',
    badgeClass:
      'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-500/30',
    dotClass: 'bg-emerald-500'
  },
  parent: {
    label: 'Rodič',
    badgeClass:
      'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-500/30',
    dotClass: 'bg-amber-500'
  }
}

const currentRoleInfo = computed(() => {
  const role = (user.value?.role as UserRole) || 'member'
  return roleConfig[role] || roleConfig.member
})

// Iniciály uživatele pro avatar fallback
const initials = computed(() => {
  if (!user.value?.name) return 'U'
  const parts = user.value.name.trim().split(/\s+/)
  const first = parts[0]
  const second = parts[1]
  if (first && second && first[0] && second[0]) {
    return `${first[0]}${second[0]}`.toUpperCase()
  }
  return (first || 'U').slice(0, 2).toUpperCase()
})

function toggleMenu() {
  isOpen.value = !isOpen.value
}

function closeMenu() {
  isOpen.value = false
}

// Obsluha kliknutí mimo komponentu
function handleClickOutside(event: MouseEvent) {
  if (menuRef.value && !menuRef.value.contains(event.target as Node)) {
    closeMenu()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

async function handleLogout() {
  if (isLoggingOut.value) return

  isLoggingOut.value = true
  try {
    await $fetch('/auth/logout', { method: 'POST' })
    await clear()
    closeMenu()
    await navigateTo(props.redirectAfterLogout)
  } catch (error) {
    console.error('[nuxt-club-core] Chyba při odhlašování:', error)
  } finally {
    isLoggingOut.value = false
  }
}
</script>

<template>
  <div v-if="loggedIn && user" ref="menuRef" class="relative inline-block text-left">
    <!-- Tlačítko pro otevření menu -->
    <button
      type="button"
      class="flex items-center gap-3 rounded-full p-1.5 transition-colors hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600/30 dark:hover:bg-slate-800"
      :aria-expanded="isOpen"
      aria-haspopup="true"
      @click="toggleMenu"
    >
      <!-- Avatar s obrázkem nebo iniciálami -->
      <div class="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <NuxtImg
          v-if="user.avatar"
          :src="user.avatar"
          :alt="user.name"
          class="h-full w-full object-cover"
          loading="lazy"
        />
        <div
          v-else
          class="flex h-full w-full items-center justify-center font-bold text-xs text-slate-600 dark:text-slate-300"
        >
          {{ initials }}
        </div>
      </div>

      <!-- Jméno a role na větších obrazovkách -->
      <div class="hidden text-left sm:block pr-1">
        <div class="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-tight">
          {{ user.name }}
        </div>
        <div class="text-xs text-slate-500 dark:text-slate-400">
          {{ currentRoleInfo.label }}
        </div>
      </div>

      <!-- Šipka dolů -->
      <svg
        class="h-4 w-4 text-slate-400 transition-transform duration-200"
        :class="{ 'rotate-180': isOpen }"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <!-- Dropdown panel -->
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
        class="absolute right-0 z-50 mt-2 w-64 origin-top-right rounded-2xl border border-slate-200/80 bg-white p-2 shadow-xl shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none"
      >
        <!-- Shrnutí profilu -->
        <div class="border-b border-slate-100 px-3 py-3 dark:border-slate-800">
          <p class="text-sm font-semibold text-slate-900 dark:text-white truncate">
            {{ user.name }}
          </p>
          <p class="text-xs text-slate-500 dark:text-slate-400 truncate mb-2">
            {{ user.email }}
          </p>

          <!-- Role Badge -->
          <span
            class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
            :class="currentRoleInfo.badgeClass"
          >
            <span class="h-1.5 w-1.5 rounded-full" :class="currentRoleInfo.dotClass" />
            {{ currentRoleInfo.label }}
          </span>
        </div>

        <!-- Vlastní slot pro navigaci hostitelské aplikace (např. Profil, Tréninky, Administrace) -->
        <div v-if="$slots.default" class="py-1 border-b border-slate-100 dark:border-slate-800">
          <slot :user="user" :close="closeMenu" />
        </div>

        <!-- Tlačítko Odhlásit se -->
        <div class="pt-1">
          <button
            type="button"
            :disabled="isLoggingOut"
            class="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50 focus:outline-none dark:text-red-400 dark:hover:bg-red-950/30"
            @click="handleLogout"
          >
            <svg
              v-if="!isLoggingOut"
              class="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            </svg>
            <svg
              v-else
              class="h-4 w-4 animate-spin text-red-600 dark:text-red-400"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span>{{ isLoggingOut ? 'Odhlašování...' : 'Odhlásit se' }}</span>
          </button>
        </div>
      </div>
    </Transition>
  </div>

  <!-- Pokud uživatel není přihlášen, zobrazí se odkaz na login -->
  <NuxtLink
    v-else
    :to="loginUrl"
    class="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
  >
    Přihlásit se
  </NuxtLink>
</template>
