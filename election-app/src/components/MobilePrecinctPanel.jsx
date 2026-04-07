import { COLOR_FAMILIES, COLOR_FORWARD } from '../utils/colorScale';

function pct(n, d) { return d ? (100 * n / d).toFixed(1) + '%' : '–'; }
function fmt(n) { return n?.toLocaleString() ?? '–'; }

function marginLabel(margin) {
  if (margin === null || margin === undefined || isNaN(margin)) return '–';
  const absPct = Math.abs(margin * 100).toFixed(1);
  if (Math.abs(margin) < 0.001) return 'Even';
  return margin > 0 ? `FH Families +${absPct}%` : `FH Forward +${absPct}%`;
}

function marginColor(margin) {
  if (!margin) return '#374151';
  return margin > 0 ? COLOR_FAMILIES : COLOR_FORWARD;
}

export default function MobilePrecinctPanel({ pinnedInfo, onClose }) {
  if (!pinnedInfo) return null;

  const { pid, precinctRow, margin, swing, currentSlate, compYear } = pinnedInfo;
  if (!precinctRow) return null;

  const toArr = x => Array.isArray(x) ? x : (x?.candidates ?? []);
  const fh_families = toArr(currentSlate?.fh_families);
  const fh_forward  = toArr(currentSlate?.fh_forward);
  const independent = toArr(currentSlate?.independent);
  const tv = precinctRow.total_votes;

  const swingStr = (swing !== null && swing !== undefined && !isNaN(swing))
    ? `${Math.abs(swing * 100).toFixed(1)}% ${swing > 0 ? '→ FH Families' : '→ FH Forward'} vs ${compYear}`
    : null;

  return (
    <div className="mobile-precinct-panel" role="dialog" aria-label={`Precinct ${pid} results`}>
      <div className="mpp-header">
        <div className="mpp-title">Precinct {pid}</div>
        <button className="mpp-close" onClick={onClose} aria-label="Close">✕</button>
      </div>

      <div className="mpp-meta">
        <span>Votes cast: <strong>{fmt(tv)}</strong></span>
        {precinctRow.reg_voters > 0 && (
          <span>Reg: <strong>{fmt(precinctRow.reg_voters)}</strong></span>
        )}
      </div>

      <div className="mpp-slates">
        <div className="mpp-slate">
          <div className="mpp-slate-label" style={{ color: '#b45309' }}>FH Families</div>
          {fh_families.map(c => (
            <div key={c} className="mpp-row">
              <span className="mpp-name">{c}</span>
              <span className="mpp-votes" style={{ color: COLOR_FAMILIES }}>
                {fmt(precinctRow[c] ?? 0)}&ensp;<span className="mpp-pct">{pct(precinctRow[c] ?? 0, tv)}</span>
              </span>
            </div>
          ))}
        </div>

        <div className="mpp-slate">
          <div className="mpp-slate-label" style={{ color: '#0f766e' }}>FH Forward</div>
          {fh_forward.map(c => (
            <div key={c} className="mpp-row">
              <span className="mpp-name">{c}</span>
              <span className="mpp-votes" style={{ color: COLOR_FORWARD }}>
                {fmt(precinctRow[c] ?? 0)}&ensp;<span className="mpp-pct">{pct(precinctRow[c] ?? 0, tv)}</span>
              </span>
            </div>
          ))}
        </div>

        {independent?.length > 0 && (
          <div className="mpp-slate">
            <div className="mpp-slate-label" style={{ color: '#6b7280' }}>Independent</div>
            {independent.map(c => (
              <div key={c} className="mpp-row">
                <span className="mpp-name">{c}</span>
                <span className="mpp-votes" style={{ color: '#6b7280' }}>
                  {fmt(precinctRow[c] ?? 0)}&ensp;<span className="mpp-pct">{pct(precinctRow[c] ?? 0, tv)}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mpp-footer">
        <span className="mpp-margin" style={{ color: marginColor(margin) }}>
          {marginLabel(margin)}
        </span>
        {swingStr && <span className="mpp-swing">Swing: {swingStr}</span>}
      </div>
    </div>
  );
}
