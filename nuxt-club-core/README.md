# nuxt-club-core 🥋⚽

> Znovupoužitelný **Nuxt 4 Layer** poskytující kompletní, modulární a typově bezpečnou autentizační a autorizační (RBAC) infrastrukturu pro sportovní klubové systémy a oddílové aplikace (např. Judo, fotbal, atletika).

---

## 🚀 Hlavní přednosti

- **Nuxt 4 Ready:** Navrženo pro moderní Nuxt 4 adresářovou strukturu (`app/` a `server/`).
- **Duální autentizace:**
  - Google OAuth 2.0 (one-click přihlášení s profilovým avatarem).
  - Klasická registrace a přihlášení (e-mail + bezpečné heslo).
- **Bezpečná šifrovaná Session:** Integrováno s `nuxt-auth-utils` (zašifrované HTTP-only cookies, Web Crypto API).
- **Bezpečné hashování hesel:** Využívá vestavěný kryptografický algoritmus (Scrypt) z `nuxt-auth-utils` – žádné nativní C++ kompilace (bcrypt/node-gyp).
- **Role-Based Access Control (RBAC):**
  - Předdefinované role pro sportovní oddíly: `'admin' | 'coach' | 'member' | 'parent'`.
  - Ochrana na serveru (`requireRole`) i na frontendu (`require-role` middleware).
- **Zod validace:** Striktní typová validace všech vstupů se srozumitelnými chybovými hláškami v češtině.
- **Databázová nezávislost (Nitro Hooks Pattern):** Layer není svázán s konkrétní databází ani ORM; hostitelská aplikace jednoduše napojí svou DB (např. **Drizzle ORM**) pomocí přehledných Nitro hooků.
- **Hotové UI komponenty:** Stylováno moderním Tailwind CSS, přístupné formuláře, loading stavy, přepínání zobrazení hesel.

---

## 📁 Adresářová struktura

```text
nuxt-club-core/
├── app/
│   ├── components/
│   │   ├── AuthLoginForm.vue       # Formulář e-mail + heslo s Google OAuth tlačítkem
│   │   ├── AuthRegisterForm.vue    # Registrace (jméno, e-mail, heslo, heslo znovu)
│   │   ├── AuthLoginButton.vue     # Samostatné Google OAuth tlačítko
│   │   └── AuthUserMenu.vue        # Uživatelský profil (avatar, badge role, odhlášení)
│   └── middleware/
│       ├── auth.ts                 # Klientský guard (přesměrování nepřihlášených na /login)
│       └── require-role.ts         # Guard kontrolující meta.role v definePageMeta
├── server/
│   ├── routes/
│   │   └── auth/
│   │       ├── google.get.ts       # Google OAuth callback handler
│   │       ├── login.post.ts       # API: Přihlášení přes e-mail a heslo
│   │       ├── register.post.ts    # API: Registrace uživatele
│   │       └── logout.post.ts      # API: Vymazání session (clearUserSession)
│   └── utils/
│       ├── auth.ts                 # Helpery: requireUser(), requireRole(), DB dispatchery
│       ├── password.ts             # Wrapper pro hashUserPassword() a verifyUserPassword()
│       └── validation.ts           # Helpery: readValidatedBodyStrict(), Zod schémata
├── types/
│   └── auth.d.ts                   # Rozšíření '#auth-utils', role a Nitro hooky
├── .env.example
├── nuxt.config.ts
├── package.json
└── README.md
```

---

## 📦 Instalace a zapojení do hostitelské aplikace

### 1. Připojení layeru v `nuxt.config.ts`

V hostitelské klubové aplikaci (např. `judo-club-app`) přidejte layer do konfigurace:

```ts
// judo-club-app/nuxt.config.ts
export default defineNuxtConfig({
  // Připojení z privátního GitHub repozitáře nebo lokální cesty:
  extends: [
    'github:organisace/nuxt-club-core#main'
    // nebo pro lokální vývoj monorepa:
    // '../packages/nuxt-club-core'
  ]
})
```

### 2. Konfigurace prostředí (`.env`)

Vytvořte soubor `.env` v kořenu vaší hostitelské aplikace:

```env
# Šifrovací klíč session (minimálně 32 libovolných znaků)
# Vygenerujte např.: openssl rand -base64 32
NUXT_SESSION_PASSWORD=super_tajny_kluc_s_minimalnou_dlzkou_32_znakov

# Google OAuth Credentials (z Google Cloud Console)
NUXT_OAUTH_GOOGLE_CLIENT_ID=1234567890-abcdef.apps.googleusercontent.com
NUXT_OAUTH_GOOGLE_CLIENT_SECRET=GOCSPX-SecretKeyHere

# Volitelné přesměrování
NUXT_PUBLIC_AUTH_DEFAULT_REDIRECT=/dashboard
```

---

## 🗄️ Napojení na databázi hostitelské aplikace (Drizzle ORM)

Protože schéma databáze leží v konkrétní aplikaci klubu, komunikace probíhá přes standardizované a typované **Nitro Hooks**.

### Příklad: Schéma v Drizzle (`server/database/schema.ts`)

```ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash'),
  role: text('role', { enum: ['admin', 'coach', 'member', 'parent'] })
    .default('member')
    .notNull(),
  avatar: text('avatar'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
})
```

### Příklad: Registrace Nitro pluginu (`server/plugins/auth-adapter.ts`)

Vytvořte ve své hostitelské aplikaci soubor `server/plugins/auth-adapter.ts`:

```ts
import { eq } from 'drizzle-orm'
import { db } from '../database'
import { users } from '../database/schema'
import type { UserRole } from '#auth-utils'

export default defineNitroPlugin((nitroApp) => {
  // 1. Vyhledání uživatele podle e-mailu (pro přihlášení nebo kontrolu duplicity)
  nitroApp.hooks.hook('auth:find-user-by-email', async ({ email }, result) => {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase())
    })
    if (user) {
      result.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as UserRole,
        passwordHash: user.passwordHash || undefined,
        avatar: user.avatar || undefined
      }
    }
  })

  // 2. Vytvoření nového uživatele (při registraci)
  nitroApp.hooks.hook('auth:create-user', async (payload, result) => {
    const id = crypto.randomUUID()
    const [created] = await db
      .insert(users)
      .values({
        id,
        email: payload.email.toLowerCase(),
        name: payload.name,
        passwordHash: payload.passwordHash,
        role: payload.role || 'member',
        createdAt: new Date()
      })
      .returning()

    result.user = {
      id: created.id,
      email: created.email,
      name: created.name,
      role: created.role as UserRole,
      avatar: created.avatar || undefined
    }
  })

  // 3. Vyhledání nebo vytvoření uživatele přes Google OAuth
  nitroApp.hooks.hook('auth:find-or-create-oauth-user', async (payload, result) => {
    let user = await db.query.users.findFirst({
      where: eq(users.email, payload.email.toLowerCase())
    })

    if (!user) {
      const id = crypto.randomUUID()
      const [newUser] = await db
        .insert(users)
        .values({
          id,
          email: payload.email.toLowerCase(),
          name: payload.name,
          avatar: payload.avatar,
          role: 'member',
          createdAt: new Date()
        })
        .returning()
      user = newUser
    } else if (payload.avatar && !user.avatar) {
      // Volitelná aktualizace avataru, pokud v DB chybí
      await db
        .update(users)
        .set({ avatar: payload.avatar })
        .where(eq(users.id, user.id))
      user.avatar = payload.avatar
    }

    result.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as UserRole,
      avatar: user.avatar || undefined
    }
  })
})
```

---

## 🛡️ Ochrana stránek a Role-Based Access Control (RBAC)

### 1. Klientská ochrana stránek (Nuxt Middleware)

Layer poskytuje dva připravené klientské guards:

- `auth`: Pouze pro přihlášené uživatele (nepřihlášené přesměruje na `/login`).
- `require-role`: Zkontroluje, zda má přihlášený uživatel roli definovanou v `meta.role` nebo `meta.roles`.

#### Příklad: Sekce pouze pro trenéry a správce (`app/pages/trainings/manage.vue`):

```vue
<script setup lang="ts">
definePageMeta({
  middleware: ['auth', 'require-role'],
  roles: ['admin', 'coach'],
  // Volitelné přesměrování při nedostatečném oprávnění:
  unauthorizedRedirect: '/dashboard'
})
</script>

<template>
  <div>
    <h1>Správa tréninků a docházky (Pouze Trenér a Admin)</h1>
  </div>
</template>
```

---

### 2. Ochrana serverových Nitro endpointů (`server/routes/...`)

Pro zabezpečení vlastních API tras v hostitelské aplikaci použijte serverové utility layeru:

```ts
// server/api/club/trainings.post.ts
export default defineEventHandler(async (event) => {
  // Ověří, že uživatel je přihlášen a má roli 'admin' nebo 'coach'
  const user = await requireRole(event, ['admin', 'coach'])

  // Zde pokračuje bezpečná byznys logika
  return {
    success: true,
    createdBy: user.name
  }
})
```

---

## 🎨 Frontendové komponenty

Všechny komponenty jsou automaticky importovány do vaší aplikace bez nutnosti explicitního importu:

### 1. Přihlašovací stránka (`app/pages/login.vue`)

```vue
<template>
  <div class="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950">
    <AuthLoginForm redirect-to="/dashboard" />
  </div>
</template>
```

### 2. Registrační stránka (`app/pages/register.vue`)

```vue
<template>
  <div class="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950">
    <AuthRegisterForm redirect-to="/dashboard" />
  </div>
</template>
```

### 3. Uživatelské menu v hlavičce (`app/components/AppHeader.vue`)

```vue
<template>
  <header class="flex items-center justify-between px-6 py-4 border-b">
    <div class="font-bold text-xl">Judo Club Praha</div>

    <!-- Uživatelský profilový panel se slotem na vlastní odkazy -->
    <AuthUserMenu redirect-after-logout="/login">
      <template #default="{ user, close }">
        <NuxtLink
          to="/profile"
          class="block px-3 py-2 text-sm rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          @click="close"
        >
          Můj profil
        </NuxtLink>
        <NuxtLink
          v-if="user.role === 'admin' || user.role === 'coach'"
          to="/admin/members"
          class="block px-3 py-2 text-sm rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          @click="close"
        >
          Správa členů
        </NuxtLink>
      </template>
    </AuthUserMenu>
  </header>
</template>
```

---

## 📜 Licence

MIT © [miSys Team](https://github.com/jakubmiklik)
