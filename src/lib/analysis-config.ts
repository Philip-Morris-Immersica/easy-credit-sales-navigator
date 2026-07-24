/**
 * Minimum number of consultant (user) replies before an analysis is meaningful.
 * Shared between the client gating (ChatWindow), the server gate (/api/analysis)
 * and the auto-close cleanup (abandonStaleSimulations) so the threshold is
 * defined in exactly one place. Kept dependency-free so client code can import it.
 */
export const MIN_USER_TURNS_FOR_ANALYSIS = 6;
