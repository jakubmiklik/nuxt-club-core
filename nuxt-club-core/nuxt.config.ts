import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'


const currentDir = dirname(fileURLToPath(import.meta.url))

// Nuxt Layer konfigurace pro nuxt-club-core
export default defineNuxtConfig({
  future: {
    compatibilityVersion: 4
  },

  modules: [
    'nuxt-auth-utils',
    '@nuxtjs/tailwindcss',
    '@nuxt/image'
  ],

  // Automatické importy komponent z layeru
  components: [
    {
      path: join(currentDir, 'app/components'),
      pathPrefix: false
    }
  ],

  // Výchozí runtime konfigurace (přepisovatelná v hostitelské aplikaci)
  runtimeConfig: {
    session: {
      // Šifrovací klíč session cookie (minimálně 32 znaků)
      password: process.env.NUXT_SESSION_PASSWORD || ''
    },
    oauth: {
      google: {
        clientId: process.env.NUXT_OAUTH_GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.NUXT_OAUTH_GOOGLE_CLIENT_SECRET || ''
      },
      seznam: {
        clientId: process.env.NUXT_OAUTH_SEZNAM_CLIENT_ID || '',
        clientSecret: process.env.NUXT_OAUTH_SEZNAM_CLIENT_SECRET || ''
      }
    },
    public: {
      clubAuth: {
        loginPath: '/login',
        registerPath: '/register',
        defaultRedirect: '/',
        unauthorizedRedirect: '/unauthorized'
      }
    }
  }
})
