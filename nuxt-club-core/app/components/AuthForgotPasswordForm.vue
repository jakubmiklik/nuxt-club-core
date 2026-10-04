<script setup lang="ts">
import { z } from 'zod'

const props = withDefaults(
  defineProps<{
    title?: string
    subtitle?: string
    loginUrl?: string
    submitText?: string
  }>(),
  {
    title: 'Zapomenuté heslo',
    subtitle: 'Zadejte svůj e-mail a my vám zašleme instrukce pro obnovení hesla',
    loginUrl: '/login',
    submitText: 'Odeslat odkaz pro obnovení'
  }
)

const emit = defineEmits<{
  success: [email: string]
  error: [error: unknown]
}>()

const form = reactive({
  email: ''
})

const isLoading = ref(false)
const isSubmitted = ref(false)
const submittedEmail = ref('')
const errorMessage = ref<string | null>(null)
const fieldErrors = ref<Record<string, string>>({})

const forgotPasswordSchema = z.object({
  email: z
    .string({ required_error: 'E-mail je povinný' })
    .trim()
    .min(1, 'E-mail je povinný')
    .email('Zadejte platnou e-mailovou adresu')
})

async function handleForgotPassword() {
  if (isLoading.value) return

  errorMessage.value = null
  fieldErrors.value = {}

  // Klientská validace přes Zod
  const validation = forgotPasswordSchema.safeParse({ email: form.email })
  if (!validation.success) {
    const flattened = validation.error.flatten()
    if (flattened.fieldErrors.email?.[0]) {
      fieldErrors.value.email = flattened.fieldErrors.email[0]
      errorMessage.value = flattened.fieldErrors.email[0]
    } else {
      errorMessage.value = 'Zadejte prosím platnou e-mailovou adresu.'
    }
    return
  }

  const cleanEmail = validation.data.email
  isLoading.value = true

  try {
    await $fetch('/auth/forgot-password', {
      method: 'POST',
      body: {
        email: cleanEmail
      }
    })

    submittedEmail.value = cleanEmail
    isSubmitted.value = true
    emit('success', cleanEmail)
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

    const message =
      errData?.message ||
      err?.message ||
      'Odeslání žádosti se nezdařilo. Zkuste to prosím znovu.'
    errorMessage.value = message
    emit('error', err)
  } finally {
    isLoading.value = false
  }
}

function handleReset() {
  isSubmitted.value = false
  errorMessage.value = null
  fieldErrors.value = {}
}
</script>

<template>
  <div class="w-full max-w-md mx-auto">
    <div class="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xl shadow-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
      <!-- Stav úspěchu: E-mail byl úspěšně odeslán -->
      <div v-if="isSubmitted" class="text-center">
        <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
          <svg class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
          </svg>
        </div>

        <h2 class="mt-4 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Zkontrolujte svou schránku
        </h2>

        <p class="mt-2.5 text-sm text-slate-600 dark:text-slate-300">
          Pokud je e-mailová adresa <strong class="font-semibold text-slate-900 dark:text-white">{{ submittedEmail }}</strong> registrována v našem systému, odeslali jsme na ni odkaz pro obnovení hesla.
        </p>

        <!-- Informační box s nápovědou pro kontrolu spamu -->
        <div class="mt-5 rounded-xl border border-amber-200/80 bg-amber-50/70 p-3.5 text-left text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
          <div class="flex items-start gap-2.5">
            <svg class="h-4 w-4 shrink-0 text-amber-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p class="font-semibold">Nenašli jste e-mail v doručené poště?</p>
              <p class="mt-0.5 text-amber-800 dark:text-amber-400">
                Zkontrolujte prosím složku se spamem nebo hromadnou poštou. Doručení zprávy může trvat několik minut.
              </p>
            </div>
          </div>
        </div>

        <!-- Akční tlačítka po odeslání -->
        <div class="mt-6 flex flex-col gap-3">
          <button
            type="button"
            class="w-full rounded-xl border border-slate-300 bg-white py-2.5 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700/70"
            @click="handleReset"
          >
            Zadat jiný e-mail
          </button>

          <NuxtLink
            v-if="loginUrl"
            :to="loginUrl"
            class="inline-flex w-full items-center justify-center rounded-xl bg-blue-600 py-2.5 px-4 text-sm font-semibold text-white shadow-md shadow-blue-600/20 transition-all hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
          >
            Zpět na přihlášení
          </NuxtLink>
        </div>
      </div>

      <!-- Formulář pro zadání e-mailu -->
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

        <!-- Vlastní formulář -->
        <form class="space-y-4" @submit.prevent="handleForgotPassword">
          <!-- E-mailové pole -->
          <div>
            <label
              for="forgot-email"
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
                id="forgot-email"
                v-model="form.email"
                type="email"
                required
                autocomplete="email"
                placeholder="jmeno@klub.cz"
                class="block w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-500"
                :class="{ 'border-red-500 focus:border-red-500 focus:ring-red-500/20': fieldErrors.email }"
              />
            </div>
            <p v-if="fieldErrors.email" class="mt-1 text-xs text-red-600 dark:text-red-400">
              {{ fieldErrors.email }}
            </p>
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
            <span>{{ isLoading ? 'Odesílám...' : submitText }}</span>
          </button>
        </form>

        <!-- Odkaz zpět na přihlášení -->
        <p v-if="loginUrl" class="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          Vzpomněli jste si na heslo?
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
