import { Clock3, Database, Eye, LockKeyhole, MapPin, ShieldCheck, UserCheck, } from "lucide-react";
import { Link } from "react-router-dom";
import { Brand } from "../components/Brand";
export function PrivacyPage() {
    return (<main className="privacy-page">
      <header className="privacy-header">
        <Brand />
        <div className="privacy-header-actions">
          <Link className="privacy-create-link" to="/signup">
            Create account
          </Link>
          <Link className="button button--secondary" to="/login">
            Sign in
          </Link>
        </div>
      </header>
      <section className="privacy-hero">
        <span>
          <ShieldCheck />
        </span>
        <p>Privacy & location safety</p>
        <h1>Your commute data stays trip-bound and role-protected.</h1>
        <p>
          SmartTransit uses the minimum transport information needed to run a
          safe Indus University commute.
        </p>
      </section>
      <section className="privacy-content" aria-label="SmartTransit privacy information">
        <article className="privacy-feature-card privacy-feature-card--wide">
          <MapPin />
          <div>
            <h2>Driver location is visible only during an active trip</h2>
            <p>
              GPS sharing starts only after the driver completes the safety
              checklist and confirms trip start. It stops immediately when the
              trip ends or is cancelled. Before and after that window, the
              interface shows “Not sharing” instead of a position.
            </p>
          </div>
        </article>
        <article className="privacy-feature-card">
          <Eye />
          <div>
            <h2>Who can view it?</h2>
            <p>
              Only assigned students and authorized transport operators can view
              an active bus location. Students see only their assigned commute.
            </p>
          </div>
        </article>
        <article className="privacy-feature-card">
          <UserCheck />
          <div>
            <h2>Role-based access</h2>
            <p>
              Students, drivers, conductors and operators use separate protected
              workspaces. Attempting to open another role’s page is denied.
            </p>
          </div>
        </article>
        <article className="privacy-feature-card">
          <Database />
          <div>
            <h2>Data used</h2>
            <p>
              SmartTransit uses route assignments, GPS freshness, seat
              availability, notifications, complaints and auditable operator
              actions to support daily transport operations.
            </p>
          </div>
        </article>
        <article className="privacy-feature-card">
          <Clock3 />
          <div>
            <h2>Freshness is explicit</h2>
            <p>
              Every live location and seat count includes an update time.
              Delayed GPS is labelled stale and is never presented as current.
            </p>
          </div>
        </article>
        <article className="privacy-feature-card privacy-feature-card--wide">
          <LockKeyhole />
          <div>
            <h2>Backend-ready implementation notice</h2>
            <p>
              This version can run with local structured data or the included
              Node.js API. A production backend can later replace the local
              JSON store with JWT, database and real-time transports without
              changing these privacy rules.
            </p>
          </div>
        </article>
      </section>
      <section className="privacy-contact">
        <div>
          <h2>Questions about transport data?</h2>
          <p>
            Contact the Indus University transport office for access or privacy
            assistance.
          </p>
        </div>
        <a className="button button--primary" href="mailto:transport@indusuni.ac.in">
          transport@indusuni.ac.in
        </a>
      </section>
      <footer className="privacy-footer">
        <span>© 2026 SmartTransit · Indus University</span>
        <Link to="/">Return to homepage</Link>
      </footer>
    </main>);
}
