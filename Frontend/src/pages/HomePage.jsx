import { ArrowRight, BellRing, BusFront, CircleCheck, ClipboardCheck, Clock3, Gauge, HeartHandshake, LayoutDashboard, LocateFixed, LockKeyhole, MailCheck, MapPin, MessageCircleQuestion, MonitorCheck, RadioTower, Route, ServerCog, ShieldCheck, Smartphone, UserRoundCheck, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BrandLogo } from '../components/Brand';
import { Footer } from '../components/Footer';
import { PhonePreview } from '../components/PhonePreview';
import { PublicHeader } from '../components/PublicHeader';
const heroMetrics = [
    { value: '8', label: 'Indus route corridors' },
    { value: '4', label: 'role-based portals' },
    { value: 'OTP', label: 'verified student signup' },
];
const features = [
    { icon: LocateFixed, title: 'Live location', text: 'Follow your assigned college bus on an active route map with fresh GPS context.' },
    { icon: Clock3, title: 'Accurate ETA', text: 'Know when your bus is expected at your selected stop before leaving home.' },
    { icon: Users, title: 'Seat availability', text: 'Check available seats as conductors update boarding and deboarding details.' },
    { icon: BellRing, title: 'Instant alerts', text: 'Receive important delay, cancellation and route-change updates in one place.' },
];
const roleCards = [
    { icon: Smartphone, title: 'Student portal', text: 'Live tracking, ETA, seat count, alerts, complaints, profile and help center.' },
    { icon: RadioTower, title: 'Driver portal', text: 'Trip start/end, GPS sharing, checklist, emergency reporting and trip history.' },
    { icon: ClipboardCheck, title: 'Conductor portal', text: 'Stop-wise passenger count, seat availability updates and emergency actions.' },
    { icon: LayoutDashboard, title: 'Operator dashboard', text: 'Routes, buses, staff, students, assignments, reports, complaints and settings.' },
];
const readinessItems = [
    { icon: ServerCog, title: 'Backend-ready APIs', text: 'Frontend calls are centralized, so the real backend can connect without rewriting screens.' },
    { icon: MailCheck, title: 'Real email OTP', text: 'Student signup now verifies email ownership before the account is created.' },
    { icon: MonitorCheck, title: 'Responsive experience', text: 'Student and staff screens work on mobile, while operator screens stay efficient on desktop.' },
    { icon: ShieldCheck, title: 'Role protection', text: 'Students, drivers, conductors and admins only see the pages meant for their role.' },
];
export function HomePage() {
    return (<div className="page-shell">
      <PublicHeader />
      <main>
        <section className="hero">
          <div className="hero__glow"/>
          <div className="container hero__inner">
            <div className="hero__copy">
              <BrandLogo className="hero__official-logo"/>
              <div className="campus-pill"><ShieldCheck /> Indus University transport platform</div>
              <h1>Your College Bus, <span>Live.</span></h1>
              <p className="hero__lead">A professional campus transport system for students, drivers, conductors and transport operators, with live tracking, verified signup and route operations in one place.</p>
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
            <PhonePreview />
          </div>
        </section>

        <section className="features section" id="features">
          <div className="container">
            <div className="section-heading"><span>Everything you need</span><h2>A better way to manage campus transport</h2><p>Clear, timely information for students and a practical operating layer for the transport team.</p></div>
            <div className="feature-grid">
              {features.map(({ icon: Icon, title, text }, index) => (<article className="feature-card" key={title}><span className={`feature-card__icon feature-card__icon--${index + 1}`}><Icon /></span><h3>{title}</h3><p>{text}</p></article>))}
            </div>
          </div>
        </section>

        <section className="platform section" id="operations">
          <div className="container">
            <div className="section-heading"><span>Complete application</span><h2>One system for every transport role</h2><p>Each user gets a focused interface, so the same application can support daily student use and transport-office operations.</p></div>
            <div className="platform-grid">
              {roleCards.map(({ icon: Icon, title, text }) => (<article className="platform-card" key={title}><span className="platform-card__icon"><Icon /></span><h3>{title}</h3><p>{text}</p></article>))}
            </div>
          </div>
        </section>

        <section className="journey section">
          <div className="container journey__inner">
            <div className="journey__visual" aria-hidden="true">
              <div className="journey__map"><span className="journey__line"/><i className="journey__stop journey__stop--1"/><i className="journey__stop journey__stop--2"/><i className="journey__stop journey__stop--3"/><span className="journey__bus"><Route /></span></div>
              <div className="arrival-card"><span><Clock3 /></span><div><small>Arriving at your stop</small><strong>8 minutes</strong></div></div>
            </div>
            <div className="journey__copy"><span className="section-kicker">Built around your day</span><h2>From campus gate to home, stay one step ahead.</h2><p>See your bus progress, next stop and latest update at a glance. SmartTransit keeps the information that matters easy to find.</p><ul><li><ShieldCheck /> Location is shared only during active trips</li><li><BellRing /> Timely alerts when the plan changes</li><li><BusFront /> Indus University routes and stops already mapped</li></ul><Link to="/track" className="text-link">Explore live tracking <ArrowRight /></Link></div>
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
              <span className="section-kicker section-kicker--light">Ready to present</span>
              <h2>Built like a real deployable application.</h2>
              <p>The interface is prepared for live use: responsive layouts, real OTP signup, centralized backend connection points and production build support.</p>
              <div className="readiness__actions">
                <Link className="button button--accent" to="/login">Open app portals</Link>
                <Link className="button button--ghost" to="/privacy">View privacy details</Link>
              </div>
            </div>
            <div className="readiness__list">
              {readinessItems.map(({ icon: Icon, title, text }) => (<div className="readiness-item" key={title}><span><Icon /></span><div><strong>{title}</strong><small>{text}</small></div></div>))}
            </div>
          </div>
        </section>

        <section className="help section" id="help">
          <div className="container help__card"><div className="help__icon"><MessageCircleQuestion /></div><div><span className="section-kicker">We’re here to help</span><h2>Need support with your commute?</h2><p>Visit the help center or contact the Indus University transport office.</p></div><div className="help__actions"><Link className="button button--primary" to="/help">Open help center</Link><a className="button button--secondary" href="mailto:transport@indusuni.ac.in"><HeartHandshake /> Contact us</a></div></div>
        </section>
      </main>
      <Footer />
    </div>);
}
