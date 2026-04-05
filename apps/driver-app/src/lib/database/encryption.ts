import * as Crypto from 'expo-crypto';

/**
 * Derives a SQLite encryption key from the driver's auth JWT token.
 *
 * ## Key Management Approach
 *
 * - The encryption key is derived by computing SHA-256 of the driver's auth token.
 * - This ties the database encryption to the driver's session: if the token is
 *   revoked or the driver logs out (token deleted from SecureStore), the derived
 *   key can no longer be reproduced, making the data effectively inaccessible.
 * - The raw auth token is NOT stored as the key — only its digest is used, so
 *   the key cannot be reversed to recover the token.
 * - On each app launch, call `deriveEncryptionKey(token)` with the token loaded
 *   from expo-secure-store before opening the database.
 *
 * ## EAS / Native Build Requirement
 *
 * SQLCipher encryption via `expo-sqlite` requires a custom native build.
 * Add the following to your `app.json` plugins array and build with EAS:
 *
 * ```json
 * {
 *   "expo": {
 *     "plugins": [
 *       ["expo-sqlite", { "enableFTS": true, "useSQLCipher": true }]
 *     ]
 *   }
 * }
 * ```
 *
 * Without this flag the `encryptionKey` option in `openDatabaseAsync` is a no-op
 * and data is stored unencrypted. Never ship to production without the EAS build.
 */
export async function deriveEncryptionKey(authToken: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    authToken,
    { encoding: Crypto.CryptoEncoding.HEX },
  );
  return digest;
}

/**
 * Synchronous fallback for environments where expo-crypto is unavailable
 * (e.g. unit tests running in Node). Uses a simple hex encoding of the
 * token bytes — NOT cryptographically safe, test-only.
 */
export function deriveEncryptionKeySync(authToken: string): string {
  return Buffer.from(authToken, 'utf8').toString('hex').slice(0, 64);
}
