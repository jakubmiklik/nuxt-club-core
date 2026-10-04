<script setup lang="ts">

const props = withDefaults(
  defineProps<{
    label?: string
    redirectTo?: string
    disabled?: boolean
  }>(),
  {
    label: 'Přihlásit se přes Google',
    redirectTo: '/',
    disabled: false
  }
)

const isLoading = ref(false)

function handleGoogleLogin() {
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

  // Přesměrování na serverový Google OAuth route
  window.location.href = '/api/auth/google'
}
</script>

<template>
  <button
    type="button"
    :disabled="disabled || isLoading"
    class="relative inline-flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:bg-slate-50 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-750 dark:hover:border-slate-600"
    @click="handleGoogleLogin"
  >
    <!-- Google Ikona -->
    <svg
      v-if="!isLoading"
      class="h-5 w-5 shrink-0"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </svg>

    <!-- Načítací Spinner -->
    <svg
      v-else
      class="h-5 w-5 animate-spin text-slate-500"
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
