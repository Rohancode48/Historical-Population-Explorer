import React, { useEffect, useState, useMemo } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend
} from "chart.js";
import "./App.css";
import ChoroplethMap from "./ChoroplethMap";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend
);

function App() {
  // ─── State Hooks ───────────────────────────────────────────────────────────
  const [startYear, setStartYear] = useState(1960);
  const [endYear, setEndYear]     = useState(1965);
  const [view, setView]           = useState("chart");      // "chart" or "map"
  const [countries, setCountries] = useState([]);           // list from /countries
  const [selected, setSelected]   = useState([]);           // array of selected ISO codes
  const [records, setRecords]     = useState([]);           // data from /data
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [summary, setSummary]     = useState("");

  // ─── 1) Fetch /countries on mount ─────────────────────────────────────────
  useEffect(() => {
    fetch("http://127.0.0.1:8000/countries")
      .then(r => r.json())
      .then(data => setCountries(data))
      .catch(err => {
        console.error("Could not load /countries:", err);
      });
  }, []);

  // ─── 2) Fetch /data and /summary whenever filters change ──────────────────
  useEffect(() => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.append("topic", "population");
    params.append("start", startYear);
    params.append("end", endYear);
    selected.forEach(code => params.append("country", code));

    Promise.all([
      // 2a) Fetch the raw data
      fetch(`http://127.0.0.1:8000/data?${params}`)
        .then(r => {
          if (!r.ok) throw new Error(`Data API error: ${r.status}`);
          return r.json();
        }),

      // 2b) Fetch summary (fallback to null if endpoint fails)
      fetch(`http://127.0.0.1:8000/summary?${params}`)
        .then(r => (r.ok ? r.json() : Promise.resolve(null)))
        .catch(() => null)
    ])
      .then(([dataArr, summaryObj]) => {
        setRecords(dataArr);
        setSummary(summaryObj?.summary || "");
      })
      .catch(err => {
        console.error("Fetch error:", err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [startYear, endYear, selected]);

  // ─── 3) Prepare the line-chart data ────────────────────────────────────────
  const lineData = useMemo(() => {
    const aggregate = {};

    // If no specific country is selected, sum up all records per year (world total)
    if (selected.length === 0) {
      records.forEach(r => {
        aggregate[r.Year] = (aggregate[r.Year] || 0) + r.Population;
      });
    } else {
      // If specific countries are selected, sum only those codes per year
      records.forEach(r => {
        if (selected.includes(r["Country Code"])) {
          aggregate[r.Year] = (aggregate[r.Year] || 0) + r.Population;
        }
      });
    }

    const labels = Object.keys(aggregate).sort();
    return {
      labels,
      datasets: [
        {
          label: selected.length > 0 ? "Filtered" : "World Total",
          data: labels.map(y => aggregate[y]),
          borderColor: "#1f3c88",
          backgroundColor: "rgba(31,60,136,0.3)",
          tension: 0.3,
          pointRadius: 4
        }
      ]
    };
  }, [records, selected]);

  // ─── 4) Render UI ─────────────────────────────────────────────────────────
  return (
    <div className="app-grid">
      {/* ─── HEADER ─────────────────────────────────────────────────────────── */}
      <header className="header">
        {/* Top row: logo on left, heading on right */}
        <div className="header-top">
          <img
            src="/logo.png"
            alt="Historical Population Explorer logo"
            className="logo"
          />
          <h1>Historical Population Explorer</h1>
        </div>

        {/* Summary text sits immediately under the top row */}
        {summary && <div className="summary">{summary}</div>}
      </header>

      {/* ─── SIDEBAR CONTROLS ───────────────────────────────────────────────── */}
      <aside className="controls">
        {/* Start Year */}
        <div className="control-group">
          <label>Start Year</label>
          <input
            type="number"
            min="1960"
            max="2020"
            value={startYear}
            onChange={e => setStartYear(Number(e.target.value))}
          />
        </div>

        {/* End Year */}
        <div className="control-group">
          <label>End Year</label>
          <input
            type="number"
            min={startYear}
            max="2020"
            value={endYear}
            onChange={e => setEndYear(Number(e.target.value))}
          />
        </div>

        {/* View Toggle */}
        <div className="control-group">
          <label>View</label>
          <select
            value={view}
            onChange={e => setView(e.target.value)}
          >
            <option value="chart">Chart</option>
            <option value="map">Map</option>
          </select>
        </div>

        {/* Countries multi-select */}
        <div className="control-group">
          <label>Countries</label>
          <select
            multiple
            value={selected}
            onChange={e =>
              setSelected(
                Array.from(e.target.selectedOptions).map(o => o.value)
              )
            }
          >
            {countries.map(c => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </aside>

      {/* ─── MAIN CONTENT ────────────────────────────────────────────────────── */}
      <main className="main">
        {loading && <div className="skeleton" />}
        {error && <div className="error">Error: {error}</div>}

        {/* 4a) Line chart */}
        {!loading && !error && view === "chart" && (
          <Line data={lineData} />
        )}

        {/* 4b) ChoroplethMap */}
        {!loading && !error && view === "map" && (
          <ChoroplethMap records={records} year={endYear} />
        )}
      </main>
    </div>
  );
}

export default App;