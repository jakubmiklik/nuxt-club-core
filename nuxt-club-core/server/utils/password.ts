/**
 * Helpery pro bezpečné hashování a ověřování hesel využívající vestavěné
 * kryptografické funkce z nuxt-auth-utils (založené na Web Crypto API / Scrypt).
 * Nevyžaduje nativní C++ binárky jako bcrypt.
 */

/**
 * Bezpečně zahashuje plaintext heslo.
 * @param password Čitelné heslo zadané uživatelem
 * @returns Hash hesla s náhodnou solí připravený k uložení do DB
 */
export async function hashUserPassword(password: string): Promise<string> {
  if (!password || typeof password !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Heslo musí být neprázdný řetězec.'
    })
  }

  // hashPassword je auto-importován z nuxt-auth-utils v Nitro kontextu
  return await hashPassword(password)
}

/**
 * Porovná zadané heslo s uloženým hashem v konstantním čase.
 * @param hash Uložený hash z databáze
 * @param password Zadané heslo od uživatele
 * @returns true pokud heslo odpovídá, jinak false
 */
export async function verifyUserPassword(hash: string, password: string): Promise<boolean> {
  if (!hash || !password) {
    return false
  }

  try {
    // verifyPassword je auto-importován z nuxt-auth-utils v Nitro kontextu
    return await verifyPassword(hash, password)
  } catch (error) {
    console.error('[nuxt-club-core] Chyba při ověřování hesla:', error)
    return false
  }
}
