import { useState } from 'react';
import { parseLiveResults } from '../utils/resultParser';

export default function ResultsPaster({ onResults, onClose }) {
  const [text, setText] = useState('');
  const [error, setError] = useState(null);

  function handleParse() {
    const result = parseLiveResults(text);
    if (result?.error) {
      setError(result.error);
    } else {
      setError(null);
      onResults(result);
      onClose();
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Paste Live Results</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <p className="modal-instructions">
          Go to{' '}
          <strong>livevoterturnout.com › St. Charles County, MO</strong>,
          select all text on the page (Ctrl+A), copy (Ctrl+C), then paste below.
        </p>
        <textarea
          className="results-textarea"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Paste results here..."
          rows={12}
        />
        {error && <div className="parse-error">{error}</div>}
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleParse} disabled={!text.trim()}>
            Parse & Update Map
          </button>
        </div>
      </div>
    </div>
  );
}
