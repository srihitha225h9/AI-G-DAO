'use client';

export interface ProposalSimilarity {
  id: number;
  title: string;
  similarity: number;
  reason: string;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;        // Layer 1: title >80% similar — block
  similar: ProposalSimilarity[];
  suggestions: string[];
  locationWarning: {           // Layer 2: same category + city — warn
    exists: boolean;
    proposals: Array<{ id: number; title: string; creator: string }>;
  };
}

// Levenshtein distance for accurate string similarity
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

function titleSimilarity(a: string, b: string): number {
  const s1 = a.toLowerCase().trim();
  const s2 = b.toLowerCase().trim();
  if (s1 === s2) return 100;
  const dist = levenshtein(s1, s2);
  const maxLen = Math.max(s1.length, s2.length);
  return Math.round((1 - dist / maxLen) * 100);
}

// Extract city from location string (first meaningful word/phrase)
function extractCity(location: string): string {
  if (!location) return '';
  // Take first part before comma, lowercase
  return location.split(',')[0].toLowerCase().trim();
}

export async function checkDuplicateProposal(
  title: string,
  description: string,
  existingProposals: Array<{ id: number; title: string; description: string; category?: string; location?: string; creator?: string }>,
  newCategory?: string,
  newLocation?: string
): Promise<DuplicateCheckResult> {
  const similar: ProposalSimilarity[] = [];

  // ── LAYER 1: Title similarity using Levenshtein ──
  for (const existing of existingProposals) {
    const sim = titleSimilarity(title, existing.title);
    if (sim >= 60) {
      similar.push({
        id: existing.id,
        title: existing.title,
        similarity: sim,
        reason: sim === 100 ? 'Exact title match' : `${sim}% title similarity`,
      });
    }
  }
  similar.sort((a, b) => b.similarity - a.similarity);
  const isDuplicate = similar.some(s => s.similarity >= 80);

  // ── LAYER 2: Same category + same city ──
  const locationWarning = { exists: false, proposals: [] as Array<{ id: number; title: string; creator: string }> };
  if (newCategory && newLocation) {
    const newCity = extractCity(newLocation);
    for (const existing of existingProposals) {
      if (!existing.category || !existing.location) continue;
      const sameCategory = existing.category === newCategory;
      const existingCity = extractCity(existing.location)
      const sameCity = newCity.length > 2 && existingCity.length > 2 &&
        (existingCity.includes(newCity) || newCity.includes(existingCity))
      if (sameCategory && sameCity) {
        locationWarning.exists = true;
        locationWarning.proposals.push({
          id: existing.id,
          title: existing.title,
          creator: existing.creator || '',
        });
      }
    }
  }

  return {
    isDuplicate,
    similar,
    locationWarning,
    suggestions: isDuplicate ? [
      'Change the project title to make it more unique',
      'Add specific location or technology details to differentiate',
      'Focus on a different aspect of the climate issue',
    ] : [],
  };
}
