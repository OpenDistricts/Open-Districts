// ─── STRING MATCHER UTILITY ───────────────────────────────────────────────────
// Provides fuzzy matching capabilities (Levenshtein distance) for 
// resiliently joining 2011 Census GeoJSON names to modern event data names.

/**
 * Calculates the Levenshtein distance between two strings.
 * Lower means closer (0 = identical).
 * 
 * @param {string} a 
 * @param {string} b 
 * @returns {number} Distance
 */
export function levenshtein(a, b) {
    const matrix = [];
    let i, j;

    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    for (i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    for (j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    for (i = 1; i <= b.length; i++) {
        for (j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    Math.min(
                        matrix[i][j - 1] + 1, // insertion
                        matrix[i - 1][j] + 1  // deletion
                    )
                );
            }
        }
    }

    return matrix[b.length][a.length];
}

/**
 * Finds the closest matching string in an array of candidates.
 * 
 * @param {string} target The string to match against
 * @param {string[]} candidates Array of possible matches
 * @param {number} maxDistance The maximum Levenshtein distance allowed
 * @returns {string|null} The best matching string, or null if beyond maxDistance
 */
export function fuzzyMatch(target, candidates, maxDistance = 3) {
    if (!target || !candidates || candidates.length === 0) return null;

    // Normalize target (lowercase, strip special chars/spaces for raw phonetic comparison)
    const normTarget = target.toLowerCase().replace(/[^a-z0-9]/g, '');
    let bestMatch = null;
    let minDistance = Infinity;

    for (const candidate of candidates) {
        if (!candidate) continue;
        const normCandidate = candidate.toLowerCase().replace(/[^a-z0-9]/g, '');

        // Fast paths
        if (normTarget === normCandidate) return candidate;
        if (normTarget.includes(normCandidate) || normCandidate.includes(normTarget)) {
            // Substring matches are often exact equivalents in Indian admin names (e.g. Surat City vs Surat)
            // Give it a distance of 1 to prioritize exact matches over inclusion, but still win over true fuzzy
            if (minDistance > 1) {
                minDistance = 1;
                bestMatch = candidate;
            }
            continue;
        }

        const dist = levenshtein(normTarget, normCandidate);
        // Normalize distance threshold relative to word length (for very short names, require tighter match)
        const effectiveMax = Math.min(maxDistance, Math.max(1, Math.floor(normCandidate.length / 2)));

        if (dist <= effectiveMax && dist < minDistance) {
            minDistance = dist;
            bestMatch = candidate;
        }
    }

    return bestMatch;
}
