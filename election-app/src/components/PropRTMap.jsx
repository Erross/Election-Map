import { useEffect, useRef } from 'react';
import { GeoJSON, MapContainer, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const CENTER = [38.78, -90.68];

// Green → white → red color scale, ±20% cap
const WHITE     = [248, 250, 252];
const YES_COLOR = [ 22, 163,  74]; // #16a34a
const NO_COLOR  = [220,  38,  38]; // #dc2626

function propRTColor(margin) {
  if (margin === null || margin === undefined || isNaN(margin)) return '#e5e7eb';
  const t = Math.min(Math.abs(margin) / 0.20, 1);
  const base = margin > 0 ? YES_COLOR : NO_COLOR;
  const r = Math.round(WHITE[0] + (base[0] - WHITE[0]) * t);
  const g = Math.round(WHITE[1] + (base[1] - WHITE[1]) * t);
  const b = Math.round(WHITE[2] + (base[2] - WHITE[2]) * t);
  return `rgb(${r},${g},${b})`;
}

function getMargin(row) {
  if (!row) return null;
  const yes = row.YES ?? 0;
  const no  = row.NO  ?? 0;
  const denom = yes + no;
  return denom > 0 ? (yes - no) / denom : null;
}

function buildTooltipHtml(feature, propRTData) {
  const pid  = feature.properties.DIST_NUM;
  const name = feature.properties.LONGNAME || `Precinct ${pid}`;
  const row  = propRTData?.precincts?.[pid];

  const header = `<div style="font-weight:700;font-size:13px;margin-bottom:5px;">${name}</div>`;

  if (!row || row.total_votes === 0) {
    return header + `<div style="color:#9ca3af;font-size:11px;">No results yet</div>`;
  }

  const yes   = row.YES ?? 0;
  const no    = row.NO  ?? 0;
  const total = row.total_votes;
  const yesPct = ((yes / total) * 100).toFixed(1);
  const noPct  = ((no  / total) * 100).toFixed(1);
  const margin = getMargin(row);
  const marginPct = margin !== null ? Math.abs(margin * 100).toFixed(1) : null;
  const leader = margin !== null ? (margin > 0 ? 'YES' : 'NO') : null;
  const leaderColor = leader === 'YES' ? '#16a34a' : '#dc2626';

  return header + `
    <div style="display:grid;grid-template-columns:36px 1fr 38px;gap:2px 6px;font-size:12px;align-items:baseline;">
      <span style="color:#16a34a;font-weight:700;">YES</span>
      <span>${yes.toLocaleString()}</span>
      <span style="color:#6b7280;">${yesPct}%</span>
      <span style="color:#dc2626;font-weight:700;">NO</span>
      <span>${no.toLocaleString()}</span>
      <span style="color:#6b7280;">${noPct}%</span>
    </div>
    ${leader ? `<div style="margin-top:5px;font-size:11px;font-weight:700;color:${leaderColor};">${leader}+${marginPct}%</div>` : ''}
    <div style="margin-top:3px;font-size:10px;color:#9ca3af;">${total.toLocaleString()} votes cast</div>
  `;
}

/** Resizes map on container changes — same as ElectionMap */
function MapResizer() {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const obs = new ResizeObserver(() => map.invalidateSize({ animate: false }));
    obs.observe(map.getContainer());
    return () => obs.disconnect();
  }, [map]);
  return null;
}

function PropRTLayer({ geojson, propRTData }) {
  function styleFeature(feature) {
    const pid    = feature.properties.DIST_NUM;
    const row    = propRTData?.precincts?.[pid];
    const margin = getMargin(row);
    return {
      fillColor:   propRTColor(margin),
      fillOpacity: margin !== null ? 0.85 : 0.35,
      color:       '#374151',
      weight:      1,
    };
  }

  function onEachFeature(feature, layer) {
    layer.bindTooltip(
      () => buildTooltipHtml(feature, propRTData),
      { sticky: true, className: 'precinct-tooltip' }
    );

    layer.on({
      mouseover(e) {
        e.target.setStyle({ weight: 2.5, color: '#111827', fillOpacity: 0.95 });
      },
      mouseout(e) {
        e.target.setStyle(styleFeature(feature));
      },
    });
  }

  return (
    <GeoJSON
      key={propRTData?.reportingCount ?? 0}
      data={geojson}
      style={styleFeature}
      onEachFeature={onEachFeature}
    />
  );
}

export default function PropRTMap({
  geojson,
  propRTData,
  autoRefresh,
  onToggleAutoRefresh,
  autoRefreshLabel,
  statusText,
  liveTimestamp,
  sourceUpdated,
}) {
  // County-wide aggregate totals
  let totalYes = 0, totalNo = 0, totalVotes = 0;
  if (propRTData?.precincts) {
    for (const row of Object.values(propRTData.precincts)) {
      totalYes   += row.YES ?? 0;
      totalNo    += row.NO  ?? 0;
      totalVotes += row.total_votes ?? 0;
    }
  }

  const yesPct   = totalVotes > 0 ? ((totalYes  / totalVotes) * 100).toFixed(1) : '—';
  const noPct    = totalVotes > 0 ? ((totalNo   / totalVotes) * 100).toFixed(1) : '—';
  const passing  = totalYes > totalNo;
  const statusLabel = totalVotes > 0
    ? (passing ? '✓ Currently Passing' : '✗ Currently Failing')
    : '—';
  const statusColor = totalVotes > 0
    ? (passing ? '#16a34a' : '#dc2626')
    : '#9ca3af';

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="dashboard">
          <div className="dashboard-header">
            <h1>Proposition RT</h1>
            <p className="race-label">St. Charles County — April 7, 2026</p>
          </div>

          <div className="proprt-question">
            Shall St. Charles County freeze residential property tax liability at 2024 levels for qualifying senior citizens?
          </div>

          <div className="summary-bar">
            <div className="summary-row">
              <span className="summary-label yes">YES</span>
              <span className="summary-value">{totalVotes > 0 ? `${yesPct}%` : '—'}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label no">NO</span>
              <span className="summary-value">{totalVotes > 0 ? `${noPct}%` : '—'}</span>
            </div>
            <div className="summary-reporting">
              {propRTData ? propRTData.reportingCount : 0} of 116 precincts reporting
            </div>
          </div>

          {/* Pass/fail indicator */}
          <div style={{
            padding: '8px 12px',
            borderRadius: 6,
            background: '#f9fafb',
            border: '1px solid #e5e7eb',
            marginBottom: 16,
            fontSize: 13,
            fontWeight: 700,
            color: statusColor,
          }}>
            {statusLabel}
          </div>

          {/* Color legend */}
          <div className="legend">
            <div className="legend-title">Map key</div>
            <div className="legend-bar">
              <span style={{ color: '#dc2626', fontWeight: 700 }}>NO</span>
              <div style={{
                flex: 1,
                height: 10,
                borderRadius: 3,
                background: 'linear-gradient(to right, #dc2626, #fca5a5, #f8fafc, #86efac, #16a34a)',
                border: '1px solid #e5e7eb',
              }} />
              <span style={{ color: '#16a34a', fontWeight: 700 }}>YES</span>
            </div>
            <div className="legend-labels">
              <span>≥20%</span>
              <span>Even</span>
              <span>≥20%</span>
            </div>
          </div>
        </div>

        {/* Auto-refresh — shared with FHSD view */}
        <div className="live-section">
          <div className="live-header">
            <span className={`live-dot${propRTData ? ' active' : ''}`} />
            Election Night 2026 (Apr 7)
          </div>

          <button
            className={`btn-primary full-width${autoRefresh ? ' btn-active' : ''}`}
            onClick={onToggleAutoRefresh}
          >
            {autoRefreshLabel}
          </button>

          {autoRefresh && (
            <div className="fetch-status waiting">{statusText}</div>
          )}

          {liveTimestamp && (
            <div className="live-timestamp">
              Last updated: {new Date(liveTimestamp).toLocaleTimeString()}
              {sourceUpdated && (
                <div className="source-timestamp">Source: {sourceUpdated}</div>
              )}
            </div>
          )}
        </div>
      </aside>

      <main className="map-wrap">
        <MapContainer
          center={CENTER}
          zoom={10}
          style={{ width: '100%', height: '100%' }}
          zoomControl
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            opacity={0.4}
          />
          <MapResizer />
          {geojson && (
            <PropRTLayer geojson={geojson} propRTData={propRTData} />
          )}
        </MapContainer>

        {(!propRTData || propRTData.reportingCount === 0) && (
          <div className="map-overlay-msg propRT-empty">
            <div className="empty-icon">⏳</div>
            <div className="empty-title">Awaiting Results</div>
            <div className="empty-sub">
              Polls close at 7:00 PM CT on April 7, 2026.
              <br />
              Results will populate automatically as precincts report.
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
