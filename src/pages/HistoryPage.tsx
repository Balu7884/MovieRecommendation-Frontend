import React, { useEffect, useState } from "react";
import type { MovieRecommendation } from "../api/client";
import "../App.css";

const USER_ID_KEY = "movie_ai_user_id";
function getUserId(): string {
  return localStorage.getItem(USER_ID_KEY) || "unknown";
}

export default function HistoryPage() {
  const userId = getUserId();
  const [items, setItems] = useState<MovieRecommendation[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPage(page);
  }, [page]);

  async function loadPage(p: number) {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/history?userExternalId=${userId}&page=${p}&size=12`
      );
      if (!res.ok) throw new Error();
      const data = await res.json();

      setItems(data.content || []);
      setTotalPages(data.totalPages || 1);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page history-page">
      <h2 className="section-title">Your Past Recommendations</h2>

      {loading && <p className="loading">Loading history...</p>}

      {!loading && items.length === 0 && (
        <p className="empty">No history found yet.</p>
      )}

      {!loading && items.length > 0 && (
        <>
          <div className="cards-grid">
            {items.map((m, i) => (
              <div className="card" key={i}>
                <div className="card-body">
                  <div className="card-title">{m.title}</div>
                  <div className="card-sub">
                    {m.year} • {m.genre}
                  </div>
                  {m.rating && (
                    <div className="rating">★ {m.rating.toFixed(1)}</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="pagination">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </button>

            <span>
              Page {page + 1} / {totalPages}
            </span>

            <button
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
