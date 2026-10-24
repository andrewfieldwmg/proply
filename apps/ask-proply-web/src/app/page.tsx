import ResearchForm from './research-form';

export default function AskProplyHomePage() {
  return (
    <main>
      <header className="masthead">
        <div>
          <p className="eyebrow">E10 · E11 · E17 property intelligence</p>
          <h1>Ask Proply</h1>
          <p className="lede">Research the local market through a bounded, read-only Proply experience.</p>
        </div>
        <div className="statuses" aria-label="Service status">
          <span className="status status-live">Read-only</span>
          <span className="status">Synthetic UI preview</span>
        </div>
      </header>

      <nav className="product-nav" aria-label="Proply products">
        <a href="https://proply-af.vercel.app/">Open the Proply dashboard</a>
        <span aria-current="page">Ask Proply</span>
      </nav>

      <section className="intro" aria-labelledby="ask-heading">
        <div>
          <p className="eyebrow">Governed property research</p>
          <h2 id="ask-heading">Ask one focused market question.</h2>
        </div>
        <p>Questions are checked before execution and can use only approved aggregate data for E10, E11 and E17. This local preview makes no live agent, model, property-service or database request.</p>
      </section>

      <ResearchForm />

      <footer>
        <span>Contains HM Land Registry data © Crown copyright and database right 2026. Licensed under the Open Government Licence v3.0.</span>
        <span> Proply is research software, not a valuation, lending or investment recommendation.</span>
      </footer>
    </main>
  );
}
