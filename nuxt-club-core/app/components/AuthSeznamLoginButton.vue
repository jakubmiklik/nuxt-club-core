<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    label?: string
    redirectTo?: string
    disabled?: boolean
  }>(),
  {
    label: 'Přihlásit se přes Seznam',
    redirectTo: '/',
    disabled: false
  }
)

const isLoading = ref(false)

function handleSeznamLogin() {
  if (props.disabled || isLoading.value) return

  isLoading.value = true

  // Uložíme cílovou URL do dočasné cookie s platností 10 minut pro serverový handler
  if (props.redirectTo) {
    const authRedirectCookie = useCookie('auth_redirect', {
      maxAge: 600,
      path: '/'
    })
    authRedirectCookie.value = props.redirectTo
  }

  // Přesměrování na serverový Seznam OAuth route
  window.location.href = '/auth/seznam'
}
</script>

<template>
  <button
    type="button"
    :disabled="disabled || isLoading"
    class="relative inline-flex w-full items-center justify-center gap-3 rounded-xl border border-red-600 bg-[#CC0000] px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#B30000] hover:border-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
    @click="handleSeznamLogin"
  >
    <!-- Seznam.cz Ikona (Bílé stylizované "S" / Seznam pes/logo) -->
    <svg
      v-if="!isLoading"
      class="h-5 w-5 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="11" fill="white" fill-opacity="0.2" />
      <path
        d="M15.8 8.2C15.2 7.4 14.1 6.8 12.8 6.8C10.7 6.8 9.2 8.1 9.2 9.9C9.2 13 14.8 11.8 14.8 14.5C14.8 15.6 13.8 16.4 12.2 16.4C10.6 16.4 9.4 15.6 8.8 14.6M8.2 15.8C8.8 16.6 9.9 17.2 11.2 17.2C13.3 17.2 14.8 15.9 14.8 14.1C14.8 11 9.2 12.2 9.2 9.5C9.2 8.4 10.2 7.6 11.8 7.6C13.4 7.6 14.6 8.4 15.2 9.4"
        stroke="white"
        stroke-width="2.2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>

    <!-- Načítací Spinner -->
    <svg
      v-else
      class="h-5 w-5 animate-spin text-white"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        class="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        stroke-width="4"
      />
      <path
        class="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v8H4z"
      />
    </svg>

    <span>{{ isLoading ? 'Přesměrování...' : label }}</span>
  </button>
</template>
