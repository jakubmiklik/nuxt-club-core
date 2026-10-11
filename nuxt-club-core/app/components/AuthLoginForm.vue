<script setup lang="ts">
import type { ClubUser } from '../../types/auth'
import { parseClubError } from '../composables/useClubError'

const props = withDefaults(
  defineProps<{
    redirectTo?: string
    showGoogleLogin?: boolean
    showSeznam?: boolean
    title?: string
    subtitle?: string
    registerUrl?: string
    forgotPasswordUrl?: string
    allowRegistration?: boolean
  }>(),
  {
    redirectTo: '/',
    showGoogleLogin: true,
    showSeznam: true,
    title: 'Vítejte zpět',
    subtitle: 'Přihlaste se do klubového informačního systému',
    registerUrl: '/register',
    forgotPasswordUrl: '/forgot-password',
    allowRegistration: undefined
  }
)

const emit = defineEmits<{
  (e: 'success', user: ClubUser): void
  (e: 'error', error: Error): void
}>()

const route = useRoute()
const config = useRuntimeConfig()

const isRegistrationAllowed = computed(() => {
  if (props.allowRegistration !== undefined) {
    return props.allowRegistration
  }
  return config.public?.clubAuth?.allowRegistration ?? false
})

const { fetch: refreshSession } = useUserSession()

const form = reactive({
  email: '',
  password: ''
})

const showPassword = ref(false)
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)

watchEffect(() => {
  const errorParam = route.query.error
  if (errorParam === 'account_not_allowed' || errorParam === 'registration_disabled') {
    errorMessage.value = 'Tento účet nemá oprávnění k přístupu. Registrace nových účtů není v tomto systému povolena.'
  } else if (errorParam === 'google_auth_failed') {
    errorMessage.value = 'Přihlášení přes Google účet se nezdařilo.'
  } else if (errorParam === 'seznam_auth_failed') {
    errorMessage.value = 'Přihlášení přes Seznam účet se nezdařilo.'
  }
})

async function handleLogin() {
  if (isLoading.value) return

  isLoading.value = true
  errorMessage.value = null

  try {
    const response = await $fetch<{ success: boolean; user: ClubUser }>('/api/auth/login', {
      method: 'POST',
      body: {
        email: form.email,
        password: form.password
      }
    })

    // Aktualizujeme stav klientské session v nuxt-auth-utils
    await refreshSession()

    emit('success', response.user)

    // Přesměrujeme uživatele na požadovanou stránku
    await navigateTo(props.redirectTo)
  } catch (err: any) {
    const parsed = parseClubError(err)
    errorMessage.value = parsed.message || 'Přihlášení se nezdařilo. Zkontrolujte prosím své údaje.'
    emit('error', err)
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="w-full max-w-md mx-auto">
    <div class="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xl shadow-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
      <!-- Hlavička formuláře -->
      <div class="mb-6 text-center">
        <h2 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          {{ title }}
        </h2>
        <p v-if="subtitle" class="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
          {{ subtitle }}
        </p>
      </div>

      <!-- Chybová hláška -->
      <div
        v-if="errorMessage"
        role="alert"
        class="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/80 p-3.5 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
      >
        <svg
          class="h-5 w-5 shrink-0 text-red-500 mt-0.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
          />
        </svg>
        <div class="flex-1 font-medium">
          {{ errorMessage }}
        </div>
        <button
          type="button"
          class="text-red-400 hover:text-red-600 dark:hover:text-red-200"
          aria-label="Zavřít upozornění"
          @click="errorMessage = null"
        >
          <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      </div>

      <!-- Vlastní formulář pro E-mail a Heslo -->
      <form class="space-y-4" @submit.prevent="handleLogin">
        <!-- E-mailové pole -->
        <div>
          <label
            for="login-email"
            class="block text-sm font-semibold text-slate-700 dark:text-slate-300"
          >
            Klubový e-mail
          </label>
          <div class="relative mt-1.5">
            <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
              </svg>
            </div>
            <input
              id="login-email"
              v-model="form.email"
              type="email"
              required
              autocomplete="email"
              placeholder="jmeno@klub.cz"
              class="block w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-500"
            />
          </div>
        </div>

        <!-- Heslo pole -->
        <div>
          <div class="flex items-center justify-between">
            <label
              for="login-password"
              class="block text-sm font-semibold text-slate-700 dark:text-slate-300"
            >
              Heslo
            </label>
            <slot name="forgot-password">
              <NuxtLink
                v-if="forgotPasswordUrl"
                :to="forgotPasswordUrl"
                class="text-xs font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400"
              >
                Zapomněli jste heslo?
              </NuxtLink>
            </slot>
          </div>
          <div class="relative mt-1.5">
            <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <input
              id="login-password"
              v-model="form.password"
              :type="showPassword ? 'text' : 'password'"
              required
              autocomplete="current-password"
              placeholder="••••••••"
              class="block w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-500"
            />
            <!-- Tlačítko pro zobrazení/skrytí hesla -->
            <button
              type="button"
              class="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              :aria-label="showPassword ? 'Skrýt heslo' : 'Zobrazit heslo'"
              @click="showPassword = !showPassword"
            >
              <!-- Ikona Oko / Otevřené -->
              <svg
                v-if="!showPassword"
                class="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <!-- Ikona Přeškrtnuté oko -->
              <svg
                v-else
                class="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Submit Tlačítko -->
        <button
          type="submit"
          :disabled="isLoading"
          class="relative flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-blue-600/20 transition-all hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <svg
            v-if="isLoading"
            class="mr-2 h-4 w-4 animate-spin text-white"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span>{{ isLoading ? 'Ověřuji...' : 'Přihlásit se' }}</span>
        </button>
      </form>

      <!-- Oddělovač "Nebo" a Sociální OAuth přihlášení -->
      <template v-if="showGoogleLogin || showSeznam">
        <div class="relative my-6">
          <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t border-slate-200 dark:border-slate-800" />
          </div>
          <div class="relative flex justify-center text-xs uppercase tracking-wider">
            <span class="bg-white px-3 font-medium text-slate-400 dark:bg-slate-900 dark:text-slate-500">
              nebo
            </span>
          </div>
        </div>

        <div class="space-y-3">
          <AuthLoginButton v-if="showGoogleLogin" :redirect-to="redirectTo" />
          <AuthSeznamLoginButton v-if="showSeznam" :redirect-to="redirectTo" />
        </div>
      </template>

      <!-- Odkaz na registraci -->
      <p v-if="registerUrl && isRegistrationAllowed" class="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        Ještě nemáte účet?
        <NuxtLink
          :to="registerUrl"
          class="font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400"
        >
          Zaregistrujte se
        </NuxtLink>
      </p>
    </div>
  </div>
</template>
