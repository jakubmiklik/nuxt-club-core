<script setup lang="ts">
import type { ClubUser, AppRole } from '../../types/auth'
import { parseClubError } from '../composables/useClubError'

const props = withDefaults(
  defineProps<{
    token?: string
    redirectTo?: string
    title?: string
    subtitle?: string
    termsUrl?: string
    privacyUrl?: string
  }>(),
  {
    token: '',
    redirectTo: '/',
    title: 'Přijetí pozvánky do klubu',
    subtitle: 'Dokončete registraci a nastavte si heslo ke svému účtu',
    termsUrl: '/terms',
    privacyUrl: '/privacy'
  }
)

const emit = defineEmits<{
  success: [user: ClubUser]
  error: [error: unknown]
}>()

const route = useRoute()
const { fetch: refreshSession } = useUserSession()

// Token buď z prop nebo z query parametru URL ?token=...
const invitationToken = computed(() => {
  return props.token || (route.query.token as string) || ''
})

const invitationData = ref<{
  email: string
  role: AppRole
  category?: string
  expiresAt: string | Date
} | null>(null)

const isVerifyingToken = ref(true)
const tokenError = ref<string | null>(null)

const form = reactive({
  name: '',
  password: '',
  passwordConfirm: '',
  gdprConsent: false
})

const showPassword = ref(false)
const showPasswordConfirm = ref(false)
const isSubmitting = ref(false)
const errorMessage = ref<string | null>(null)
const fieldErrors = ref<Record<string, string>>({})

// Klientská nápověda pro sílu hesla
const passwordRequirements = computed(() => [
  { label: 'Minimálně 8 znaků', met: form.password.length >= 8 },
  { label: 'Alespoň jedno velké písmeno', met: /[A-Z]/.test(form.password) },
  { label: 'Alespoň jedno číslo', met: /[0-9]/.test(form.password) },
  {
    label: 'Hesla se shodují',
    met: !!form.password && form.password === form.passwordConfirm
  }
])

// Ověření tokenu pozvánky při načtení komponenty
async function verifyToken() {
  if (!invitationToken.value) {
    tokenError.value = 'Chybí token pozvánky. Zkontrolujte prosím odkaz z e-mailu.'
    isVerifyingToken.value = false
    return
  }

  isVerifyingToken.value = true
  tokenError.value = null

  try {
    const data = await $fetch<{
      valid: boolean
      email: string
      role: AppRole
      category?: string
      expiresAt: string | Date
    }>('/api/auth/invite', {
      params: { token: invitationToken.value }
    })

    invitationData.value = data
  } catch (err: any) {
    const parsed = parseClubError(err)
    tokenError.value = parsed.message || 'Pozvánka je neplatná nebo již vypršela.'
  } finally {
    isVerifyingToken.value = false
  }
}

onMounted(() => {
  verifyToken()
})

// Odeslání formuláře pro přijetí pozvánky
async function handleAcceptInvite() {
  if (isSubmitting.value) return

  if (form.password !== form.passwordConfirm) {
    errorMessage.value = 'Zadaná hesla se neshodují.'
    return
  }

  if (!form.gdprConsent) {
    errorMessage.value = 'Musíte souhlasit se zpracováním osobních údajů.'
    fieldErrors.value = { gdprConsent: 'Musíte souhlasit se zpracováním osobních údajů' }
    return
  }

  isSubmitting.value = true
  errorMessage.value = null
  fieldErrors.value = {}

  try {
    const response = await $fetch<{ success: boolean; user: ClubUser }>('/api/auth/accept-invite', {
      method: 'POST',
      body: {
        token: invitationToken.value,
        name: form.name,
        password: form.password,
        passwordConfirm: form.passwordConfirm,
        gdprConsent: form.gdprConsent
      }
    })

    // Aktualizujeme session
    await refreshSession()

    emit('success', response.user)

    await navigateTo(props.redirectTo)
  } catch (err: any) {
    const parsed = parseClubError(err)
    fieldErrors.value = parsed.fieldErrors
    errorMessage.value = parsed.message
    emit('error', err)
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="w-full max-w-md mx-auto">
    <div class="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xl shadow-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
      <!-- Hlavička -->
      <div class="mb-6 text-center">
        <h2 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          {{ title }}
        </h2>
        <p v-if="subtitle" class="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
          {{ subtitle }}
        </p>
      </div>

      <!-- Načítání tokenu -->
      <div v-if="isVerifyingToken" class="py-8 text-center">
        <svg
          class="mx-auto h-8 w-8 animate-spin text-blue-600 dark:text-blue-400"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        <p class="mt-3 text-sm text-slate-500 dark:text-slate-400">
          Ověřuji platnost pozvánky...
        </p>
      </div>

      <!-- Chyba tokenu (neplatný / expirovaný) -->
      <div v-else-if="tokenError" class="py-4 text-center">
        <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400">
          <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h3 class="text-base font-semibold text-slate-900 dark:text-white">
          Neplatná pozvánka
        </h3>
        <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">
          {{ tokenError }}
        </p>
        <div class="mt-6">
          <NuxtLink
            to="/login"
            class="inline-flex items-center justify-center rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Přejít na přihlášení
          </NuxtLink>
        </div>
      </div>

      <!-- Formulář pro přijetí pozvánky -->
      <div v-else-if="invitationData">
        <!-- Informační box o pozvánce -->
        <div class="mb-6 rounded-xl border border-blue-100 bg-blue-50/70 p-4 dark:border-blue-900/40 dark:bg-blue-950/30">
          <div class="flex items-start gap-3">
            <svg class="h-5 w-5 shrink-0 text-blue-600 mt-0.5 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
            <div class="text-xs space-y-1">
              <div>
                <span class="text-slate-500 dark:text-slate-400">Pozvánka pro e-mail:</span>
                <span class="ml-1 font-semibold text-slate-900 dark:text-white">{{ invitationData.email }}</span>
              </div>
              <div>
                <span class="text-slate-500 dark:text-slate-400">Přiřazená role:</span>
                <span class="ml-1 inline-flex items-center rounded-md bg-blue-100 px-2 py-0.5 font-semibold text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                  {{ invitationData.role }}
                </span>
              </div>
              <div v-if="invitationData.category">
                <span class="text-slate-500 dark:text-slate-400">Kategorie:</span>
                <span class="ml-1 font-medium text-slate-800 dark:text-slate-200">{{ invitationData.category }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Chybová hláška -->
        <div
          v-if="errorMessage"
          role="alert"
          class="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/80 p-3.5 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
        >
          <svg class="h-5 w-5 shrink-0 text-red-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
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

        <form class="space-y-4" @submit.prevent="handleAcceptInvite">
          <!-- Jméno a příjmení -->
          <div>
            <label for="invite-name" class="block text-sm font-semibold text-slate-700 dark:text-slate-300">
              Celé jméno a příjmení
            </label>
            <div class="relative mt-1.5">
              <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </div>
              <input
                id="invite-name"
                v-model="form.name"
                type="text"
                required
                placeholder="Jan Novák"
                class="block w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-500"
                :class="{ 'border-red-500 focus:border-red-500 focus:ring-red-500/20': fieldErrors.name }"
              />
            </div>
            <p v-if="fieldErrors.name" class="mt-1 text-xs text-red-600 dark:text-red-400">
              {{ fieldErrors.name }}
            </p>
          </div>

          <!-- Heslo -->
          <div>
            <label for="invite-password" class="block text-sm font-semibold text-slate-700 dark:text-slate-300">
              Zvolte heslo
            </label>
            <div class="relative mt-1.5">
              <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
              <input
                id="invite-password"
                v-model="form.password"
                :type="showPassword ? 'text' : 'password'"
                required
                autocomplete="new-password"
                placeholder="••••••••"
                class="block w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-500"
                :class="{ 'border-red-500 focus:border-red-500 focus:ring-red-500/20': fieldErrors.password }"
              />
              <button
                type="button"
                class="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                :aria-label="showPassword ? 'Skrýt heslo' : 'Zobrazit heslo'"
                @click="showPassword = !showPassword"
              >
                <svg v-if="!showPassword" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <svg v-else class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                </svg>
              </button>
            </div>
            <p v-if="fieldErrors.password" class="mt-1 text-xs text-red-600 dark:text-red-400">
              {{ fieldErrors.password }}
            </p>
          </div>

          <!-- Potvrzení hesla -->
          <div>
            <label for="invite-password-confirm" class="block text-sm font-semibold text-slate-700 dark:text-slate-300">
              Potvrzení hesla znovu
            </label>
            <div class="relative mt-1.5">
              <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <input
                id="invite-password-confirm"
                v-model="form.passwordConfirm"
                :type="showPasswordConfirm ? 'text' : 'password'"
                required
                autocomplete="new-password"
                placeholder="••••••••"
                class="block w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-500"
                :class="{ 'border-red-500 focus:border-red-500 focus:ring-red-500/20': fieldErrors.passwordConfirm }"
              />
              <button
                type="button"
                class="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                :aria-label="showPasswordConfirm ? 'Skrýt heslo' : 'Zobrazit heslo'"
                @click="showPasswordConfirm = !showPasswordConfirm"
              >
                <svg v-if="!showPasswordConfirm" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <svg v-else class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                </svg>
              </button>
            </div>
            <p v-if="fieldErrors.passwordConfirm" class="mt-1 text-xs text-red-600 dark:text-red-400">
              {{ fieldErrors.passwordConfirm }}
            </p>
          </div>

          <!-- Ukazatel požadavků na heslo -->
          <div v-if="form.password" class="rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-800/60">
            <p class="font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Požadavky na bezpečnost:
            </p>
            <ul class="space-y-1">
              <li
                v-for="(req, idx) in passwordRequirements"
                :key="idx"
                class="flex items-center gap-2"
                :class="req.met ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'"
              >
                <svg class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    v-if="req.met"
                    fill-rule="evenodd"
                    d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                    clip-rule="evenodd"
                  />
                  <circle v-else cx="10" cy="10" r="4" />
                </svg>
                <span>{{ req.label }}</span>
              </li>
            </ul>
          </div>

          <!-- GDPR Souhlas -->
          <div>
            <div class="flex items-start gap-3 pt-1">
              <div class="flex h-5 items-center">
                <input
                  id="invite-gdpr"
                  v-model="form.gdprConsent"
                  type="checkbox"
                  required
                  class="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600 focus:ring-offset-0 dark:border-slate-700 dark:bg-slate-800 dark:checked:bg-blue-600"
                  :class="{ 'border-red-500': fieldErrors.gdprConsent }"
                />
              </div>
              <label
                for="invite-gdpr"
                class="text-xs leading-5 text-slate-600 dark:text-slate-300 select-none cursor-pointer"
              >
                Souhlasím se
                <NuxtLink
                  v-if="privacyUrl"
                  :to="privacyUrl"
                  target="_blank"
                  class="font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  zpracováním osobních údajů (GDPR)
                </NuxtLink>
                <span v-else class="font-medium">zpracováním osobních údajů (GDPR)</span>
                a
                <NuxtLink
                  v-if="termsUrl"
                  :to="termsUrl"
                  target="_blank"
                  class="font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  podmínkami klubu
                </NuxtLink>
                <span v-else class="font-medium">podmínkami klubu</span>.
              </label>
            </div>
            <p v-if="fieldErrors.gdprConsent" class="mt-1 text-xs text-red-600 dark:text-red-400">
              {{ fieldErrors.gdprConsent }}
            </p>
          </div>

          <!-- Tlačítko pro odeslání -->
          <button
            type="submit"
            :disabled="isSubmitting"
            class="relative flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-blue-600/20 transition-all hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg
              v-if="isSubmitting"
              class="mr-2 h-4 w-4 animate-spin text-white"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span>{{ isSubmitting ? 'Ukládám a přihlašuji...' : 'Přijmout pozvánku a vstoupit' }}</span>
          </button>
        </form>
      </div>
    </div>
  </div>
</template>
