import React, { useState, useRef } from "react";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";
const SHIFTS = ["breakfast", "lunch", "dinner"];

const SHIFT_EMOJI = { breakfast: "🌅", lunch: "☀️", dinner: "🌙" };

function pctColor(pct) {
  if (pct >= 75) return "var(--scarlet)";
  if (pct >= 40) return "var(--amber)";
  return "var(--green)";
}

function pctLabel(pct) {
  if (pct >= 75) return "High waste";
  if (pct >= 40) return "Moderate";
  return "Low waste";
}

function pctBadgeClass(pct) {
  if (pct >= 75) return "red";
  if (pct >= 40) return "amber";
  return "green";
}

export default function LoggerPage() {
  const [shift, setShift] = useState("lunch");
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const fileRef = useRef();

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImage(file);
    setPreview(URL.createObjectURL(file));
    setResult(null);
    setError(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    setImage(file);
    setPreview(URL.createObjectURL(file));
    setResult(null);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!image) return;
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("image", image);
      form.append("shift", shift);
      const res = await fetch(`${API}/analyze-photo`, { method: "POST", body: form });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (e) {
      setError(e.message || "Analysis failed. Check backend connection.");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setImage(null);
    setPreview(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="page-wrap">
      {/* Header */}
      <div className="gap-24">
        <div className="page-eyebrow">FSW Tool</div>
        <h1 className="page-title">Log Waste Bin</h1>
        <p className="page-sub">Photograph the bin at each bag change. AI estimates fullness in seconds.</p>
      </div>

      <div className="logger-grid gap-24">
        {/* Left column — controls */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Shift selector */}
          <div className="card gap-16">
            <div className="section-label">Select shift</div>
            <div className="shift-tabs">
              {SHIFTS.map((s) => (
                <button
                  key={s}
                  className={`shift-tab${shift === s ? " active" : ""}`}
                  onClick={() => setShift(s)}
                >
                  {SHIFT_EMOJI[s]} {s}
                </button>
              ))}
            </div>
          </div>

          {/* Upload zone */}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div
              className={`upload-zone${preview ? " filled" : ""}`}
              onClick={() => fileRef.current.click()}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              {preview ? (
                <img src={preview} alt="Bin preview" className="upload-preview" />
              ) : (
                <div className="upload-inner">
                  <div className="upload-icon-wrap">📷</div>
                  <div className="upload-hint">Tap to upload bin photo</div>
                  <div className="upload-sub">JPG or PNG · drag & drop supported</div>
                </div>
              )}
            </div>
            {preview && (
              <div style={{ padding: "10px 14px", borderTop: "1px solid var(--lighter)" }}>
                <button className="btn-ghost" onClick={(e) => { e.stopPropagation(); reset(); }}>
                  Remove photo
                </button>
              </div>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFile}
            style={{ display: "none" }}
          />

          {/* Submit */}
          <button className="btn-primary" onClick={handleSubmit} disabled={!image || loading}>
            {loading ? (
              <><span className="spin" />Analyzing photo…</>
            ) : (
              "Analyze waste bin"
            )}
          </button>

          {error && <div className="error-bar">⚠ {error}</div>}
        </div>

        {/* Right column — result */}
        <div>
          {!result && !loading && (
            <div className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🗑️</div>
              <div style={{ fontSize: 14, color: "var(--muted)", fontWeight: 300 }}>
                Result will appear here after analysis
              </div>
            </div>
          )}

          {result && (
            <div className="result-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div>
                  <div className="section-label">{result.shift} shift · analysis</div>
                  <div className="result-pct" style={{ color: pctColor(result.fullness_percent) }}>
                    {result.fullness_percent}%
                  </div>
                  <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>bin fullness</div>
                </div>
                <span className={`badge ${pctBadgeClass(result.fullness_percent)}`}>
                  {pctLabel(result.fullness_percent)}
                </span>
              </div>

              <div style={{ padding: "14px 16px", background: "var(--lighter)", borderRadius: 8 }}>
                <div className="result-lbs">
                  ~<strong>{result.estimated_lbs} lbs</strong> estimated food waste
                </div>
                <div className="result-meta" style={{ marginTop: 6 }}>
                  Confidence:{" "}
                  <span style={{ textTransform: "capitalize", fontWeight: 500 }}>
                    {result.confidence}
                  </span>
                  {" · "}
                  {new Date(result.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>

              <div className="saved-pill">
                ✓ Saved to dashboard
              </div>

              <div style={{ marginTop: 16 }}>
                <button className="btn-ghost" onClick={reset}>Log another bin</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="site-footer">
        HawkWaste · IIT Commons · Powered by GPT-4o-mini vision
      </div>
    </div>
  );
}