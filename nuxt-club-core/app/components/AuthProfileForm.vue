<script setup lang="ts">
import { z } from 'zod'
import type { ClubUser } from '../../types/auth'

const props = withDefaults(
  defineProps<{
    title?: string
    subtitle?: string
    submitText?: string
    showEmail?: boolean
  }>(),
  {
    title: 'Můj profil',
    subtitle: 'Upravte své osobní údaje a profilovou fotografii v klubu.',
    submitText: 'Uložit změny',
    showEmail: true
  }
)

const emit = defineEmits<{
  success: [user: ClubUser]
  error: [error: unknown]
}>()

const { user, fetch: refreshSession } = useUserSession()

const form = reactive({
  name: user.value?.name || '',
  avatar: user.value?.avatar || ''
})

// Synchronizace hodnot při načtení / změně uživatele v session
watch(
  () => user.value,
  (newUser) => {
    if (newUser) {
      form.name = newUser.name || ''
      form.avatar = newUser.avatar || ''
    }
  },
  { immediate: true }
)

const isLoading = ref(false)
const isSuccess = ref(false)
const errorMessage = ref<string | null>(null)
const successMessage = ref<string | null>(null)
const fieldErrors = ref<Record<string, string>>({})
const avatarLoadError = ref(false)

// Resetování chyby načítání obrázku při změně URL
watch(
  () => form.avatar,
  () => {
    avatarLoadError.value = false
  }
)

// Výpočet iniciál z aktuálně zadaného jména pro fallback náhledu
const previewInitials = computed(() => {
  const nameToUse = form.name.trim() || (user.value?.name ?? 'U')
  const parts = nameToUse.split(/\s+/).filter(Boolean)
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }
  return (parts[0] || 'U').slice(0, 2).toUpperCase()
})

// Detekce neuložených změn
const hasChanges = computed(() => {
  const currentName = user.value?.name || ''
  const currentAvatar = user.value?.avatar || ''
  return form.name !== currentName || form.avatar !== currentAvatar
})

const profileSchema = z.object({
  name: z
    .string({ required_error: 'Jméno je povinné' })
    .trim()
    .min(2, 'Jméno musí mít alespoň 2 znaky')
    .max(100, 'Jméno je příliš dlouhé'),
  avatar: z
    .string()
    .url('Avatar musí být platná URL adresa')
    .optional()
    .or(z.literal(''))
})

function handleReset() {
  form.name = user.value?.name || ''
  form.avatar = user.value?.avatar || ''
  errorMessage.value = null
  successMessage.value = null
  fieldErrors.value = {}
  avatarLoadError.value = false
}

async function handleUpdateProfile() {
  if (isLoading.value) return

  errorMessage.value = null
  successMessage.value = null
  fieldErrors.value = {}

  // Klientská validace
  const validation = profileSchema.safeParse({
    name: form.name,
    avatar: form.avatar ? form.avatar.trim() : ''
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
      flattened.fieldErrors.name?.[0] ||
      flattened.fieldErrors.avatar?.[0] ||
      flattened.formErrors[0] ||
      'Zkontrolujte prosím zadané údaje.'
    return
  }

  isLoading.value = true

  try {
    const response = await $fetch<{ success: boolean; user: ClubUser }>('/auth/profile', {
      method: 'PUT',
      body: {
        name: form.name.trim(),
        avatar: form.avatar.trim() || ''
      }
    })

    // Obnovíme klientskou session pro okamžitou synchronizaci v UI
    await refreshSession()

    isSuccess.value = true
    successMessage.value = 'Profil byl úspěšně aktualizován.'

    emit('success', response.user)
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
      flattenedData?.message ||
      errData?.message ||
      err?.message ||
      'Aktualizace profilu se nezdařila. Zkontrolujte prosím zadané údaje.'

    emit('error', err)
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="w-full max-w-lg mx-auto">
    <div class="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xl shadow-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
      <!-- Hlavička formuláře -->
      <div class="mb-6">
        <h2 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          {{ title }}
        </h2>
        <p v-if="subtitle" class="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
          {{ subtitle }}
        </p>
      </div>

      <!-- Úspěšná hláška -->
      <div
        v-if="successMessage"
        role="alert"
        class="mb-6 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
      >
        <svg
          class="h-5 w-5 shrink-0 text-emerald-500 mt-0.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div class="flex-1 font-medium">
          {{ successMessage }}
        </div>
        <button
          type="button"
          class="text-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-200"
          aria-label="Zavřít upozornění"
          @click="successMessage = null"
        >
          <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
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

      <!-- Náhled profilové fotky / iniciál -->
      <div class="mb-6 flex flex-col sm:flex-row items-center gap-5 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
        <div class="relative h-20 w-20 shrink-0 overflow-hidden rounded-full ring-4 ring-white shadow-md dark:ring-slate-700 bg-slate-200 dark:bg-slate-700">
          <img
            v-if="form.avatar && !avatarLoadError"
            :src="form.avatar"
            :alt="form.name || 'Avatar'"
            class="h-full w-full object-cover"
            @error="avatarLoadError = true"
          />
          <div
            v-else
            class="flex h-full w-full items-center justify-center font-bold text-xl text-slate-600 dark:text-slate-300 select-none"
          >
            {{ previewInitials }}
          </div>
        </div>

        <div class="text-center sm:text-left flex-1 min-w-0">
          <div class="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
            {{ form.name || 'Jméno nezadáno' }}
          </div>
          <div v-if="user?.email" class="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
            {{ user.email }}
          </div>
          <div class="mt-2 text-xs text-slate-400 dark:text-slate-500">
            <span v-if="form.avatar && !avatarLoadError" class="text-emerald-600 dark:text-emerald-400 font-medium">
              Fotografie načtena
            </span>
            <span v-else-if="form.avatar && avatarLoadError" class="text-amber-600 dark:text-amber-400 font-medium">
              Obrázek z URL se nepodařilo načíst (zobrazeny iniciály)
            </span>
            <span v-else>
              Zobrazeny iniciály jména
            </span>
          </div>
        </div>
      </div>

      <!-- Formulář pro editaci profilu -->
      <form class="space-y-4" @submit.prevent="handleUpdateProfile">
        <!-- Celé Jméno -->
        <div>
          <label
            for="profile-name"
            class="block text-sm font-semibold text-slate-700 dark:text-slate-300"
          >
            Celé jméno a příjmení
          </label>
          <div class="relative mt-1.5">
            <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <input
              id="profile-name"
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

        <!-- E-mail (Informativní / Read-only) -->
        <div v-if="showEmail && user?.email">
          <label
            for="profile-email"
            class="block text-sm font-semibold text-slate-700 dark:text-slate-300"
          >
            E-mailová adresa (přihlašovací účet)
          </label>
          <div class="relative mt-1.5">
            <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
              </svg>
            </div>
            <input
              id="profile-email"
              :value="user.email"
              type="email"
              disabled
              class="block w-full rounded-xl border border-slate-200 bg-slate-100 py-2.5 pl-10 pr-3 text-sm text-slate-500 cursor-not-allowed dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400"
            />
          </div>
          <p class="mt-1 text-xs text-slate-400 dark:text-slate-500">
            Změnu e-mailové adresy provádí administrátor klubu.
          </p>
        </div>

        <!-- Avatar URL -->
        <div>
          <label
            for="profile-avatar"
            class="block text-sm font-semibold text-slate-700 dark:text-slate-300"
          >
            URL adresa profilové fotky (volitelné)
          </label>
          <div class="relative mt-1.5">
            <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
            </div>
            <input
              id="profile-avatar"
              v-model="form.avatar"
              type="url"
              placeholder="https://example.com/moje-foto.jpg"
              class="block w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-500"
              :class="{ 'border-red-500 focus:border-red-500 focus:ring-red-500/20': fieldErrors.avatar }"
            />
            <button
              v-if="form.avatar"
              type="button"
              class="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              aria-label="Smazat URL avatara"
              @click="form.avatar = ''"
            >
              <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          </div>
          <p v-if="fieldErrors.avatar" class="mt-1 text-xs text-red-600 dark:text-red-400">
            {{ fieldErrors.avatar }}
          </p>
          <p v-else class="mt-1 text-xs text-slate-400 dark:text-slate-500">
            Vložte přímý odkaz na obrázek. Pokud pole necháte prázdné, použijí se iniciály jména.
          </p>
        </div>

        <!-- Akční tlačítka -->
        <div class="flex items-center justify-end gap-3 pt-3">
          <button
            v-if="hasChanges"
            type="button"
            :disabled="isLoading"
            class="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            @click="handleReset"
          >
            Obnovit
          </button>

          <button
            type="submit"
            :disabled="isLoading || (!hasChanges && !isSuccess)"
            class="relative inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-600/20 transition-all hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
            <span>{{ isLoading ? 'Ukládám...' : submitText }}</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
