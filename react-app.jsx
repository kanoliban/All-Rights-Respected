import { useState, useEffect, useRef } from 'react';

// Styles as CSS-in-JS object (for use with styled-jsx or similar)
const styles = {
  colors: {
    bg: '#0a0a0a',
    fg: '#e8e4dc',
    muted: '#8a8680',
    border: '#2a2825',
    accent: '#c4b998',
    red: '#a85454',
    green: '#a8c490',
  },
};

// Noise Canvas Component
function NoiseCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const generateNoise = () => {
      const imageData = ctx.createImageData(canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const value = Math.random() * 255;
        data[i] = value;
        data[i + 1] = value;
        data[i + 2] = value;
        data[i + 3] = 255;
      }

      ctx.putImageData(imageData, 0, 0);
    };

    resize();
    generateNoise();

    window.addEventListener('resize', () => {
      resize();
      generateNoise();
    });

    const interval = setInterval(generateNoise, 100);

    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        opacity: 0.03,
        zIndex: 1000,
      }}
    />
  );
}

// Ticker Component
function Ticker() {
  const items = [
    'ALL RIGHTS RESPECTED',
    'OPEN PROTOCOL v0.1',
    'INFRASTRUCTURE FOR THE RESPECT ECONOMY',
    'IMPLEMENT FREELY',
    'NO PERMISSION REQUIRED',
  ];

  return (
    <div className="ticker">
      <div className="ticker-content">
        {[...items, ...items].map((item, i) => (
          <span key={i}>{item}</span>
        ))}
      </div>
      <style jsx>{`
        .ticker {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          background: ${styles.colors.bg};
          border-bottom: 1px solid ${styles.colors.border};
          padding: 0.5rem 0;
          z-index: 100;
          overflow: hidden;
        }
        .ticker-content {
          display: flex;
          animation: scroll 30s linear infinite;
          white-space: nowrap;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.75rem;
          letter-spacing: 0.1em;
          color: ${styles.colors.muted};
        }
        .ticker-content span {
          padding: 0 2rem;
        }
        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

// Header Component
function Header() {
  return (
    <header>
      <div className="logo">
        <span className="logo-symbol">&#9415;</span>
        ALL RIGHTS RESPECTED
      </div>
      <nav>
        <a href="#protocol">The Protocol</a>
        <a href="#implement">Implement ARR</a>
      </nav>
      <style jsx>{`
        header {
          position: fixed;
          top: 2.5rem;
          left: 0;
          right: 0;
          background: ${styles.colors.bg};
          border-bottom: 1px solid ${styles.colors.border};
          padding: 1rem 2rem;
          z-index: 99;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .logo {
          font-size: 1rem;
          font-weight: 600;
          letter-spacing: 0.05em;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .logo-symbol {
          font-size: 1.25rem;
          color: ${styles.colors.accent};
        }
        nav {
          display: flex;
          gap: 2rem;
        }
        nav a {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.8rem;
          color: ${styles.colors.muted};
          text-decoration: none;
          letter-spacing: 0.05em;
          transition: color 0.2s;
        }
        nav a:hover {
          color: ${styles.colors.fg};
        }
      `}</style>
    </header>
  );
}

// Legal Notice Component
function LegalNotice() {
  return (
    <div className="legal-notice">
      <div className="legal-notice-label">DECLARATION &#167; 001</div>
      <p>
        This is not a product. This is not a company. This is infrastructure.
        ARR is an open protocol for creative attribution that anyone can
        implement without permission, payment, or approval.
      </p>
      <style jsx>{`
        .legal-notice {
          border: 1px solid ${styles.colors.border};
          padding: 1.5rem 2rem;
          margin-bottom: 3rem;
          text-align: left;
          max-width: 600px;
          margin-left: auto;
          margin-right: auto;
          position: relative;
        }
        .legal-notice::before {
          content: '';
          position: absolute;
          top: -1px;
          left: 2rem;
          width: 100px;
          height: 2px;
          background: ${styles.colors.accent};
        }
        .legal-notice-label {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.7rem;
          color: ${styles.colors.accent};
          letter-spacing: 0.15em;
          margin-bottom: 0.75rem;
        }
        .legal-notice p {
          font-size: 0.95rem;
          color: ${styles.colors.muted};
          line-height: 1.7;
          margin: 0;
        }
      `}</style>
    </div>
  );
}

// Hero Section
function Hero() {
  return (
    <section className="hero">
      <LegalNotice />
      <h1>
        THE RIGHT TO<br />
        GENERATE IS THE<br />
        RIGHT TO OWN.
      </h1>
      <p className="hero-sub">
        While courts deliberate and laws lag, we build the infrastructure for
        respect. A protocol for attribution in the age of AI&mdash;free to
        implement, impossible to own, designed to be given away.
      </p>
      <div className="status-line">
        <span>PROTOCOL v0.1</span>
        <span>OPEN STANDARD</span>
        <span>ZERO LICENSE FEES</span>
      </div>
      <style jsx>{`
        .hero {
          padding: 6rem 2rem;
          text-align: center;
          max-width: 1000px;
          margin: 0 auto;
        }
        h1 {
          font-size: clamp(2.5rem, 8vw, 4.5rem);
          font-weight: 400;
          line-height: 1.1;
          letter-spacing: -0.02em;
          margin-bottom: 1.5rem;
        }
        .hero-sub {
          font-size: 1.25rem;
          color: ${styles.colors.muted};
          max-width: 600px;
          margin: 0 auto 2rem;
          line-height: 1.6;
        }
        .status-line {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.75rem;
          color: ${styles.colors.muted};
          letter-spacing: 0.1em;
        }
        .status-line span {
          padding: 0 0.75rem;
        }
        .status-line span:not(:last-child) {
          border-right: 1px solid ${styles.colors.border};
        }
      `}</style>
    </section>
  );
}

// Protocol Spec Preview
function ProtocolSpec() {
  const specCode = `attestation:
  version: "arr/0.1"
  created: "2026-01-29T10:30:00Z"
  creator: "hash:7f3a9b2c..."  # privacy-preserving
  intent: "Poster design for climate campaign"
  tool: "midjourney/6.1"
  upstream: []  # acknowledge what came before
  expires: "2031-01-29"  # nothing is permanent
  revocable: true
  signature: "ed25519:..."`;

  return (
    <section className="protocol-section" id="protocol">
      <div className="section-header">THE ATTESTATION FORMAT</div>
      <h2>What an ARR attestation looks like</h2>
      <div className="spec-preview">
        <pre>{specCode}</pre>
      </div>
      <div className="feature-grid">
        <FeatureCard
          title="EMBEDDABLE"
          description="Lives in file metadata. Travels with the work. No external registry required."
        />
        <FeatureCard
          title="VERIFIABLE"
          description="Anyone can verify. No API keys. No accounts. Cryptographic proof, not trust."
        />
        <FeatureCard
          title="OWNERLESS"
          description="No company controls this. No licensing fees. Implement it however you want."
        />
      </div>
      <style jsx>{`
        .protocol-section {
          padding: 4rem 2rem;
          max-width: 1000px;
          margin: 0 auto;
          border-top: 1px solid ${styles.colors.border};
        }
        .section-header {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.75rem;
          color: ${styles.colors.accent};
          letter-spacing: 0.15em;
          margin-bottom: 1.5rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid ${styles.colors.border};
        }
        h2 {
          font-size: 2rem;
          font-weight: 400;
          margin-bottom: 1.5rem;
        }
        .spec-preview {
          background: #0f0f0d;
          border: 1px solid ${styles.colors.border};
          padding: 1.5rem;
          margin: 2rem 0;
          overflow-x: auto;
        }
        .spec-preview pre {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.85rem;
          line-height: 1.6;
          color: ${styles.colors.fg};
          margin: 0;
        }
        .feature-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1px;
          background: ${styles.colors.border};
          border: 1px solid ${styles.colors.border};
          margin-top: 2rem;
        }
        @media (max-width: 768px) {
          .feature-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  );
}

// Feature Card Component
function FeatureCard({ title, description }) {
  return (
    <div className="feature-card">
      <h3>{title}</h3>
      <p>{description}</p>
      <style jsx>{`
        .feature-card {
          background: ${styles.colors.bg};
          padding: 1.5rem;
        }
        .feature-card h3 {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.8rem;
          letter-spacing: 0.05em;
          margin-bottom: 0.75rem;
          color: ${styles.colors.fg};
        }
        .feature-card p {
          font-size: 0.95rem;
          color: ${styles.colors.muted};
          margin: 0;
        }
      `}</style>
    </div>
  );
}

// What ARR Is Not Section
function WhatArrIsNot() {
  const items = [
    {
      title: 'NOT LEGAL EVIDENCE',
      description: 'ARR is a social protocol, not courtroom proof. Use it for human recognition, not litigation.',
    },
    {
      title: 'NOT IDENTITY',
      description: "Anonymous attestation is supported. You don't need to reveal who you are to claim what you made.",
    },
    {
      title: 'NOT PERMANENT',
      description: 'Attestations expire by default. Creators can revoke anytime. We build for memory, not surveillance.',
    },
    {
      title: 'NOT REQUIRED',
      description: 'Work without ARR deserves equal respect. Platforms that require ARR for access violate our principles.',
    },
  ];

  return (
    <section className="not-section">
      <div className="section-header">WHAT THIS IS NOT</div>
      <div className="not-grid">
        {items.map((item, i) => (
          <div key={i} className="not-card">
            <h3>{item.title}</h3>
            <p>{item.description}</p>
          </div>
        ))}
      </div>
      <style jsx>{`
        .not-section {
          padding: 4rem 2rem;
          max-width: 1000px;
          margin: 0 auto;
        }
        .section-header {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.75rem;
          color: ${styles.colors.accent};
          letter-spacing: 0.15em;
          margin-bottom: 1.5rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid ${styles.colors.border};
        }
        .not-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1.5rem;
          margin-top: 2rem;
        }
        .not-card {
          border: 1px solid ${styles.colors.border};
          padding: 1.5rem;
        }
        .not-card h3 {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.8rem;
          color: ${styles.colors.red};
          letter-spacing: 0.05em;
          margin-bottom: 0.75rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .not-card h3::before {
          content: '\\2298';
          font-size: 1.1rem;
        }
        .not-card p {
          font-size: 0.95rem;
          color: ${styles.colors.muted};
          margin: 0;
        }
        @media (max-width: 768px) {
          .not-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  );
}

// Articles Section
function ArticlesSection() {
  const [expandedIndex, setExpandedIndex] = useState(null);

  const articles = [
    {
      number: 'ARTICLE I',
      title: 'INTENT IS AUTHORSHIP',
      content: 'The one who directs creation holds creative claim. The prompt, the vision, the intention—these constitute authorship in the age of generative tools. This is the core philosophical claim. It answers "who owns AI-generated content?" with "the one who intended it into existence."',
    },
    {
      number: 'ARTICLE II',
      title: 'INFRASTRUCTURE MUST BE FREE',
      content: "Protocols that charge become products. Products compete. Competition fragments. Fragmentation fails. ARR charges nothing, requires no permission, and belongs to everyone. The QR code lesson: Denso Wave's gift created a universal standard. If they'd charged licensing fees, we'd have 50 incompatible formats.",
    },
    {
      number: 'ARTICLE III',
      title: "RESPECT SCALES, CONTROL DOESN'T",
      content: "Legal enforcement requires lawyers, courts, jurisdiction, money, time. Respect requires only visibility. We build for billions by building for trust, not litigation. Copyright enforcement is reactive, expensive, and doesn't scale. A respect-based system with social pressure and platform integration can work at internet scale.",
    },
    {
      number: 'ARTICLE IV',
      title: 'THE RIGHT TO DISAPPEAR',
      content: 'Attestations expire. Creators revoke. Nothing is permanent without renewal. We protect attribution, not surveillance. The protocol serves memory, not prosecution. Built-in expiration (5 years default) and revocation rights prevent weaponization.',
    },
    {
      number: 'ARTICLE V',
      title: 'ABSENCE IS VALID',
      content: 'Work without attestation deserves equal respect. ARR is an invitation, never a requirement. Any platform that mandates ARR for access violates everything we stand for. This prevents ARR from becoming a gatekeeping mechanism. The protocol must never exclude those who choose not to participate.',
    },
  ];

  return (
    <section className="articles-section">
      <div className="section-header">THE ARTICLES OF RESPECT</div>
      <blockquote className="quote-block">
        "We hold these truths to be self-evident: that all generations are
        created equal, endowed by their Prompter with certain unalienable
        Rights, among these Attribution, Expiration, and the pursuit of
        Respect."
      </blockquote>
      <div className="articles-list">
        {articles.map((article, i) => (
          <div key={i}>
            <div
              className={`article-item ${expandedIndex === i ? 'expanded' : ''}`}
              onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
            >
              <span className="article-number">{article.number}</span>
              <span className="article-title">{article.title}</span>
            </div>
            {expandedIndex === i && (
              <div className="article-content">{article.content}</div>
            )}
          </div>
        ))}
      </div>
      <style jsx>{`
        .articles-section {
          padding: 4rem 2rem;
          max-width: 1000px;
          margin: 0 auto;
          border-top: 1px solid ${styles.colors.border};
        }
        .section-header {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.75rem;
          color: ${styles.colors.accent};
          letter-spacing: 0.15em;
          margin-bottom: 1.5rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid ${styles.colors.border};
        }
        .quote-block {
          border-left: 2px solid ${styles.colors.accent};
          padding-left: 1.5rem;
          margin: 2rem 0;
          font-style: italic;
          font-size: 1.1rem;
          color: ${styles.colors.muted};
          line-height: 1.7;
        }
        .articles-list {
          margin-top: 2rem;
        }
        .article-item {
          display: flex;
          gap: 2rem;
          padding: 1.25rem 0;
          border-bottom: 1px solid ${styles.colors.border};
          cursor: pointer;
          transition: background 0.2s;
        }
        .article-item:hover {
          background: rgba(255, 255, 255, 0.02);
          margin: 0 -1rem;
          padding-left: 1rem;
          padding-right: 1rem;
        }
        .article-number {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.75rem;
          color: ${styles.colors.muted};
          letter-spacing: 0.1em;
          min-width: 100px;
        }
        .article-title {
          font-size: 1.1rem;
          letter-spacing: 0.02em;
        }
        .article-content {
          padding: 1rem 0 1rem 116px;
          color: ${styles.colors.muted};
          font-size: 0.95rem;
          line-height: 1.7;
          border-bottom: 1px solid ${styles.colors.border};
        }
        @media (max-width: 768px) {
          .article-item {
            flex-direction: column;
            gap: 0.5rem;
          }
          .article-content {
            padding-left: 0;
          }
        }
      `}</style>
    </section>
  );
}

// Timing Section
function TimingSection() {
  return (
    <section className="timing-section">
      <div className="section-header">WHY NOW</div>
      <h2>The infrastructure must exist before the moment arrives</h2>
      <div className="timing-grid">
        <div className="timing-column">
          <h3>THE MOMENT</h3>
          <p>
            <strong>The legal frameworks are being written now.</strong>
          </p>
          <p>
            EU AI Act: Live.
            <br />
            US Copyright Office: Ruling on AI authorship.
            <br />
            Courts: NYT v. OpenAI, Getty v. Stability, artists v. everyone.
          </p>
          <p>
            Whoever defines the vocabulary for "AI content attribution" shapes
            the conversation. We're not waiting for permission.
          </p>
        </div>
        <div className="timing-column">
          <h3>THE PRECEDENT</h3>
          <p>
            <strong>QR codes were invented in 1994.</strong>
          </p>
          <p>
            Denso Wave gave them away&mdash;no licensing fees, no control. They
            languished for 26 years as an industrial tool.
          </p>
          <p>
            Then smartphones arrived. Then the pandemic. Suddenly they were
            everywhere.
          </p>
          <p>
            <strong>We're building infrastructure for when the moment arrives.</strong>{' '}
            It may take years. The protocol will be ready.
          </p>
        </div>
      </div>
      <style jsx>{`
        .timing-section {
          padding: 4rem 2rem;
          max-width: 1000px;
          margin: 0 auto;
          border-top: 1px solid ${styles.colors.border};
        }
        .section-header {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.75rem;
          color: ${styles.colors.accent};
          letter-spacing: 0.15em;
          margin-bottom: 1.5rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid ${styles.colors.border};
        }
        h2 {
          font-size: 2rem;
          font-weight: 400;
          margin-bottom: 1.5rem;
        }
        .timing-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 3rem;
          margin-top: 2rem;
        }
        .timing-column h3 {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.75rem;
          color: ${styles.colors.accent};
          letter-spacing: 0.1em;
          margin-bottom: 1rem;
        }
        .timing-column p {
          color: ${styles.colors.muted};
          margin-bottom: 1rem;
          font-size: 0.95rem;
        }
        .timing-column strong {
          color: ${styles.colors.fg};
        }
        @media (max-width: 768px) {
          .timing-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  );
}

// Implementation Section
function ImplementationSection() {
  return (
    <section className="implementation-section" id="implement">
      <div className="section-header">IMPLEMENT ARR</div>
      <h2>Three paths to participation</h2>
      <div className="impl-grid">
        <div className="impl-card">
          <h3>For Creators</h3>
          <p>
            Add ARR attestations to your work using any compatible tool. No
            signup required.
          </p>
        </div>
        <div className="impl-card">
          <h3>For Platforms</h3>
          <p>
            Integrate ARR detection and display. Show respect badges. Honor
            creator intent.
          </p>
        </div>
        <div className="impl-card">
          <h3>For Developers</h3>
          <p>
            Read the spec. Build a library. Contribute to the standard.
            Everything is open.
          </p>
        </div>
      </div>
      <div className="btn-group">
        <a href="spec.html" className="btn btn-primary">
          Read the Specification
        </a>
        <a href="https://github.com/allrightsrespected/arr" className="btn">
          View Reference Implementation
        </a>
        <a
          href="https://github.com/allrightsrespected/arr/discussions"
          className="btn"
        >
          Join the Discussion
        </a>
      </div>
      <style jsx>{`
        .implementation-section {
          padding: 4rem 2rem;
          max-width: 1000px;
          margin: 0 auto;
          border-top: 1px solid ${styles.colors.border};
        }
        .section-header {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.75rem;
          color: ${styles.colors.accent};
          letter-spacing: 0.15em;
          margin-bottom: 1.5rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid ${styles.colors.border};
        }
        h2 {
          font-size: 2rem;
          font-weight: 400;
          margin-bottom: 1.5rem;
        }
        .impl-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1px;
          background: ${styles.colors.border};
          border: 1px solid ${styles.colors.border};
          margin: 2rem 0;
        }
        .impl-card {
          background: ${styles.colors.bg};
          padding: 2rem 1.5rem;
        }
        .impl-card h3 {
          font-size: 1.1rem;
          margin-bottom: 0.75rem;
        }
        .impl-card p {
          font-size: 0.9rem;
          color: ${styles.colors.muted};
          margin: 0;
        }
        .btn-group {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
          justify-content: center;
          margin-top: 2rem;
        }
        .btn {
          display: inline-block;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.8rem;
          letter-spacing: 0.05em;
          padding: 0.75rem 1.5rem;
          text-decoration: none;
          border: 1px solid ${styles.colors.border};
          color: ${styles.colors.fg};
          background: transparent;
          transition: all 0.2s;
          cursor: pointer;
        }
        .btn:hover {
          background: ${styles.colors.fg};
          color: ${styles.colors.bg};
        }
        .btn-primary {
          background: ${styles.colors.fg};
          color: ${styles.colors.bg};
        }
        .btn-primary:hover {
          background: ${styles.colors.accent};
        }
        @media (max-width: 768px) {
          .impl-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  );
}

// Signatories Section
function SignatoriesSection() {
  return (
    <section className="signatories-section">
      <div className="section-header">EARLY IMPLEMENTERS</div>
      <p className="signatories-note">
        The protocol is young. The first implementers will shape it.
      </p>
      <div className="signatories-grid">
        <div className="signatory-slot">&mdash;</div>
        <div className="signatory-slot">&mdash;</div>
        <div className="signatory-slot">&mdash;</div>
        <a
          href="mailto:implement@allrightsrespected.com"
          className="signatory-slot add-signatory"
        >
          Implement ARR &rarr;
        </a>
      </div>
      <style jsx>{`
        .signatories-section {
          padding: 4rem 2rem;
          max-width: 1000px;
          margin: 0 auto;
          border-top: 1px solid ${styles.colors.border};
        }
        .section-header {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.75rem;
          color: ${styles.colors.accent};
          letter-spacing: 0.15em;
          margin-bottom: 1.5rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid ${styles.colors.border};
        }
        .signatories-note {
          color: ${styles.colors.muted};
          font-size: 0.95rem;
          margin-bottom: 2rem;
        }
        .signatories-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1rem;
        }
        .signatory-slot {
          border: 1px dashed ${styles.colors.border};
          padding: 2rem;
          text-align: center;
          color: ${styles.colors.border};
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.75rem;
        }
        .add-signatory {
          border-style: dashed;
          color: ${styles.colors.muted};
          text-decoration: none;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        .add-signatory:hover {
          border-color: ${styles.colors.fg};
          color: ${styles.colors.fg};
        }
        @media (max-width: 768px) {
          .signatories-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </section>
  );
}

// Footer
function Footer() {
  return (
    <footer>
      <p>&copy; 2026 ALL RIGHTS RESPECTED</p>
      <p>NOT A COMPANY. A PROTOCOL.</p>
      <p>GIVEN AWAY FREELY.</p>
      <div className="footer-links">
        <a href="spec.html">SPECIFICATION</a>
        <a href="https://github.com/allrightsrespected/arr">GITHUB</a>
        <a href="https://github.com/allrightsrespected/arr/discussions">
          DISCUSSION
        </a>
      </div>
      <style jsx>{`
        footer {
          border-top: 1px solid ${styles.colors.border};
          padding: 3rem 2rem;
          text-align: center;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.75rem;
          color: ${styles.colors.muted};
          letter-spacing: 0.05em;
        }
        footer p {
          margin-bottom: 0.5rem;
        }
        .footer-links {
          margin-top: 1.5rem;
        }
        .footer-links a {
          color: ${styles.colors.muted};
          text-decoration: none;
          padding: 0 0.5rem;
        }
        .footer-links a:hover {
          color: ${styles.colors.fg};
        }
      `}</style>
    </footer>
  );
}

// Main App Component
export default function AllRightsRespected() {
  return (
    <>
      <NoiseCanvas />
      <Ticker />
      <Header />
      <main style={{ paddingTop: '7rem' }}>
        <Hero />
        <ProtocolSpec />
        <WhatArrIsNot />
        <ArticlesSection />
        <TimingSection />
        <ImplementationSection />
        <SignatoriesSection />
      </main>
      <Footer />
      <style jsx global>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        html {
          font-size: 16px;
          scroll-behavior: smooth;
        }
        body {
          font-family: 'EB Garamond', Georgia, serif;
          background: ${styles.colors.bg};
          color: ${styles.colors.fg};
          line-height: 1.6;
          min-height: 100vh;
        }
      `}</style>
    </>
  );
}
