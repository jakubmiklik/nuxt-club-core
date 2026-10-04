<script setup lang="ts">
import type { AppRole } from '../../types/auth'

const props = defineProps<{
  /**
   * Jedna role nebo pole rolí vyžadovaných pro zobrazení obsahu.
   */
  roles?: AppRole | AppRole[]
  /**
   * Alternativní prop pro zadání jedné role.
   */
  role?: AppRole
}>()

const { hasRole, user, loggedIn, ready } = useClubAuth()

const isAuthorized = computed<boolean>(() => {
  const targetRoles = props.roles ?? props.role
  if (!targetRoles) {
    // Pokud není specifikována žádná role, stačí aby byl uživatel přihlášen
    return loggedIn.value
  }

  return hasRole(targetRoles)
})
</script>

<template>
  <slot
    v-if="isAuthorized"
    :user="user"
    :role="user?.role"
    :logged-in="loggedIn"
    :ready="ready"
  />
  <slot
    v-else
    name="unauthorized"
    :logged-in="loggedIn"
    :ready="ready"
  >
    <slot
      name="fallback"
      :logged-in="loggedIn"
      :ready="ready"
    />
  </slot>
</template>
