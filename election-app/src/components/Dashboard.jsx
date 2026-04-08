import {
  computeAggregate,
  countReporting,
  buildMarginMap,
} from '../utils/slateCalculator';
import { COLOR_FAMILIES, COLOR_FORWARD } from '../utils/colorScale';

// Palette aliases — amber for FH Families, teal for FH Forward
const C_FAM = COLOR_FAMILIES; // #b45309 amber-700
const C_FWD = COLOR_FORWARD;  // #0f766e teal-700

function fmt(n) { return n?.toLocaleString() ?? '–'; }

function pctStr(n) {
  if (n === null || n === undefined || isNaN(n)) return '–';
  const val = (n * 100).toFixed(1);
  return n > 0 ? `+${val}%` : `${val}%`;
}

function marginLabel(margin) {
  if (margin === null || margin === undefined || isNaN(margin)) return '–';
  if (Math.abs(margin) < 0.001) return 'Even';
  const abs = Math.abs(margin * 100).toFixed(1);
  return margin > 0 ? `FH Families +${abs}%` : `FH Forward +${abs}%`;
}

function swingLabel(swing) {
  if (swing === null || swing === undefined || isNaN(swing)) return '–';
  if (Math.abs(swing) < 0.001) return 'No change';
  const abs = Math.abs(swing * 100).toFixed(1);
  return swing > 0 ? `+${abs}% → FHFam` : `–${abs}% → FHFwd`;
}

function marginColor(v) {
  return v > 0 ? C_FAM : v < 0 ? C_FWD : '#374151';
}

function avgSwingPerPrecinct(currentMargins, compMargins) {
  const pids = Object.keys(currentMargins).filter(p => compMargins[p] !== undefined);
  if (!pids.length) return null;
  // Divide by 2: margin delta is (famShare−fwdShare) diff, but political reporting
  // swing = change in one party's share, which is half the margin delta.
  return pids.reduce((s, p) => s + (currentMargins[p] - compMargins[p]), 0) / pids.length / 2;
}

export default function Dashboard({
  currentYearData,
  electionData,
  slates,
  onYearChange,
  onCompYearChange,
  onOverlayModeChange,
  compYear,
  displayYear,
  overlayMode,
  show2026Badge,
}) {
  if (!currentYearData || !slates) return null;

  const year = String(currentYearData.year);

  const agg = computeAggregate(currentYearData, slates);
  const reportingCount = currentYearData.live
    ? (currentYearData.reportingCount ?? '?')
    : countReporting(currentYearData);
  const reporting = `${reportingCount} of 38`;

  const aggDenom = (agg?.famTotal ?? 0) + (agg?.fwdTotal ?? 0);
  const familiesPct = aggDenom > 0 ? ((agg.famTotal / aggDenom) * 100).toFixed(1) : null;
  const forwardPct  = aggDenom > 0 ? ((agg.fwdTotal / aggDenom) * 100).toFixed(1) : null;

  const currentMargins = buildMarginMap(currentYearData, slates);

  // Compute swings for the sidebar
  const swings = {};
  for (const y of [2022, 2023, 2024, 2025]) {
    if (String(y) === year || !electionData[y]) continue;
    const compMargins = buildMarginMap(electionData[y], slates);
    const s = avgSwingPerPrecinct(currentMargins, compMargins);
    if (s !== null) swings[y] = s;
  }

  const availableYears = [2022, 2023, 2024, 2025, 2026];
  // 2026 has no historical data in electionData so can't be used as a comparison year
  const compYears = availableYears.filter(y => y !== displayYear && y !== 2026);
  const selectedCompSwing = swings[compYear] ?? null;

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>FHSD School Board Election</h1>
        <p className="race-label">Francis Howell R-III — {currentYearData.election_date}</p>
      </div>

      <div className="summary-bar">
        <div className="summary-row">
          <span className="summary-label families">FH Families</span>
          <span className="summary-value">{familiesPct !== null ? `${familiesPct}%` : '—'}</span>
        </div>
        <div className="summary-row">
          <span className="summary-label forward">FH Forward</span>
          <span className="summary-value">{forwardPct !== null ? `${forwardPct}%` : '—'}</span>
        </div>
        <div className="summary-reporting">{reporting}</div>
      </div>

      {/* Year selector */}
      <div className="control-row">
        <label>Showing year:</label>
        <div className="btn-group">
          {availableYears.map(y => (
            <button
              key={y}
              className={displayYear === y ? 'active' : ''}
              onClick={() => onYearChange(y)}
            >
              {y}{y === 2026 ? ' (Live)' : ''}
              {y === 2026 && show2026Badge && <span className="new-data-badge" />}
            </button>
          ))}
        </div>
      </div>

      {/* Map label overlay toggle */}
      <div className="control-row">
        <label>Map labels:</label>
        <div className="btn-group">
          {[
            { id: 'margin', label: 'Margin' },
            { id: 'swing', label: 'Swing' },
            { id: 'turnout_delta', label: 'Turnout' },
          ].map(({ id, label }) => (
            <button
              key={id}
              className={overlayMode === id ? 'active' : ''}
              onClick={() => onOverlayModeChange(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Swing comparison selector */}
      <div className="control-row">
        <label>Compare swing to:</label>
        <select value={compYear} onChange={e => onCompYearChange(Number(e.target.value))}>
          {compYears.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Summary stats */}
      <div className="stats-grid">
        <Stat label="Total Votes" value={fmt(agg?.totalVotes)} />
        <Stat label="Precincts" value={reporting} />
        <Stat
          label="Overall Margin"
          value={marginLabel(agg?.margin)}
          color={marginColor(agg?.margin)}
        />
        <Stat
          label={`Swing vs ${compYear}`}
          value={swingLabel(selectedCompSwing)}
          color={marginColor(selectedCompSwing)}
        />
      </div>

      {/* Historical swings */}
      <div className="swings-section">
        <div className="swings-title">Swing vs historical</div>
        {[2022, 2023, 2024, 2025]
          .filter(y => String(y) !== year && swings[y] !== undefined)
          .map(y => (
            <div key={y} className="swing-row">
              <span className="swing-year">vs {y}</span>
              <span className="swing-bar-wrap">
                <SwingBar value={swings[y]} />
              </span>
              <span className="swing-val" style={{ color: marginColor(swings[y]) }}>
                {pctStr(swings[y])}
              </span>
            </div>
          ))}
      </div>

      {/* Legend */}
      <div className="legend">
        <div className="legend-title">Color: who won (opacity = margin size)</div>
        <div className="legend-bar">
          <span style={{ color: C_FWD }}>FH Forward</span>
          <div className="gradient-bar" />
          <span style={{ color: C_FAM }}>FH Families</span>
        </div>
        <div className="legend-labels">
          <span>+20%+</span>
          <span>+10%</span>
          <span>Even</span>
          <span>+10%</span>
          <span>+20%+</span>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div className="stat-box">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={color ? { color } : {}}>{value}</div>
    </div>
  );
}

function SwingBar({ value }) {
  const pctVal = Math.min(Math.abs(value) * 100, 20);
  const width = (pctVal / 20) * 50;
  return (
    <div style={{ display: 'flex', alignItems: 'center', width: 110, justifyContent: 'center' }}>
      <div style={{ width: 55, display: 'flex', justifyContent: 'flex-end' }}>
        {value < 0 && (
          <div style={{ width, height: 10, background: C_FWD, borderRadius: '2px 0 0 2px' }} />
        )}
      </div>
      <div style={{ width: 1, height: 14, background: '#d1d5db' }} />
      <div style={{ width: 55, display: 'flex', justifyContent: 'flex-start' }}>
        {value > 0 && (
          <div style={{ width, height: 10, background: C_FAM, borderRadius: '0 2px 2px 0' }} />
        )}
      </div>
    </div>
  );
}
