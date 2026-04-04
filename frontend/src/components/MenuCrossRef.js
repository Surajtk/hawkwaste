import React, { useEffect, useState } from "react";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

const TIER_CONFIG = {
  critical: { cls: "red",   label: "Critical", dot: "#CC0000" },
  high:     { cls: "red",   label: "High",     dot: "#CC0000" },
  medium:   { cls: "amber", label: "Medium",   dot: "#B45309" },
  low:      { cls: "green", label: "Low",       dot: "#0D7A55" },
};

const SHIFT_LABELS = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };

function WasteTierBar({ pct }) {
  if (pct == null) return null;
  const color = pct >= 56 ? "var(--scarlet)" : pct >= 36 ? "var(--amber)" : pct >= 16 ? "#6366F1" : "var(--green)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{
        flex: 1, height: 4, background: "var(--lighter)",
        borderRadius: 99, overflow: "hidden",
      }}>
        <div style={{
          height: "100%", width: `${Math.min(pct, 100)}%`,
          background: color, borderRadius: 99,
          transition: "width 0.4s ease",
        }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color, minWidth: 30, textAlign: "right" }}>
        {pct}%
      </span>
    </div>
  );
}

function ItemRow({ item }) {
  const tier = TIER_CONFIG[item.waste_tier] || TIER_CONFIG.medium;
  return (
    <div style={{
      padding: "10px 0",
      borderBottom: "1px solid var(--lighter)",
      display: "grid",
      gridTemplateColumns: "1fr 80px 80px",
      gap: 12,
      alignItems: "center",
    }}>
      <div>
        <div style={{ fontSize: 13, color: "var(--dark)", marginBottom: 3 }}>{item.name}</div>
        <div style={{ fontSize: 11, color: "var(--muted)" }}>{item.station}</div>
        {item.notes && (
          <div style={{ fontSize: 11, color: "#aaa", marginTop: 2, fontStyle: "italic" }}>
            {item.notes}
          </div>
        )}
        <WasteTierBar pct={item.waste_pct} />
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--dark)" }}>
          {item.batch_lbs != null ? `${item.batch_lbs}` : "—"}
        </div>
        <div style={{ fontSize: 10, color: "var(--muted)" }}>lbs cooked</div>
      </div>
      <div style={{ textAlign: "center" }}>
        <span className={`badge ${tier.cls}`}>{tier.label}</span>
      </div>
    </div>
  );
}

export default function MenuCrossRef() {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [activeShift, setShift] = useState("lunch");
  const [showAll, setShowAll]   = useState(false);

  useEffect(() => {
    fetch(`${API}/menu/today`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  if (loading) return (
    <div className="card" style={{ textAlign: "center", padding: "32px 24px" }}>
      <div style={{ fontSize: 13, color: "var(--muted)" }}>Loading today's menu…</div>
    </div>
  );

  if (error || !data) return (
    <div className="card">
      <div className="section-label">Today's Menu</div>
      <div style={{ fontSize: 13, color: "var(--muted)", paddingTop: 8 }}>
        Menu data unavailable — check backend connection.
      </div>
    </div>
  );

  const shiftData  = data.shifts?.[activeShift] || {};
  const items      = shiftData.items || [];
  const atRisk     = data.at_risk_items || [];
  const displayed  = showAll ? items : items.slice(0, 6);

  const criticalCount = items.filter(i => ["critical","high"].includes(i.waste_tier)).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* At-risk callout */}
      {atRisk.length > 0 && (
        <div style={{
          background: "var(--black)",
          borderRadius: "var(--radius)",
          padding: "16px 20px",
          display: "flex", alignItems: "flex-start", gap: 12,
          boxShadow: "var(--shadow-lg)",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", inset: 0,
            background: "radial-gradient(ellipse at 0% 50%, rgba(204,0,0,0.10) 0%, transparent 65%)",
            pointerEvents: "none",
          }} />
          <div style={{
            width: 32, height: 32, background: "var(--scarlet)",
            borderRadius: 6, display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 15, flexShrink: 0,
          }}>⚠️</div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
              textTransform: "uppercase", color: "#CC4444", marginBottom: 5,
            }}>
              {atRisk.length} high-waste item{atRisk.length !== 1 ? "s" : ""} on today's menu
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {atRisk.map((item, i) => (
                <span key={i} style={{
                  background: "rgba(204,0,0,0.15)",
                  color: "#ff6666", fontSize: 12, fontWeight: 500,
                  padding: "3px 9px", borderRadius: 99,
                }}>
                  {item.name} · {item.waste_pct}%
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main card */}
      <div className="card">
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center",
          justifyContent: "space-between", marginBottom: 16,
        }}>
          <div>
            <div className="section-label" style={{ marginBottom: 2 }}>
              Today's Menu vs Waste Scores
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              {data.day}, {data.date}
              {criticalCount > 0 && (
                <span style={{ color: "var(--scarlet)", fontWeight: 600, marginLeft: 8 }}>
                  · {criticalCount} high-risk {activeShift} items
                </span>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {["breakfast","lunch","dinner"].map(s => (
              <button
                key={s}
                onClick={() => { setShift(s); setShowAll(false); }}
                style={{
                  padding: "5px 11px",
                  borderRadius: 6,
                  border: `1.5px solid ${activeShift === s ? "var(--scarlet)" : "var(--lighter)"}`,
                  background: activeShift === s ? "rgba(204,0,0,0.06)" : "var(--white)",
                  color: activeShift === s ? "var(--scarlet)" : "var(--muted)",
                  fontSize: 12, fontWeight: 500,
                  cursor: "pointer", fontFamily: "var(--font-body)",
                  transition: "all 0.15s",
                }}
              >
                {SHIFT_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        {/* Column headers */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 80px 80px",
          gap: 12, padding: "0 0 8px",
          borderBottom: "2px solid var(--lighter)",
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)" }}>
            Item · Station
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", textAlign: "center" }}>
            Batch
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", textAlign: "center" }}>
            Risk
          </div>
        </div>

        {/* Item rows */}
        {items.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--muted)", padding: "20px 0" }}>
            No menu items found for this shift.
          </div>
        ) : (
          <>
            {displayed.map((item, i) => (
              <ItemRow key={i} item={item} />
            ))}
            {items.length > 6 && (
              <button
                onClick={() => setShowAll(!showAll)}
                style={{
                  width: "100%", marginTop: 10, padding: "9px",
                  background: "var(--lighter)", border: "none",
                  borderRadius: "var(--radius-sm)", fontSize: 12,
                  color: "var(--mid)", cursor: "pointer",
                  fontFamily: "var(--font-body)", fontWeight: 500,
                  transition: "background 0.15s",
                }}
                onMouseEnter={e => e.target.style.background = "#e4e4e2"}
                onMouseLeave={e => e.target.style.background = "var(--lighter)"}
              >
                {showAll ? "Show less" : `Show ${items.length - 6} more items`}
              </button>
            )}
          </>
        )}

        {/* Shift summary */}
        {shiftData.total_cooked_lbs != null && (
          <div style={{
            marginTop: 14, padding: "12px 14px",
            background: "var(--lighter)", borderRadius: 8,
            display: "flex", gap: 24,
          }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)" }}>Total cooked</div>
              <div style={{ fontSize: 18, fontFamily: "var(--font-display)", color: "var(--dark)" }}>
                {shiftData.total_cooked_lbs} lbs
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)" }}>Expected waste</div>
              <div style={{ fontSize: 18, fontFamily: "var(--font-display)", color: "var(--scarlet)" }}>
                {shiftData.total_waste_lbs} lbs
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)" }}>Items on menu</div>
              <div style={{ fontSize: 18, fontFamily: "var(--font-display)", color: "var(--dark)" }}>
                {shiftData.item_count}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}