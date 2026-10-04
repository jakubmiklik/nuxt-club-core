<script setup lang="ts">
import { useClubAuth } from '../composables/useClubAuth'

const props = withDefaults(
  defineProps<{
    message?: string
    buttonText?: string
    allowDismiss?: boolean
  }>(),
  {
    message: 'Váš e-mail dosud nebyl ověřen. Zkontrolujte prosím svoji schránku nebo si nechte poslat nový ověřovací odkaz.',
    buttonText: 'Znovu poslat ověřovací e-mail',
    allowDismiss: true
  }
)

const emit = defineEmits<{
  (e: 'sent'): void
  (e: 'error', error: Error): void
  (e: 'dismiss'): void
}>()

const { user, loggedIn } = useClubAuth()

const isDismissed = ref(false)
const isSending = ref(false)
const feedbackMessage = ref<string | null>(null)
const feedbackType = ref<'success' | 'error'>('success')

const shouldShow = computed(() => {
  return loggedIn.value && user.value && !user.value.emailVerified && !isDismissed.value
})

async function handleResend() {
  if (isSending.value) return

  isSending.value = true
  feedbackMessage.value = null

  try {
    const res = await $fetch<{ success: boolean; message: string }>('/auth/resend-verification', {
      method: 'POST'
    })

    feedbackType.value = 'success'
    feedbackMessage.value = res.message || 'Ověřovací e-mail byl odeslán do vaší schránky.'
    emit('sent')
  } catch (err: any) {
    feedbackType.value = 'error'
    feedbackMessage.value =
      err?.data?.message ||
      err?.message ||
      'Nepodařilo se odeslat ověřovací e-mail. Zkuste to prosím později.'
    emit('error', err)
  } finally {
    isSending.value = false
  }
}

function handleDismiss() {
  isDismissed.value = true
  emit('dismiss')
}
</script>

<template>
  <Transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="transform -translate-y-2 opacity-0"
    enter-to-class="transform translate-y-0 opacity-100"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="transform translate-y-0 opacity-100"
    leave-to-class="transform -translate-y-2 opacity-0"
  >
    <aside
      v-if="shouldShow"
      role="alert"
      class="relative isolate border-b border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/60 dark:text-amber-200"
    >
      <div class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm sm:flex-nowrap">
        <div class="flex items-center gap-3">
          <svg
            class="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.75"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
          <span class="font-medium">
            {{ feedbackMessage ? feedbackMessage : message }}
          </span>
        </div>

        <div class="flex items-center gap-2 sm:shrink-0">
          <button
            v-if="!feedbackMessage || feedbackType === 'error'"
            type="button"
            :disabled="isSending"
            class="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-amber-500 dark:hover:bg-amber-600"
            @click="handleResend"
          >
            <svg
              v-if="isSending"
              class="h-3.5 w-3.5 animate-spin"
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
            <span>{{ isSending ? 'Odesílám...' : buttonText }}</span>
          </button>

          <button
            v-if="allowDismiss"
            type="button"
            class="rounded-lg p-1 text-amber-700 hover:bg-amber-200/50 hover:text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:text-amber-300 dark:hover:bg-amber-900/50 dark:hover:text-amber-100"
            aria-label="Zavřít upozornění"
            @click="handleDismiss"
          >
            <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"
              />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  </Transition>
</template>
