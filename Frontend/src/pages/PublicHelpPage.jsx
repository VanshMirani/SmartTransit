import { ChevronRight, CircleHelp, ExternalLink, Mail, PhoneCall, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Brand } from '../components/Brand';
import { universityContact } from '../services/supportContacts';

const questions = [
    ['I cannot sign in. What should I do?', 'Check your university email and password. Use Reset password below if you have forgotten it. If the service is temporarily unavailable, wait for your connection to return and retry. Do not share your password or email OTP with anyone.'],
    ['My verification email has not arrived.', 'Check your spam folder and confirm that the email address is correct. Allow a little time for delivery before requesting another OTP. If a request limit is shown, wait for the stated time before trying again.'],
    ['Why is my student account pending?', 'Email verification confirms ownership of your email, not approval for transport. A transport administrator must approve your account and assign your route and stop. Contact the transport office for approval or assignment changes.'],
    ['My account is approved, but I have no assigned bus.', 'Approval and route assignment are separate. The transport office must assign your route and pickup stop before your commute details are available. Do not create another account.'],
    ['How do drivers and conductors get accounts?', 'Transport administrators create staff accounts and assign their bus and route. Staff should contact the transport office for access or assignment corrections; student signup does not create a staff account.'],
    ['Why is the bus location or ETA unavailable?', 'Tracking begins when the driver starts the trip and the server receives a reliable GPS update. A weak signal, lost internet or a phone that stops sharing can delay updates. Check the last-updated time; an estimated arrival is not a guaranteed arrival time.'],
];

export function PublicHelpPage() {
    return <main className="privacy-page">
      <header className="privacy-header">
        <Brand />
        <nav className="privacy-header-actions" aria-label="Account navigation">
          <Link className="privacy-create-link" to="/signup">Create account</Link>
          <Link className="button button--secondary" to="/login">Sign in</Link>
        </nav>
      </header>
      <div className="public-help-content">
        <header className="public-help-heading">
          <h1>Account and transport help</h1>
          <p>Get help with access, approval and route assignments. You do not need to sign in to read this page.</p>
        </header>
        <div className="help-page-grid">
          <section className="faq-card">
            <div className="section-title-row"><h2>Common questions</h2><CircleHelp /></div>
            {questions.map(([question, answer]) => <details key={question}><summary>{question}<ChevronRight /></summary><p>{answer}</p></details>)}
          </section>
          <aside>
            <section className="help-contact-card">
              <div className="section-title-row"><h2>University contact</h2></div>
              <p>Ask the university help desk to connect you with the transport office. Email is for non-urgent assistance.</p>
              <a href={universityContact.phoneHref}><span className="app-icon"><PhoneCall /></span><span><small>University help desk</small><strong>{universityContact.phone}</strong></span></a>
              <a href={`mailto:${universityContact.email}`}><span className="app-icon"><Mail /></span><span><small>University email</small><strong>{universityContact.email}</strong></span></a>
              <a href={universityContact.url} target="_blank" rel="noreferrer"><span className="app-icon"><ExternalLink /></span><span>Official contact details</span></a>
            </section>
            <section className="help-safety-card"><ShieldCheck /><h2>Account recovery</h2><p>Reset your SmartTransit password using the OTP sent to your university email.</p><Link className="button button--secondary" to="/forgot-password">Reset password</Link></section>
          </aside>
        </div>
      </div>
      <footer className="privacy-footer"><Link to="/">Return to homepage</Link><Link to="/privacy">Privacy information</Link></footer>
    </main>;
}
