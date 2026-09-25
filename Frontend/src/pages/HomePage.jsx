import { ArrowRight, BellRing, BusFront, CircleCheck, ClipboardCheck, Clock3, Gauge, HeartHandshake, LayoutDashboard, LocateFixed, LockKeyhole, MailCheck, MapPin, MessageCircleQuestion, MonitorCheck, RadioTower, Route, ServerCog, ShieldCheck, Smartphone, UserRoundCheck, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BrandLogo } from '../components/Brand';
import { Footer } from '../components/Footer';
import { PhonePreview } from '../components/PhonePreview';
import { PublicHeader } from '../components/PublicHeader';
import { universityContact } from '../services/supportContacts';
const heroMetrics = [
    { value: 'Routes', label: 'Campus connections' },
    { value: '4', label: 'Connected roles' },
    { value: 'OTP', label: 'Verified signup' },
];
const features = [
    { icon: LocateFixed, title: 'Live location', text: 'Follow your assigned bus during its trip, with a timestamp for the latest GPS update.' },
    { icon: Clock3, title: 'Estimated arrival', text: 'See a GPS-based estimate when a reliable location is available. Traffic and signal quality can affect arrival times.' },
    { icon: Users, title: 'Seat availability', text: 'Check available seats as conductors update boarding and deboarding details.' },
    { icon: BellRing, title: 'Transport updates', text: 'Check important delay, cancellation and route-change notices in one place.' },
];
const roleCards = [
    { icon: Smartphone, title: 'Student portal', text: 'Live tracking, ETA, seat count, alerts, complaints, profile and help center.' },
    { icon: RadioTower, title: 'Driver portal', text: 'Trip start/end, GPS sharing, checklist, emergency reporting and trip history.' },
    { icon: ClipboardCheck, title: 'Conductor portal', text: 'Stop-wise passenger count, seat availability updates and emergency actions.' },
    { icon: LayoutDashboard, title: 'Operator dashboard', text: 'Routes, buses, staff, students, assignments, reports, complaints and settings.' },
];
const readinessItems = [
    { icon: ServerCog, title: 'Shared transport records', text: 'Approved users see the bus, route and passenger updates recorded by transport staff.' },
    { icon: MailCheck, title: 'Verified student access', text: 'Verify your institute email, then wait for transport approval and a route assignment.' },
    { icon: MonitorCheck, title: 'Travel with confidence', text: 'Keep your route, stop and latest transport notices close at hand.' },
    { icon: ShieldCheck, title: 'Controlled access', text: 'Transport information and actions are limited to your role and assignment.' },
];
export function HomePage() {
    return (<div className="page-shell">
      <PublicHeader />
      <main>
        <section className="hero">
          <div className="container hero__inner">
            <div className="hero__copy">
              <div className="hero__identity">
                <BrandLogo className="hero__official-logo"/>
                <div className="hero__identity-meta">
                  <strong>Indus University</strong>
                  <span>Track &bull; Connect &bull; Arrive</span>
                </div>
              </div>
              <div className="hero__message">
                <div className="campus-pill"><ShieldCheck /> Indus University transport platform</div>
                <h1>Smart<span>Transit</span></h1>
                <p className="hero__tagline">Your college bus. A clearer commute.</p>
                <p className="hero__lead">Track your assigned bus, check available seats and stay informed from pickup to campus and back.</p>
                <div className="hero__actions">
                  <Link className="button button--primary" to="/track"><MapPin /> Track my bus <ArrowRight /></Link>
                  <Link className="button button--secondary" to="/signup"><MailCheck /> Create account</Link>
                </div>
                <div className="trust-row">
                  <span><span className="trust-dot"/> Live route updates</span>
                  <span><ShieldCheck /> Student-first privacy</span>
                  <span><UserRoundCheck /> Role-based access</span>
                </div>
                <div className="hero__metrics" aria-label="SmartTransit platform highlights">
                  {heroMetrics.map((item) => (<div className="hero__metric" key={item.label}><strong>{item.value}</strong><span>{item.label}</span></div>))}
                </div>
              </div>
            </div>
            <PhonePreview />
          </div>
        </section>

        <section className="features section" id="features">
          <div className="container">
            <div className="section-heading"><span>Your commute, at a glance</span><h2>A better way to manage campus transport</h2><p>Know where your bus is, check your stop and keep up with transport updates.</p></div>
            <div className="feature-grid">
              {features.map(({ icon: Icon, title, text }, index) => (<article className="feature-card" key={title}><span className={`feature-card__icon feature-card__icon--${index + 1}`}><Icon /></span><h3>{title}</h3><p>{text}</p></article>))}
            </div>
          </div>
        </section>

        <section className="platform section" id="operations">
          <div className="container">
            <div className="section-heading"><span>People & operations</span><h2>One system for every transport role</h2><p>Students and transport staff stay connected through shared routes, trip updates and service notices.</p></div>
            <div className="platform-grid">
              {roleCards.map(({ icon: Icon, title, text }) => (<article className="platform-card" key={title}><span className="platform-card__icon"><Icon /></span><h3>{title}</h3><p>{text}</p></article>))}
            </div>
          </div>
        </section>

        <section className="journey section">
          <div className="container journey__inner">
            <div className="journey__visual" aria-hidden="true">
              <div className="journey__map"><span className="journey__line"/><i className="journey__stop journey__stop--1"/><i className="journey__stop journey__stop--2"/><i className="journey__stop journey__stop--3"/><span className="journey__bus"><Route /></span></div>
              <div className="arrival-card"><span><Clock3 /></span><div><small>Your selected stop</small><strong>Arrival estimate</strong></div></div>
            </div>
            <div className="journey__copy"><span className="section-kicker">Built around your day</span><h2>From campus gate to home, stay one step ahead.</h2><p>See your bus progress, next stop and latest update at a glance. SmartTransit keeps the information that matters easy to find.</p><ul><li><ShieldCheck /> Location is shared only during active trips</li><li><BellRing /> Transport notices when the plan changes</li><li><BusFront /> Your assigned route and pickup or drop-off stop</li></ul><Link to="/track" className="text-link">Explore live tracking <ArrowRight /></Link></div>
          </div>
        </section>

        <section className="safety section" id="safety">
          <div className="container safety__inner">
            <div className="safety__copy"><span className="section-kicker section-kicker--light">Safety and privacy</span><h2>Your commute. Your data. Protected.</h2><p>SmartTransit is designed for the Indus University community with role-based access, private trip visibility and clear responsibility for every user.</p><div className="safety__points"><div><LockKeyhole /><span><strong>Private by design</strong><small>Driver location is visible only while a trip is active.</small></span></div><div><ShieldCheck /><span><strong>Secure access</strong><small>Your university role controls what you can view and do.</small></span></div><div><Gauge /><span><strong>Operational control</strong><small>Transport staff can manage routes, fleet data and route updates.</small></span></div><div><CircleCheck /><span><strong>Verified signup</strong><small>Student accounts use email OTP confirmation before access.</small></span></div></div></div>
            <div className="safety__badge"><span><ShieldCheck /></span><strong>Student-first</strong><p>Clear updates and trusted information for a safer journey.</p></div>
          </div>
        </section>

        <section className="readiness section">
          <div className="container readiness__panel">
            <div className="readiness__copy">
              <span className="section-kicker section-kicker--light">Your daily commute</span>
              <h2>Campus transport, connected.</h2>
              <p>Check your assigned route, follow trip updates and contact the transport team from your account.</p>
              <div className="readiness__actions">
                <Link className="button button--accent" to="/login">Sign in to SmartTransit</Link>
                <Link className="button button--ghost" to="/privacy">View privacy details</Link>
              </div>
            </div>
            <div className="readiness__list">
              {readinessItems.map(({ icon: Icon, title, text }) => (<div className="readiness-item" key={title}><span><Icon /></span><div><strong>{title}</strong><small>{text}</small></div></div>))}
            </div>
          </div>
        </section>

        <section className="help section" id="help">
          <div className="container help__card"><div className="help__icon"><MessageCircleQuestion /></div><div><span className="section-kicker">We’re here to help</span><h2>Need support with your commute?</h2><p>Get account help or ask the university help desk for transport assistance.</p></div><div className="help__actions"><Link className="button button--primary" to="/help">Open help center</Link><a className="button button--secondary" href={`mailto:${universityContact.email}`}><HeartHandshake /> Contact us</a></div></div>
        </section>
      </main>
      <Footer />
    </div>);
}
