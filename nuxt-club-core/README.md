# nuxt-club-core 🥋⚽

> Znovupoužitelný **Nuxt 4 Layer** poskytující kompletní, modulární a typově bezpečnou autentizační a autorizační (RBAC) infrastrukturu pro sportovní klubové systémy a oddílové aplikace (např. Judo, fotbal, atletika).

---

## 🚀 Hlavní přednosti

- **Nuxt 4 Ready:** Striktní rozdělení do adresářů `app/` a `server/`.
- **Duální autentizace:**
  - Google OAuth 2.0 (one-click přihlášení s profilovým avatarem přes `oauthGoogleEventHandler`).
  - Klasická registrace a přihlášení (e-mail + heslo s `verifyPassword` a `hashPassword` z `nuxt-auth-utils`).
- **Bezpečná šifrovaná Session:** Integrováno s `nuxt-auth-utils` (zašifrované HTTP-only cookies, Web Crypto API).
- **Hybridní RBAC Model:**
  - Globální základní role: `BaseRole = 'admin' | 'user'`.
  - Možnost libovolného rozšíření v aplikaci přes `interface CustomRoles {}` (TypeScript declaration merging).
  - Výsledná role `AppRole = BaseRole | keyof CustomRoles`.
  - Automatický superadmin pass: Uživatel s rolí `'admin'` má automatický přístup bez nutnosti uvádět `'admin'` v každém guardu.
- **Zod validace se striktním výstupem:** `readValidatedBodyStrict` vrací formátované chyby 400 s detaily z `result.error.flatten()`.
- **Databázová nezávislost (Nitro Hooks Pattern):** Layer neobsahuje pevnou vazbu na DB; hostitelská aplikace napojí svou DB (např. **Drizzle ORM**) pomocí Nitro hooků (`auth:find-user-by-email`, `auth:create-user`, `auth:find-or-create-oauth-user`).
- **Hotové UI komponenty v Tailwind CSS:** Přístupné formuláře, loading stavy, přepínání hesel, Google button a uživatelské menu.

---

## 📁 Adresářová struktura

```text
nuxt-club-core/
├── app/
│   ├── components/
│   │   ├── AuthLoginForm.vue          # Formulář e-mail + heslo s Google OAuth tlačítkem
│   │   ├── AuthRegisterForm.vue       # Registrace (jméno, e-mail, heslo, GDPR souhlas)
│   │   ├── AuthProfileForm.vue        # Editace profilu (jméno, avatar) s živým náhledem
│   │   ├── AuthChangePasswordForm.vue # Změna hesla s indikátorem síly hesla
│   │   ├── AuthForgotPasswordForm.vue # Žádost o obnovu hesla (e-mail + nápověda ke schránce)
│   │   ├── AuthResetPasswordForm.vue  # Formulář pro nastavení nového hesla s validací tokenu
│   │   ├── AuthLoginButton.vue        # Samostatné Google OAuth tlačítko
│   │   ├── AuthUserMenu.vue           # Uživatelský profil (avatar, badge role, odhlášení)
│   │   ├── AuthMemberSwitcher.vue     # Přepínač aktivního členského/sportovního profilu v session
│   │   └── CanRole.vue                # Deklarativní RBAC komponenta pro zobrazení obsahu dle rolí
│   ├── composables/
│   │   └── useClubAuth.ts             # Klíčová composable pro auth, RBAC a správu profilů
│   └── middleware/
│       ├── auth.ts                    # Klientský guard (přesměrování nepřihlášených na /login)
│       └── role.ts                    # Guard kontrolující meta.roles v definePageMeta
├── server/
│   ├── routes/
│   │   └── auth/
│   │       ├── google.get.ts          # Google OAuth callback handler
│   │       ├── login.post.ts          # API: Přihlášení přes e-mail a heslo
│   │       ├── register.post.ts       # API: Registrace uživatele
│   │       ├── profile.put.ts         # API: Aktualizace profilu uživatele (jméno, avatar)
│   │       ├── change-password.post.ts# API: Změna hesla přihlášeného uživatele
│   │       ├── logout.post.ts         # API: Vymazání session (clearUserSession)
│   │       ├── members.get.ts         # API: Získání členských profilů přihlášeného uživatele
│   │       ├── switch-member.post.ts  # API: Přepnutí aktivního člena v relaci
│   │       ├── forgot-password.post.ts# API: Žádost o reset hesla (rate limit + token)
│   │       └── reset-password.post.ts # API: Dokončení resetu hesla
│   └── utils/
│       ├── auth.ts                    # Helpery: requireUser(), requireRole(), DB dispatchery
│       ├── password.ts                # Wrapper pro hashUserPassword() a verifyUserPassword()
│       ├── rateLimit.ts               # Bezpečnostní rate limiting pro citlivé endpointy
│       └── validation.ts              # Helpery: readValidatedBodyStrict(), Zod schémata
├── types/
│   └── auth.d.ts                      # Hybridní RBAC typy, ClubMemberProfile, session a Nitro hooky
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
    // nebo pro lokální vývoj:
    // '../packages/nuxt-club-core'
  ]
})
```

> **Poznámka k privátním repozitářům (Giget):**
> Při stažení přes Giget nastavte environment proměnnou `GIGET_AUTH=<váš_github_token>`.

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

## 🥋 Rozšíření rolí v aplikaci (Hybridní RBAC Model)

Layer definuje základní role `BaseRole = 'admin' | 'user'`. Hostitelská aplikace může přidat vlastní specifické role (např. Trenér, Rodič, Závodník) jednoduše pomocí TypeScript Declaration Merging:

```ts
// app/types/auth.d.ts v hostitelské aplikaci
declare module 'nuxt-club-core/types/auth' {
  interface CustomRoles {
    coach: true
    member: true
    parent: true
    referee: true
  }
}
```

Následně `AppRole` automaticky obsahuje `'admin' | 'user' | 'coach' | 'member' | 'parent' | 'referee'`.

---

## 🗄️ Napojení na databázi hostitelské aplikace (Drizzle ORM)

Protože schéma databáze leží v konkrétní aplikaci klubu, komunikace probíhá přes standardizované a typované **Nitro Hooks**.

### Příklad: Registrace Nitro pluginu (`server/plugins/auth-adapter.ts`)

```ts
import { eq } from 'drizzle-orm'
import { db } from '../database'
import { users } from '../database/schema'
import type { AppRole } from 'nuxt-club-core/types/auth'

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
        role: user.role as AppRole,
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
        role: payload.role || 'user',
        createdAt: new Date()
      })
      .returning()

    result.user = {
      id: created.id,
      email: created.email,
      name: created.name,
      role: created.role as AppRole,
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
          role: 'user',
          createdAt: new Date()
        })
        .returning()
      user = newUser
    }

    result.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as AppRole,
      avatar: user.avatar || undefined
    }
  })
})
```

---

## 🛡️ Ochrana stránek a Role-Based Access Control (RBAC)

### 1. Klientská ochrana stránek (`app/middleware/`)

Layer poskytuje dva klientské middleware:

- `auth`: Pouze pro přihlášené uživatele (nepřihlášené přesměruje na `/login` s parametrem `?redirect=...`).
- `role`: Zkontroluje, zda má přihlášený uživatel roli definovanou v `roles: [...]`. **Uživatel s rolí `'admin'` má přístup povolen vždy automaticky.**

```vue
<!-- app/pages/admin/dashboard.vue -->
<script setup lang="ts">
definePageMeta({
  middleware: ['auth', 'role'],
  roles: ['admin', 'coach'],
  unauthorizedRedirect: '/dashboard'
})
</script>
```

### 2. Ochrana serverových Nitro endpointů (`server/routes/...`)

```ts
// server/api/club/members.get.ts
export default defineEventHandler(async (event) => {
  // Ověří, že uživatel je přihlášen a má roli 'coach' (nebo 'admin', který projde automaticky)
  const user = await requireRole(event, ['coach'])

  return {
    success: true,
    data: []
  }
})
```

---

## 🎨 Frontendové komponenty

Všechny komponenty jsou automaticky importovány do vaší aplikace:

- `<AuthLoginForm />`: Formulář e-mail + heslo s přepínáním viditelnosti, chybovými stavy, odkazem na zapomenuté heslo a tlačítky Google a Seznam.cz.
- `<AuthRegisterForm />`: Registrační formulář se jménem, e-mailem, heslem a souhlasem se zpracováním osobních údajů (GDPR).
- `<AuthProfileForm />`: Formulář pro editaci uživatelského profilu (jméno, URL avatara) s živým náhledem fotografie nebo iniciál.
- `<AuthChangePasswordForm />`: Formulář pro změnu hesla přihlášeného uživatele se starým heslem, novým heslem, potvrzením a indikátorem bezpečnosti.
- `<AuthForgotPasswordForm />`: Formulář pro vyžádání odkazu pro obnovu zapomenutého hesla s e-mailovou validací a stavem úspěchu.
- `<AuthResetPasswordForm />`: Formulář pro nastavení nového hesla s validací tokenu a indikátorem síly a shody hesel.
- `<AuthLoginButton />`: Samostatné tlačítko „Přihlásit přes Google“ s SVG logem.
- `<AuthSeznamLoginButton />`: Samostatné tlačítko „Přihlásit přes Seznam.cz“ se signifikantním logem.
- `<AuthUserMenu />`: Dropdown lišta pro hlavičku s avatarem (či iniciálami), jménem, odznakem role a tlačítkem odhlášení.
- `<AuthMemberSwitcher />`: Přepínač aktivního člena / sportovce v hlavičce (ideální např. pro rodiče se dvěma dětmi v klubu). Zobrazuje aktuální profil, odznaky kategorií, evid. čísla, plynulé přepínání relace a indikátor probíhajícího přepnutí.
- `<AuthSeasonSwitcher />`: Přepínač aktivní sezóny a pobočky klubu s přímým propisováním do šifrované relace.
- `<AuthEmailVerificationBanner />`: Upozorňující banner s tlačítkem na opětovné odeslání ověřovacího e-mailu pro neověřené uživatele.
- `<AdminUserManagementTable />`: Kompletní administrační tabulka se stránkováním, full-text hledáním, filtry, změnou rolí a blokováním/odblokováním účtů.
- `<AdminInviteMemberModal />`: Modální okno pro trenéry a administrátory k odeslání pozvánky novému členovi s předvolenou rolí a kategorií.
- `<AuthAcceptInviteForm />`: Formulář pro registraci pozvaného člena přes bezpečný token.
- `<CanRole :roles="['coach', 'admin']" />`: Deklarativní RBAC komponenta pro zobrazení obsahu na základě rolí s podporou slotů `#default` a `#unauthorized`.

---

## 🛠️ Composable `useClubAuth()`

Composable pro snadnou a typově bezpečnou práci s uživatelskou relací, oprávněními a profily členů:

```vue
<script setup lang="ts">
const {
  user,
  loggedIn,
  isAdmin,
  hasRole,
  members,
  activeMember,
  switchMember,
  logout
} = useClubAuth()

const canEditTraining = computed(() => hasRole(['coach', 'admin']))

async function handleSwitch(memberId: string | number) {
  await switchMember(memberId)
}
</script>
```

---

## 📜 Licence

MIT © [miSys Team](https://github.com/jakubmiklik)
