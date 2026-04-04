import React, { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import MenuCrossRef from "../components/MenuCrossRef";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

const SHIFT_COLORS = {
  breakfast: "#F59E0B",
  lunch:     "#10B981",
  dinner:    "#6366F1",
};

function pctColor(pct) {
  if (pct >= 75) return "var(--scarlet)";
  if (pct >= 40) return "var(--amber)";
  return "var(--green)";
}

function pctBadgeClass(pct) {
  if (pct >= 75) return "red";
  if (pct >= 40) return "amber";
  return "green";
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#fff", border: "1px solid #eee",
      borderRadius: 8, padding: "10px 14px", fontSize: 12,
      boxShadow: "0 4px 16px rgba(0,0,0,0.08)"
    }}>
      <div style={{ fontWeight: 600, marginBottom: 6, color: "#333" }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color, display: "flex", justifyContent: "space-between", gap: 16 }}>
          <span style={{ textTransform: "capitalize" }}>{p.name}</span>
          <span style={{ fontWeight: 500 }}>{p.value} lbs</span>
        </div>
      ))}
    </div>
  );
};

export default function DashboardPage() {
  const [logs, setLogs]         = useState(null);
  const [rec, setRec]           = useState(null);
  const [loading, setLoading]   = useState(true);
  const [recLoading, setRecLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/logs`)
      .then(r => r.json())
      .then(d => { setLogs(d); setLoading(false); })
      .catch(() => setLoading(false));

    fetch(`${API}/recommendation`)
      .then(r => r.json())
      .then(d => { setRec(d); setRecLoading(false); })
      .catch(() => setRecLoading(false));
  }, []);

  if (loading) return (
    <div className="page-wrap" style={{ textAlign: "center", paddingTop: 80 }}>
      <div style={{ fontSize: 13, color: "var(--muted)" }}>Loading dashboard data…</div>
    </div>
  );

  const summary    = logs?.summary     || {};
  const itemLogs   = logs?.item_logs   || [];
  const photoLogs  = logs?.photo_logs  || [];
  const worstItems = summary.worstItems || [];
  const bestItems  = summary.bestItems  || [];

  // Build chart data from item logs
  const dateMap = {};
  itemLogs.forEach(e => {
    const key = e.date;
    if (!dateMap[key]) dateMap[key] = { date: key.slice(5), breakfast: 0, lunch: 0, dinner: 0 };
    const wasteLbs = parseFloat(((e.portions_left / e.portions_made) * 0.25).toFixed(1)) || 0;
    dateMap[key][e.shift] = Math.round((dateMap[key][e.shift] || 0) + wasteLbs);
  });
  const chartData = Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));

  const recentPhotos = [...photoLogs].reverse().slice(0, 6);

  return (
    <div className="page-wrap">

      {/* Header */}
      <div className="gap-24">
        <div className="page-eyebrow">Manager View</div>
        <h1 className="page-title">HawkWaste Dashboard</h1>
        <p className="page-sub">IIT Commons · Chartwells · Week of Apr 4, 2026</p>
      </div>

      {/* AI Recommendation */}
      <div className="ai-banner gap-20">
        <div className="ai-icon">🤖</div>
        <div style={{ flex: 1 }}>
          <div className="ai-eyebrow">AI Recommendation</div>
          {recLoading ? (
            <div className="ai-text" style={{ color: "#555", fontStyle: "italic" }}>
              Generating weekly insight…
            </div>
          ) : (
            <div className="ai-text">{rec?.tip || "Unable to load recommendation."}</div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="stats-row gap-20">
        <div className="stat-card red">
          <div className="stat-label">Total waste this week</div>
          <div className="stat-num">{summary.totalWasteLbs ?? "—"}</div>
          <div className="stat-unit">pounds</div>
        </div>
        <div className="stat-card amber">
          <div className="stat-label">Avg per shift</div>
          <div className="stat-num">{summary.avgWastePerShift ?? "—"}</div>
          <div className="stat-unit">pounds</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">Bins logged</div>
          <div className="stat-num">{photoLogs.length}</div>
          <div className="stat-unit">this session</div>
        </div>
      </div>

      {/* Chart */}
      <div className="card gap-20">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div className="section-label" style={{ marginBottom: 0 }}>Waste by day & shift</div>
          <div className="legend">
            {Object.entries(SHIFT_COLORS).map(([s, c]) => (
              <div key={s} className="legend-item">
                <div className="legend-dot" style={{ background: c }} />
                <span style={{ textTransform: "capitalize" }}>{s}</span>
              </div>
            ))}
          </div>
        </div>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={chartData} barSize={16} barGap={3} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#aaa" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#aaa" }} unit=" lbs" axisLine={false} tickLine={false} width={48} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
              <Bar dataKey="breakfast" fill={SHIFT_COLORS.breakfast} radius={[3,3,0,0]} />
              <Bar dataKey="lunch"     fill={SHIFT_COLORS.lunch}     radius={[3,3,0,0]} />
              <Bar dataKey="dinner"    fill={SHIFT_COLORS.dinner}    radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--muted)", fontSize: 13 }}>
            No chart data yet — waste logs will appear here
          </div>
        )}
      </div>

      {/* Worst / Best items */}
      <div className="two-col gap-20">
        <div className="card">
          <div className="section-label" style={{ color: "var(--scarlet)" }}>Highest waste items</div>
          {worstItems.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--muted)", paddingTop: 8 }}>No data yet</div>
          ) : worstItems.map((item, i) => (
            <div key={i} className="item-row">
              <div className="item-name">{item.item}</div>
              <span className="badge red">{item.avgWaste}</span>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="section-label" style={{ color: "var(--green)" }}>Lowest waste items</div>
          {bestItems.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--muted)", paddingTop: 8 }}>No data yet</div>
          ) : bestItems.map((item, i) => (
            <div key={i} className="item-row">
              <div className="item-name">{item.item}</div>
              <span className="badge green">{item.avgWaste}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Menu cross-reference */}
      <div className="gap-20">
        <MenuCrossRef />
      </div>

      {/* Recent photo logs */}
      {recentPhotos.length > 0 && (
        <div className="card gap-20">
          <div className="section-label">Recent bin logs</div>
          {recentPhotos.map((log, i) => (
            <div key={i} className="log-row">
              <div>
                <div className="log-shift">{log.shift}</div>
                <div className="log-date">{log.date}</div>
              </div>
              <div className="log-lbs">{log.estimated_lbs} lbs · {log.confidence} confidence</div>
              <div className="log-pct" style={{ color: pctColor(log.fullness_percent) }}>
                {log.fullness_percent}%
              </div>
              <span className={`badge ${pctBadgeClass(log.fullness_percent)}`} style={{ minWidth: 72, textAlign: "center" }}>
                {log.fullness_percent >= 75 ? "High" : log.fullness_percent >= 40 ? "Moderate" : "Low"}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="site-footer">
        HawkWaste · IIT Commons · Chartwells · Built at IIT Hackathon 2026
      </div>
    </div>
  );
}