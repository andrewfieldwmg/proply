'use client';

import { FormEvent, useState } from 'react';

import { isAskProplyEnvelope, type AskProplyEnvelope } from '@/lib/ask-proply';

type UiState = 'ready' | 'researching' | 'complete';

const propertyLabels: Record<string, string> = {
  ALL: 'all standard homes',
  D: 'detached homes',
  S: 'semi-detached homes',
  T: 'terraced homes',
  F: 'flats',
};

const statusHeading: Record<string, string> = {
  abstained: 'The evidence is not sufficient',
  outside_scope: 'That request is outside the current scope',
  rate_limited: 'The research service is busy',
  unavailable: 'Research is temporarily unavailable',
};

function formatPrice(value: number | null) {
  return value == null ? 'Not available' : new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function ResearchForm() {
  const [state, setState] = useState<UiState>('ready');
  const [result, setResult] = useState<AskProplyEnvelope | null>(null);
  const [question, setQuestion] = useState('How did sale prices change over this period?');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const area = String(form.get('area') || 'ALL');
    const propertyType = String(form.get('propertyType') || 'ALL');
    const startYear = String(form.get('startYear') || '2020');
    const endYear = String(form.get('endYear') || '2025');
    const scopedQuestion = `${question.trim()} Scope: ${area}; ${propertyLabels[propertyType]}; ${startYear} to ${endYear}.`;

    if (Number(startYear) > Number(endYear)) {
      setResult({
        ok: false,
        status: 'outside_scope',
        data_mode: 'synthetic_preview',
        message: 'Choose a start year that is not later than the end year.',
      });
      setState('complete');
      return;
    }

    if (scopedQuestion.length > 500) {
      setResult({
        ok: false,
        status: 'outside_scope',
        data_mode: 'synthetic_preview',
        message: 'Shorten the question so the complete request is no more than 500 characters.',
      });
      setState('complete');
      return;
    }

    setResult(null);
    setState('researching');
    try {
      const response = await fetch('/api/research', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: scopedQuestion }),
      });
      const payload: unknown = await response.json();
      setResult(isAskProplyEnvelope(payload) ? payload : {
        ok: false,
        status: 'unavailable',
        data_mode: 'synthetic_preview',
        message: 'Research is temporarily unavailable. Please try again later.',
      });
    } catch {
      setResult({
        ok: false,
        status: 'unavailable',
        data_mode: 'synthetic_preview',
        message: 'Research is temporarily unavailable. Please try again later.',
      });
    } finally {
      setState('complete');
    }
  }

  return (
    <div className="ask-layout">
      <section className="panel ask-composer">
        <form onSubmit={submit} aria-busy={state === 'researching'}>
          <label className="ask-label" htmlFor="research-question">Your question</label>
          <textarea
            id="research-question"
            name="question"
            maxLength={500}
            required
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
          />

          <div className="ask-scope-grid">
            <label>Area<select name="area" defaultValue="E10"><option value="ALL">All three areas</option><option value="E10">E10</option><option value="E11">E11</option><option value="E17">E17</option></select></label>
            <label>Property type<select name="propertyType" defaultValue="T"><option value="ALL">All standard homes</option><option value="D">Detached</option><option value="S">Semi-detached</option><option value="T">Terraced</option><option value="F">Flats</option></select></label>
            <label>From<select name="startYear" defaultValue="2020">{Array.from({ length: 32 }, (_, index) => 1995 + index).map((year) => <option key={year}>{year}</option>)}</select></label>
            <label>To<select name="endYear" defaultValue="2025">{Array.from({ length: 32 }, (_, index) => 1995 + index).reverse().map((year) => <option key={year}>{year}</option>)}</select></label>
          </div>

          <div className="ask-actions">
            <p>Supported: aggregate comparisons and trends over approved E10, E11 and E17 data.</p>
            <button type="submit" disabled={state === 'researching'}>{state === 'researching' ? 'Researching…' : 'Research'}</button>
          </div>
        </form>

        <div className="ask-examples" aria-label="Example questions">
          <span>Try an example</span>
          <button type="button" onClick={() => setQuestion('How did sale prices change over this period?')}>Price change</button>
          <button type="button" onClick={() => setQuestion('How many transactions support this market view?')}>Transaction coverage</button>
          <button type="button" onClick={() => setQuestion('What are the main limitations of this comparison?')}>Limitations</button>
        </div>
      </section>

      <section className="panel ask-result" aria-live="polite">
        {state === 'ready' && <div className="ask-placeholder"><p className="eyebrow">Research brief</p><h2>Your grounded result will appear here.</h2><p>The result will keep its evidence, source freshness and limitations together.</p></div>}
        {state === 'researching' && <div className="ask-placeholder"><p className="eyebrow">Bounded request in progress</p><h2>Researching the approved market view…</h2><p>This is one non-streaming request. The interface does not claim live execution stages or cancellation.</p></div>}
        {state === 'complete' && result?.ok && <GroundedResult result={result} />}
        {state === 'complete' && result && !result.ok && <div className="ask-placeholder ask-failure"><p className="eyebrow">Controlled outcome</p><h2>{statusHeading[result.status]}</h2><p>{result.message}</p>{result.status === 'rate_limited' && <p>Wait before submitting another request. This page will not retry automatically.</p>}</div>}
      </section>
    </div>
  );
}

function GroundedResult({ result }: { result: Extract<AskProplyEnvelope, { ok: true }> }) {
  return (
    <article>
      <div className="ask-result-heading"><div><p className="eyebrow">Grounded result</p><h2>Research brief</h2></div><span className="ask-mode">{result.data_mode === 'proply_https' ? 'Protected Proply data' : 'Synthetic preview'}</span></div>
      <p className="ask-answer">{result.answer}</p>

      {result.evidence.map((evidence, index) => (
        <section className="ask-detail" key={evidence.citation_id}>
          <h3>{result.evidence.length === 1 ? 'Evidence used' : `Evidence slice ${index + 1}`}</h3>
          <dl className="ask-evidence">
            <div><dt>Area</dt><dd>{evidence.area}</dd></div>
            <div><dt>Property type</dt><dd>{propertyLabels[evidence.property_type]}</dd></div>
            <div><dt>Period</dt><dd>{evidence.period.start_year}–{evidence.period.end_year}</dd></div>
            <div><dt>Transactions</dt><dd>{evidence.transaction_count}</dd></div>
            <div><dt>Average sold price</dt><dd>{formatPrice(evidence.average_sold_price_gbp)}</dd></div>
            <div><dt>Median sold price</dt><dd>{formatPrice(evidence.median_sold_price_gbp)}</dd></div>
          </dl>
          <code>{evidence.citation_id}</code>
          <h4>Source and freshness</h4>
          <p>{evidence.source.name}{evidence.source.refreshed_at == null ? ' · refresh not applicable' : <> · refreshed <time dateTime={evidence.source.refreshed_at}>{new Date(evidence.source.refreshed_at).toLocaleString('en-GB', { timeZone: 'Europe/London' })}</time></>}</p>
          <p>{evidence.source.attribution.statement} {evidence.source.attribution.licence_url == null ? evidence.source.attribution.licence_name : <a href={evidence.source.attribution.licence_url} rel="noreferrer">{evidence.source.attribution.licence_name}</a>}</p>
          <h4>Limitations</h4>
          <ul>{evidence.limitations.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
      ))}
      <section className="ask-detail"><h3>How it ran</h3><ol className="ask-steps"><li>Request checked</li><li>Plan bounded</li><li>Evidence retrieved</li><li>Answer validated</li></ol><p className="ask-caption">Completed synthetic path; not live streaming telemetry.</p></section>
    </article>
  );
}

