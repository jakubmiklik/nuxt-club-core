<script setup lang="ts">
import type { AppRole, ClubInvitation } from '../../types/auth'
import { parseClubError } from '../composables/useClubError'

const props = withDefaults(
  defineProps<{
    modelValue?: boolean
    availableRoles?: { value: AppRole; label: string }[]
    availableCategories?: string[]
  }>(),
  {
    modelValue: false,
    availableRoles: () => [
      { value: 'user', label: 'Člen / Uživatel' },
      { value: 'admin', label: 'Administrátor' }
    ],
    availableCategories: () => []
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'invited': [invitation: ClubInvitation]
  'error': [error: unknown]
}>()

const form = reactive({
  email: '',
  role: (props.availableRoles[0]?.value || 'user') as AppRole,
  category: ''
})

const isLoading = ref(false)
const errorMessage = ref<string | null>(null)
const successMessage = ref<string | null>(null)
const fieldErrors = ref<Record<string, string>>({})
const lastInviteUrl = ref<string | null>(null)
const copied = ref(false)

function closeModal() {
  emit('update:modelValue', false)
  // Reset zpráv po zavření
  setTimeout(() => {
    errorMessage.value = null
    successMessage.value = null
    lastInviteUrl.value = null
    fieldErrors.value = {}
  }, 200)
}

async function handleSendInvitation() {
  if (isLoading.value) return

  isLoading.value = true
  errorMessage.value = null
  successMessage.value = null
  lastInviteUrl.value = null
  fieldErrors.value = {}

  try {
    const response = await $fetch<{
      success: boolean
      invitation: ClubInvitation
      inviteUrl: string
      emailSent: boolean
    }>('/api/admin/invitations', {
      method: 'POST',
      body: {
        email: form.email,
        role: form.role,
        category: form.category || undefined
      }
    })

    lastInviteUrl.value = response.inviteUrl
    successMessage.value = response.emailSent
      ? `Pozvánka byla úspěšně odeslána na e-mail ${form.email}.`
      : `Pozvánka byla vytvořena. E-mailový hook není nakonfigurován, zkopírujte prosím odkaz níže.`

    emit('invited', response.invitation)

    // Reset formuláře
    form.email = ''
    form.category = ''
  } catch (err: any) {
    const parsed = parseClubError(err)
    fieldErrors.value = parsed.fieldErrors
    errorMessage.value = parsed.message
    emit('error', err)
  } finally {
    isLoading.value = false
  }
}

async function copyInviteUrl() {
  if (!lastInviteUrl.value) return
  try {
    await navigator.clipboard.writeText(lastInviteUrl.value)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2500)
  } catch (err) {
    console.error('Nepodařilo se zkopírovat odkaz:', err)
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-modal-title"
    >
      <!-- Backdrop -->
      <div
        class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        aria-hidden="true"
        @click="closeModal"
      />

      <!-- Modal Dialog -->
      <div class="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xl dark:border-slate-800 dark:bg-slate-900 z-10 transition-all">
        <!-- Zavírací tlačítko -->
        <button
          type="button"
          class="absolute top-4 right-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          aria-label="Zavřít"
          @click="closeModal"
        >
          <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>

        <div class="mb-5 flex items-center gap-3">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.375 12.375 0 0110.375 21c-2.36 0-4.58-.66-6.375-1.765z" />
            </svg>
          </div>
          <div>
            <h3 id="invite-modal-title" class="text-lg font-bold text-slate-900 dark:text-white">
              Pozvat člena do klubu
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              Odešle pozvánku s předem určenou rolí a vygenerovaným přístupovým odkazem.
            </p>
          </div>
        </div>

        <!-- Úspěšná hláška -->
        <div
          v-if="successMessage"
          class="mb-4 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
        >
          <div class="flex items-start gap-2.5">
            <svg class="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd" />
            </svg>
            <div class="flex-1 text-xs">
              <p class="font-semibold">{{ successMessage }}</p>
              <!-- Odkaz pro ruční zkopírování -->
              <div v-if="lastInviteUrl" class="mt-2.5 flex items-center gap-1.5">
                <input
                  type="text"
                  readonly
                  :value="lastInviteUrl"
                  class="w-full rounded-lg border border-emerald-300 bg-white px-2 py-1 text-xs text-slate-700 dark:border-emerald-800 dark:bg-slate-800 dark:text-slate-200"
                />
                <button
                  type="button"
                  class="shrink-0 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                  @click="copyInviteUrl"
                >
                  {{ copied ? 'Zkopírováno!' : 'Kopírovat' }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Chybová hláška -->
        <div
          v-if="errorMessage"
          role="alert"
          class="mb-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50/80 p-3.5 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
        >
          <svg class="h-4 w-4 shrink-0 text-red-500 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clip-rule="evenodd" />
          </svg>
          <div class="flex-1 font-medium">
            {{ errorMessage }}
          </div>
        </div>

        <!-- Formulář -->
        <form class="space-y-4" @submit.prevent="handleSendInvitation">
          <!-- E-mail -->
          <div>
            <label for="inv-email" class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              E-mailová adresa nového člena
            </label>
            <div class="relative mt-1">
              <input
                id="inv-email"
                v-model="form.email"
                type="email"
                required
                placeholder="clen@domena.cz"
                class="block w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500"
                :class="{ 'border-red-500': fieldErrors.email }"
              />
            </div>
            <p v-if="fieldErrors.email" class="mt-1 text-xs text-red-600 dark:text-red-400">
              {{ fieldErrors.email }}
            </p>
          </div>

          <!-- Role -->
          <div>
            <label for="inv-role" class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Přiřazená role
            </label>
            <select
              id="inv-role"
              v-model="form.role"
              required
              class="mt-1 block w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option
                v-for="r in availableRoles"
                :key="String(r.value)"
                :value="r.value"
              >
                {{ r.label }}
              </option>
            </select>
          </div>

          <!-- Kategorie (volitelné) -->
          <div>
            <label for="inv-category" class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Sportovní kategorie / oddíl (volitelné)
            </label>
            <div class="mt-1">
              <input
                v-if="!availableCategories || availableCategories.length === 0"
                id="inv-category"
                v-model="form.category"
                type="text"
                placeholder="např. U14 - Starší žáci"
                class="block w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500"
              />
              <select
                v-else
                id="inv-category"
                v-model="form.category"
                class="block w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="">-- Bez specifikace --</option>
                <option
                  v-for="cat in availableCategories"
                  :key="cat"
                  :value="cat"
                >
                  {{ cat }}
                </option>
              </select>
            </div>
          </div>

          <!-- Tlačítka -->
          <div class="mt-6 flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              class="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              @click="closeModal"
            >
              Zavřít
            </button>
            <button
              type="submit"
              :disabled="isLoading"
              class="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-600/20 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
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
              <span>{{ isLoading ? 'Odesílám...' : 'Vytvořit a odeslat pozvánku' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>
