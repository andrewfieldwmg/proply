const example = '/api/research/market-summary?area=E10&start_year=2020&end_year=2025&property_type=T';

export default function ResearchServicePage() {
  return (
    <main>
      <p className="eyebrow">Proply · controlled research service</p>
      <h1>Read-only London property market summaries</h1>
      <p>
        This service exposes one bounded aggregate capability for E10, E11 and E17.
        It does not expose addresses, listings, scraper controls, raw records or arbitrary queries.
      </p>
      <section>
        <h2>Available capability</h2>
        <code>GET /api/research/market-summary</code>
        <p>Filter by approved area, year range and property type.</p>
        <a href={example}>View an example request</a>
      </section>
      <section>
        <h2>Data and limitations</h2>
        <p>
          Results are aggregates derived from HM Land Registry Price Paid Data and include
          source attribution, refresh time and limitations in every successful response.
        </p>
      </section>
      <p><a href="https://proply-af.vercel.app/">Open the full Proply dashboard</a></p>
    </main>
  );
}
