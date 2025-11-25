// src/App.tsx
import { useEffect, useState } from "react";
import { useCallback, useMemo } from "react";
import "./App.css";

/** Hero image */
const HERO_IMG = "/mnt/data/Screenshot 2025-11-23 004723.png";

/** API base (Vite env or fallback) */
const API_BASE =
  (import.meta as any).env?.VITE_API_BASE ||
  "http://localhost:8080/api";

type MovieRecommendation = {
  id?: number;
  title: string;
  year: string;
  genre: string;
  moodTag?: string;
  posterUrl?: string;
  previewUrl?: string;
  rating?: number;
};

/* ---------------- helpers ---------------- */

const USER_ID_KEY = "movie_ai_user_id_v2";

function getOrCreateUserId(): string {
  let id = localStorage.getItem(USER_ID_KEY);
  if (!id) {
    try {
      id =
        typeof crypto !== "undefined" && typeof (crypto as any).randomUUID === "function"
          ? (crypto as any).randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    } catch {
      id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
    localStorage.setItem(USER_ID_KEY, id!);
  }
  return id!;
}

/* Detect mood using keywords */
function detectMoodFromText(text: string) {
  const t = (text || "").toLowerCase();
  if (!t) return "";
  if (t.match(/\b(happy|joy|fun|excited|exciting|uplift|celebrate)\b/)) return "uplifting";
  if (t.match(/\b(sad|melancholy|cry|depress|tear)\b/)) return "sad";
  if (t.match(/\b(cozy|relax|calm|chill|comfortable)\b/)) return "cozy";
  if (t.match(/\b(scary|horror|terror|creepy)\b/)) return "scary";
  if (t.match(/\b(romance|date|love|lovely)\b/)) return "romantic";
  return "";
}

/* POST wrapper */
async function postRecommendations(payload: {
  userExternalId: string;
  message: string;
  genre?: string;
  yearFrom?: number;
  yearTo?: number;
  mood?: string;
  page?: number;
}): Promise<MovieRecommendation[]> {
  const res = await fetch(`${API_BASE}/recommendations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Failed to fetch recommendations (${res.status}): ${txt}`);
  }

  return (await res.json()) as MovieRecommendation[];
}

/* Extract YouTube video ID */
function extractYouTubeId(url: string | null | undefined): string | null {
  if (!url) return null;

  try {
    const u = new URL(url);

    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1);

    if (u.hostname.includes("youtube")) {
      const v = u.searchParams.get("v");
      if (v) return v;

      const parts = u.pathname.split("/").filter(Boolean);
      return parts[parts.length - 1] || null;
    }
  } catch {
    const match = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11})(?:\b|&|$)/);
    return match ? match[1] : null;
  }

  return null;
}

/* Small UI Components */

function TypingIndicator({ visible = false }: { visible?: boolean }) {
  return (
    <div className={`typing ${visible ? "show" : ""}`} aria-hidden={!visible}>
      <span />
      <span />
      <span />
    </div>
  );
}

function Chip({ children }: { children?: React.ReactNode }) {
  return <span className="chip">{children}</span>;
}

function TrailerModal({
  open,
  videoId,
  title,
  onClose,
  fallbackQuery,
}: {
  open: boolean;
  videoId?: string | null;
  title?: string;
  fallbackQuery?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const embedSrc = videoId
    ? `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`
    : `https://www.youtube.com/results?search_query=${encodeURIComponent(fallbackQuery || title || "trailer")}`;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <button type="button" className="modal-close" onClick={onClose}>
          ×
        </button>

        {videoId ? (
          <iframe
            title={title || "trailer"}
            src={embedSrc}
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div className="modal-fallback">
            <a
              className="btn primary"
              href={embedSrc}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              Open YouTube results for “{fallbackQuery || title}”
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function HoverPreview({ videoId }: { videoId?: string | null }) {
  if (!videoId) return null;

  const src = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&loop=1&rel=0&playlist=${videoId}`;

  return (
    <div className="hover-preview-iframe" aria-hidden>
      <iframe title="preview" src={src} frameBorder={0} />
    </div>
  );
}

/* ---------------- MAIN APP ---------------- */

export default function App() {
  const userId = useMemo(() => getOrCreateUserId(), []);

  const years = useMemo(() => {
    const arr: number[] = [];
    const end = new Date().getFullYear();
    for (let y = end; y >= 1950; y--) arr.push(y);
    return arr;
  }, []);

  /* States */
  const [theme, setTheme] = useState<"dark" | "light">(
    () => (localStorage.getItem("theme") as "dark" | "light") || "dark"
  );

  const [input, setInput] = useState("");
  const [genre, setGenre] = useState("");
  const [mood, setMood] = useState("");
  const [yearFrom, setYearFrom] = useState<number | "">("");
  const [yearTo, setYearTo] = useState<number | "">("");
  const [movies, setMovies] = useState<MovieRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [typing, setTyping] = useState(false);
  const [page, setPage] = useState(1);

  const [favorites, setFavorites] = useState<MovieRecommendation[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("favorites:v1") || "[]");
    } catch {
      return [];
    }
  });

  const [trailerOpen, setTrailerOpen] = useState(false);
  const [trailerVideoId, setTrailerVideoId] = useState<string | null>(null);
  const [trailerTitle, setTrailerTitle] = useState<string | undefined>();

  const canAsk = input.trim().length > 0 || genre || mood || yearFrom || yearTo;

  /* Persist theme */
  useEffect(() => {
    localStorage.setItem("theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  /* Persist favorites */
  useEffect(() => {
    localStorage.setItem("favorites:v1", JSON.stringify(favorites));
  }, [favorites]);

  /* Ask AI */
  const askAI = useCallback(
    async (pageRequested = 1) => {
      if (!canAsk) return;

      setTyping(true);
      setLoading(true);

      setTimeout(() => setTyping(false), 800);

      const message =
        input.trim() ||
        `Find movies: genre=${genre || "any"} mood=${mood || detectMoodFromText(input) || "any"} years=${yearFrom || "any"}-${yearTo || "any"}`;

      try {
        const recs = await postRecommendations({
          userExternalId: userId,
          message,
          genre: genre || undefined,
          mood: mood || undefined,
          yearFrom: typeof yearFrom === "number" ? yearFrom : undefined,
          yearTo: typeof yearTo === "number" ? yearTo : undefined,
          page: pageRequested,
        });

        if (pageRequested === 1) setMovies(recs);
        else setMovies((prev) => [...prev, ...recs]);

        setPage(pageRequested);
      } catch (err: any) {
        console.error("Failed to fetch recommendations", err);
        alert(err?.message ?? "Failed to fetch recommendations");
      } finally {
        setLoading(false);
        setTyping(false);
        setInput("");
      }
    },
    [canAsk, input, genre, mood, yearFrom, yearTo, userId]
  );

  /* Trailer modal */
  function openTrailerForMovie(m: MovieRecommendation) {
    const vid = extractYouTubeId(m.previewUrl || "");
    setTrailerTitle(m.title);
    setTrailerVideoId(vid);
    setTrailerOpen(true);
  }

  function openTrailerSearch(title: string) {
    const q = `${title} trailer`;
    window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`, "_blank");
  }

  function toggleFavorite(m: MovieRecommendation) {
    setFavorites((prev) => {
      const exists = prev.some((x) => x.title === m.title && x.year === m.year);
      if (exists) return prev.filter((x) => !(x.title === m.title && x.year === m.year));
      return [m, ...prev].slice(0, 100);
    });
  }

  /* Theme toggle */
  function toggleTheme() {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }

  /* ---- UI ---- */
  return (
    <div className={`app premium-ui ${theme === "dark" ? "theme-dark" : "theme-light"}`}>
      <header className="header">
        <div className="header-inner">
          <div className="brand">MoodFlix</div>
          <div className="header-actions">
            <button className="btn small" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
              Top
            </button>
            <button className="btn small" onClick={toggleTheme}>
              {theme === "dark" ? "🌙 Dark" : "☀️ Light"}
            </button>
          </div>
        </div>
      </header>

      <section className="hero" style={{ backgroundImage: `url("${HERO_IMG}")` }}>
        <div className="hero-overlay">
          <div className="hero-left">
            <h1 className="hero-title">Find the perfect movie for your mood</h1>
            <p className="hero-sub">AI-powered personalized recommendations with instant trailers.</p>

            <div className="hero-controls">
              <input
                className="control input-large"
                placeholder="Describe what you want..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />

              <select className="control" value={genre} onChange={(e) => setGenre(e.target.value)}>
                <option value="">Any genre</option>
                <option>Action</option>
                <option>Comedy</option>
                <option>Romance</option>
                <option>Horror</option>
                <option>Sci-Fi</option>
                <option>Drama</option>
                <option>Thriller</option>
                <option>Anime</option>
              </select>

              <select className="control" value={mood} onChange={(e) => setMood(e.target.value)}>
                <option value="">Any mood</option>
                <option>cozy</option>
                <option>exciting</option>
                <option>sad</option>
                <option>uplifting</option>
                <option>scary</option>
                <option>nostalgic</option>
                <option>romantic</option>
              </select>

              <select className="control" value={yearFrom} onChange={(e) => setYearFrom(e.target.value ? Number(e.target.value) : "")}>
                <option value="">From</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>

              <select className="control" value={yearTo} onChange={(e) => setYearTo(e.target.value ? Number(e.target.value) : "")}>
                <option value="">To</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>

              <div className="hero-buttons">
                <button className="btn primary big" onClick={() => askAI(1)} disabled={!canAsk || loading}>
                  {loading ? "Thinking..." : "Ask AI"}
                </button>

                <button
                  className="btn secondary big"
                  onClick={() => {
                    setInput("");
                    setGenre("");
                    setMood("");
                    setYearFrom("");
                    setYearTo("");
                  }}
                >
                  Reset
                </button>
              </div>

              <div className="hero-hint">
                <TypingIndicator visible={typing} />
                <span className="hint-text">
                  Tip: You don't need to type — genre & mood dropdowns work too!
                </span>
              </div>
            </div>
          </div>

          <div className="hero-right">
            <div className="favorites-card">
              <h4>Your favorites</h4>
              {favorites.length === 0 ? (
                <div className="fav-empty">No favorites yet</div>
              ) : (
                <ul>
                  {favorites.slice(0, 6).map((f, i) => (
                    <li key={i}>
                      <strong>{f.title}</strong>{" "}
                      <span className="muted">({f.year})</span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="fav-actions">
                <button
                  className="btn tiny"
                  onClick={() => {
                    localStorage.removeItem("favorites:v1");
                    setFavorites([]);
                  }}
                >
                  Clear
                </button>

                <button className="btn tiny" onClick={() => alert("Cloud sync coming soon!")}>
                  Save (cloud)
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---- Recommendations ---- */}
      <main className="content">
        <div className="container">
          <h2 className="section-title">Recommendations</h2>

          {loading && (
            <div className="cards-grid skeleton">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="card card-skel" />
              ))}
            </div>
          )}

          {!loading && movies.length === 0 && (
            <div className="empty big">
              No recommendations yet — try selecting genre/mood and tapping <b>Ask AI</b>.
            </div>
          )}

          {!!movies.length && (
            <div className="cards-grid">
              {movies.map((m, idx) => {
                const ytId = extractYouTubeId(m.previewUrl || "");
                const isFav = favorites.some((f) => f.title === m.title && f.year === m.year);

                return (
                  <article
                    key={`${m.title}-${idx}`}
                    className="card premium-card"
                    onClick={() => openTrailerForMovie(m)}
                    tabIndex={0}
                  >
                    <div className="card-body-no-poster">
                      <div className="card-left">
                        <div className="card-title-large">{m.title}</div>
                        <div className="card-sub muted">
                          {m.year} • {m.genre}
                        </div>
                        <div className="card-meta">
                          {m.moodTag && <Chip>{m.moodTag}</Chip>}
                          {typeof m.rating === "number" && (
                            <span className="rating">★ {m.rating.toFixed(1)}</span>
                          )}
                        </div>
                      </div>

                      <div className="card-right">
                        <div className="card-actions-vertical">
                          <button
                            className="btn tiny"
                            onClick={(e) => {
                              e.stopPropagation();
                              ytId ? openTrailerForMovie(m) : openTrailerSearch(m.title);
                            }}
                          >
                            Play Trailer
                          </button>

                          <button
                            className="btn link"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(
                                `https://www.google.com/search?q=${encodeURIComponent(
                                  m.title + " movie"
                                )}`,
                                "_blank"
                              );
                            }}
                          >
                            Details
                          </button>

                          <button
                            className="btn tiny"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(m);
                            }}
                          >
                            {isFav ? "♥ Saved" : "♡ Save"}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Hover preview */}
                    <div className="hover-area" aria-hidden>
                      <HoverPreview videoId={extractYouTubeId(m.previewUrl || "")} />
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {!!movies.length && (
            <div className="more-actions">
              <button className="btn primary" disabled={loading} onClick={() => askAI(page + 1)}>
                Load more
              </button>
            </div>
          )}
        </div>
      </main>

      <TrailerModal
        open={trailerOpen}
        videoId={trailerVideoId || undefined}
        title={trailerTitle}
        fallbackQuery={trailerTitle}
        onClose={() => setTrailerOpen(false)}
      />

      <footer className="footer premium">
        Built with ❤️ Using Spring Boot • Gemini API • MoodFlix
      </footer>
    </div>
  );
}

