import { useMap } from 'react-leaflet';
import { useEffect, useRef } from 'react';
import L from 'leaflet';

function pct(n, d) {
  if (!d) return '–';
  return (100 * n / d).toFixed(1) + '%';
}

function fmt(n) {
  return n?.toLocaleString() ?? '–';
}

function marginLabel(margin, famLabel = 'FH Families', fwdLabel = 'FH Forward') {
  if (margin === null || margin === undefined) return '–';
  const absPct = Math.abs(margin * 100).toFixed(1);
  const leader = margin > 0 ? famLabel : margin < 0 ? fwdLabel : 'Even';
  return margin === 0 ? 'Even' : `${leader} +${absPct}%`;
}

function swingLabel(swing, compYear) {
  if (swing === null || swing === undefined) return null;
  const absPct = Math.abs(swing * 100).toFixed(1);
  const dir = swing > 0 ? '→ FH Families' : '→ FH Forward';
  return `${absPct}% ${dir} vs ${compYear}`;
}

export default function PrecinctTooltip({ hoverInfo }) {
  const map = useMap();
  const tooltipRef = useRef(null);

  useEffect(() => {
    if (!map) return;
    if (tooltipRef.current) {
      tooltipRef.current.remove();
      tooltipRef.current = null;
    }
    if (!hoverInfo) return;

    const { pid, precinctRow, margin, swing, currentSlate, compYear, latlng } = hoverInfo;
    if (!precinctRow || !latlng) return;

    const toArr = x => Array.isArray(x) ? x : (x?.candidates ?? []);
    const fh_families = toArr(currentSlate?.fh_families);
    const fh_forward = toArr(currentSlate?.fh_forward);
    const independent = toArr(currentSlate?.independent);
    const tv = precinctRow.total_votes;

    const famVotes = fh_families.reduce((s, c) => s + (precinctRow[c] ?? 0), 0);
    const fwdVotes = fh_forward.reduce((s, c) => s + (precinctRow[c] ?? 0), 0);
    const denom = famVotes + fwdVotes;

    const swingStr = swingLabel(swing, compYear);
    const marginStr = marginLabel(margin);

    let candidateRows = '';

    const renderCandidates = (candidates, color) =>
      candidates.map(c => {
        const v = precinctRow[c] ?? 0;
        return `<div style="display:flex;justify-content:space-between;gap:12px;color:${color}">
          <span>${c.replace(/(\w+)\s(\w+)/, '$1 $2')}</span>
          <span><strong>${fmt(v)}</strong> (${pct(v, tv)})</span>
        </div>`;
      }).join('');

    candidateRows += `<div style="font-size:11px;color:#6b7280;margin-bottom:2px">FH Families</div>`;
    candidateRows += renderCandidates(fh_families, '#b91c1c');
    candidateRows += `<div style="font-size:11px;color:#6b7280;margin:4px 0 2px">FH Forward</div>`;
    candidateRows += renderCandidates(fh_forward, '#1d4ed8');

    if (independent?.length) {
      candidateRows += `<div style="font-size:11px;color:#6b7280;margin:4px 0 2px">Independent</div>`;
      candidateRows += renderCandidates(independent, '#6b7280');
    }

    const html = `
      <div style="min-width:220px;font-family:system-ui,sans-serif;font-size:13px">
        <div style="font-weight:700;font-size:14px;margin-bottom:6px;border-bottom:1px solid #e5e7eb;padding-bottom:4px">
          Precinct ${pid}
        </div>
        <div style="margin-bottom:6px">
          <span style="color:#6b7280">Votes cast:</span> <strong>${fmt(tv)}</strong>
          <span style="color:#6b7280;margin-left:8px">Reg:</span> <strong>${fmt(precinctRow.reg_voters) || '–'}</strong>
        </div>
        ${candidateRows}
        <div style="margin-top:8px;border-top:1px solid #e5e7eb;padding-top:6px">
          <div style="font-weight:600">${marginStr}</div>
          ${swingStr ? `<div style="color:#6b7280;font-size:12px;margin-top:2px">Swing: ${swingStr}</div>` : ''}
        </div>
      </div>
    `;

    const tooltip = L.tooltip({
      permanent: false,
      direction: 'auto',
      className: 'precinct-tooltip',
      opacity: 1,
    })
      .setLatLng(latlng)
      .setContent(html)
      .addTo(map);

    tooltipRef.current = tooltip;

    return () => {
      tooltip.remove();
    };
  }, [hoverInfo, map]);

  return null;
}
