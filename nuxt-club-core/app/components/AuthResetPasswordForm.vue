<script setup lang="ts">
import { z } from 'zod'

const props = withDefaults(
  defineProps<{
    token?: string
    title?: string
    subtitle?: string
    loginUrl?: string
    redirectTo?: string
    submitText?: string
  }>(),
  {
    token: '',
    title: 'Obnova hesla',
    subtitle: 'Zadejte své nové heslo do klubového systému',
    loginUrl: '/login',
    redirectTo: '/login',
    submitText: 'Nastavit nové heslo'
  }
)

const emit = defineEmits<{
  success: []
  error: [error: unknown]
}>()

const route = useRoute()

// Token získáme buď z props, nebo z query parametru ?token=...
const resolvedToken = computed(() => {
  if (props.token) return props.token
  const queryToken = route.query.token
  if (Array.isArray(queryToken)) return queryToken[0] || ''
  return (queryToken as string) || ''
})

const form = reactive({
  password: '',
  passwordConfirm: ''
})

const showPassword = ref(false)
const showPasswordConfirm = ref(false)
const isLoading = ref(false)
const isSuccess = ref(false)
const errorMessage = ref<string | null>(null)
const fieldErrors = ref<Record<string, string>>({})

// Klientská nápověda pro sílu hesla a shodu hesel (konzistentní s AuthRegisterForm.vue)
const passwordRequirements = computed(() => [
  { label: 'Minimálně 8 znaků', met: form.password.length >= 8 },
  { label: 'Alespoň jedno velké písmeno', met: /[A-Z]/.test(form.password) },
  { label: 'Alespoň jedno číslo', met: /[0-9]/.test(form.password) },
  {
    label: 'Hesla se shodují',
    met: !!form.password && form.password === form.passwordConfirm
  }
])

const resetPasswordSchema = z
  .object({
    password: z
      .string({ required_error: 'Heslo je povinné' })
      .min(8, 'Heslo musí mít minimálně 8 znaků')
      .regex(/[A-Z]/, 'Heslo musí obsahovat alespoň jedno velké písmeno')
      .regex(/[0-9]/, 'Heslo musí obsahovat alespoň jedno číslo'),
    passwordConfirm: z
      .string({ required_error: 'Potvrzení hesla je povinné' })
      .min(8, 'Potvrzení hesla musí mít alespoň 8 znaků')
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: 'Zadaná hesla se neshodují',
    path: ['passwordConfirm']
  })

async function handleResetPassword() {
  if (isLoading.value) return

  if (!resolvedToken.value) {
    errorMessage.value = 'Chybí platný bezpečnostní token pro obnovení hesla.'
    return
  }

  errorMessage.value = null
  fieldErrors.value = {}

  // Klientská validace přes Zod
  const validation = resetPasswordSchema.safeParse({
    password: form.password,
    passwordConfirm: form.passwordConfirm
  })

  if (!validation.success) {
    const flattened = validation.error.flatten()
    const map: Record<string, string> = {}
    for (const [field, messages] of Object.entries(flattened.fieldErrors)) {
      if (Array.isArray(messages) && messages.length > 0) {
        map[field] = messages[0] as string
      }
    }
    fieldErrors.value = map
    errorMessage.value =
      flattened.fieldErrors.passwordConfirm?.[0] ||
      flattened.fieldErrors.password?.[0] ||
      flattened.formErrors[0] ||
      'Zkontrolujte prosím zadané údaje.'
    return
  }

  isLoading.value = true

  try {
    await $fetch('/api/auth/reset-password', {
      method: 'POST',
      body: {
        token: resolvedToken.value,
        password: form.password,
        passwordConfirm: form.passwordConfirm
      }
    })

    isSuccess.value = true
    emit('success')
  } catch (err: any) {
    const errData = err?.data
    const flattenedData = errData?.data || errData

    if (flattenedData?.fieldErrors) {
      const map: Record<string, string> = {}
      for (const [field, messages] of Object.entries(flattenedData.fieldErrors)) {
        if (Array.isArray(messages) && messages.length > 0) {
          map[field] = messages[0] as string
        }
      }
      fieldErrors.value = map
    }

    errorMessage.value =
      errData?.message ||
      err?.message ||
      'Obnovení hesla se nezdařilo. Odkaz mohl vypršet nebo již byl použit.'
    emit('error', err)
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="w-full max-w-md mx-auto">
    <div class="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xl shadow-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
      <!-- Stav úspěchu: Heslo bylo úspěšně změněno -->
      <div v-if="isSuccess" class="text-center">
        <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
          <svg class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>

        <h2 class="mt-4 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Heslo bylo změněno
        </h2>

        <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Vaše nové heslo bylo úspěšně nastaveno. Nyní se můžete přihlásit do klubového systému.
        </p>

        <div class="mt-6">
          <NuxtLink
            :to="redirectTo || loginUrl"
            class="inline-flex w-full items-center justify-center rounded-xl bg-blue-600 py-3 px-4 text-sm font-semibold text-white shadow-md shadow-blue-600/20 transition-all hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
          >
            Přejít na přihlášení
          </NuxtLink>
        </div>
      </div>

      <!-- Varování: Chybějící bezpečnostní token -->
      <div v-else-if="!resolvedToken" class="text-center">
        <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
          <svg class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>

        <h2 class="mt-4 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Neplatný odkaz
        </h2>

        <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">
          V odkazu chybí bezpečnostní ověřovací token pro obnovu hesla. Otevřete prosím celý odkaz z e-mailu nebo požádejte o nový.
        </p>

        <div class="mt-6 flex flex-col gap-3">
          <NuxtLink
            to="/forgot-password"
            class="inline-flex w-full items-center justify-center rounded-xl bg-blue-600 py-2.5 px-4 text-sm font-semibold text-white shadow-md shadow-blue-600/20 transition-all hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
          >
            Požádat o nový odkaz
          </NuxtLink>

          <NuxtLink
            v-if="loginUrl"
            :to="loginUrl"
            class="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white py-2.5 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Zpět na přihlášení
          </NuxtLink>
        </div>
      </div>

      <!-- Formulář pro zadání nového hesla -->
      <template v-else>
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

        <!-- Formulář -->
        <form class="space-y-4" @submit.prevent="handleResetPassword">
          <!-- Heslo pole -->
          <div>
            <label
              for="reset-password"
              class="block text-sm font-semibold text-slate-700 dark:text-slate-300"
            >
              Nové heslo
            </label>
            <div class="relative mt-1.5">
              <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
              <input
                id="reset-password"
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
            <p v-if="fieldErrors.password" class="mt-1 text-xs text-red-600 dark:text-red-400">
              {{ fieldErrors.password }}
            </p>
          </div>

          <!-- Potvrzení nového hesla -->
          <div>
            <label
              for="reset-password-confirm"
              class="block text-sm font-semibold text-slate-700 dark:text-slate-300"
            >
              Potvrzení nového hesla
            </label>
            <div class="relative mt-1.5">
              <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <input
                id="reset-password-confirm"
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
                <svg
                  v-if="!showPasswordConfirm"
                  class="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
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
            <p v-if="fieldErrors.passwordConfirm" class="mt-1 text-xs text-red-600 dark:text-red-400">
              {{ fieldErrors.passwordConfirm }}
            </p>
          </div>

          <!-- Ukazatel požadavků na bezpečnost a shodu hesel -->
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
            <span>{{ isLoading ? 'Ukládám heslo...' : submitText }}</span>
          </button>
        </form>

        <!-- Odkaz na přihlášení -->
        <p v-if="loginUrl" class="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          Vzpomněli jste si na své heslo?
          <NuxtLink
            :to="loginUrl"
            class="font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400"
          >
            Přihlaste se
          </NuxtLink>
        </p>
      </template>
    </div>
  </div>
</template>
