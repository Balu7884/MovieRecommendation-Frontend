// src/api/client.ts
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080/api";

export interface MovieRecommendation {
  id?: number;
  title: string;
  year: string;
  genre: string;
  moodTag?: string;
  posterUrl?: string; // not used but kept for completeness
  rating?: number;
}

export interface RecommendationRequest {
  userExternalId: string;
  message: string;
  genre?: string;
  yearFrom?: number;
  yearTo?: number;
  mood?: string;
}

export async function getRecommendations(
  payload: RecommendationRequest
): Promise<MovieRecommendation[]> {
  const res = await fetch(`${API_BASE}/recommendations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    // Try to capture error body if available
    let text = "";
    try {
      text = await res.text();
    } catch {}
    throw new Error(`Failed to fetch recommendations (${res.status}): ${text}`);
  }

  return (await res.json()) as MovieRecommendation[];
}
