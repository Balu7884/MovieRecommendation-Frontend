import { useEffect, useState } from "react";
import "../App.css";

const USER_ID_KEY = "movie_ai_user_id";
function getUserId(): string {
  return localStorage.getItem(USER_ID_KEY) || "unknown";
}

export default function ProfilePage() {
  const userId = getUserId();
  const [name, setName] = useState("Guest");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/user?externalId=${userId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => {
        if (u?.displayName) setName(u.displayName);
      })
      .catch(() => {});
  }, [userId]);

  async function saveProfile() {
    setSaving(true);
    try {
      await fetch("/api/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ externalId: userId, displayName: name }),
      });
      alert("Updated Successfully");
    } catch {
      alert("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page profile-page">
      <h2 className="section-title">Your Profile</h2>

      <div className="profile-card">
        <div className="avatar">{name.charAt(0).toUpperCase()}</div>

        <div className="profile-fields">
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />

          <button className="btn-ask" disabled={saving} onClick={saveProfile}>
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
