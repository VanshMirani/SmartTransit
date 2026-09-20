import { Ambulance, BusFront, ChevronRight, CircleHelp, Mail, MapPin, PhoneCall, ShieldAlert, ShieldCheck, TriangleAlert } from 'lucide-react';
import { PageHeading } from '../../components/student/StudentUI';
import { useStudentData } from '../../hooks/useStudentData';

export function HelpPage() {
    const { data } = useStudentData();
    const transit = data ?? { assignmentStatus: "unassigned", route: {}, bus: {} };
    const { bus, route } = transit;
    const assignmentPending = data?.assignmentStatus === "unassigned" || !route?.code || !route?.stops?.length;
    const selectedStop = assignmentPending ? null : route.stops.find((stop) => stop.id === route.selectedStopId) ?? route.stops[0];

    return <div><PageHeading eyebrow="Support & safety" title="Help and emergency" description="Get transport support or reach emergency services quickly."/>
    <div className="emergency-banner"><span><ShieldAlert /></span><div><small>Emergency assistance</small><h2>If you are in immediate danger, call emergency services.</h2><p>Share your bus number, route and current location when possible.</p></div><a className="button" href="tel:112"><PhoneCall /> Call 112</a></div>
    <div className="help-page-grid"><section className="help-contact-card"><div className="section-title-row"><div><h2>Important contacts</h2><p>Indus University transport and safety support</p></div></div><a href="tel:+919924260900"><span className="app-icon"><BusFront /></span><span><small>Transport provider</small><strong>+91 99242 60900</strong><em>Naitik Travels (university handbook)</em></span><PhoneCall /></a><a href="tel:+912764350999"><span className="app-icon app-icon--gold"><ShieldCheck /></span><span><small>University help desk</small><strong>+91 2764 350999</strong><em>Ask for campus safety or transport assistance</em></span><PhoneCall /></a><a href="tel:108"><span className="app-icon app-icon--red"><Ambulance /></span><span><small>Medical emergency</small><strong>108</strong><em>Government ambulance service</em></span><PhoneCall /></a><a href="mailto:info@indusuni.ac.in"><span className="app-icon"><Mail /></span><span><small>University email</small><strong>info@indusuni.ac.in</strong><em>For non-urgent assistance</em></span><ChevronRight /></a></section>
      <aside><section className="help-safety-card"><TriangleAlert /><h3>Before reporting an emergency</h3><ul><li>Move to a safe place if possible.</li><li>Note your bus number and route if assigned.</li><li>Share your nearest stop or landmark.</li><li>Follow instructions from campus security.</li></ul></section><section className="help-safety-card"><MapPin /><h3>Your trip details</h3><p><strong>Bus:</strong> {assignmentPending ? "Pending assignment" : `${bus.number} · ${bus.registration}`}</p><p><strong>Route:</strong> {assignmentPending ? "Pending assignment" : route.code}</p><p><strong>Pickup:</strong> {assignmentPending ? "To be assigned by transport office" : selectedStop.name}</p></section></aside>
    </div>
    <section className="faq-card"><div className="section-title-row"><div><h2>Frequently asked questions</h2><p>Quick answers for common commute concerns</p></div><CircleHelp /></div>{['Why is my bus location not updating?', 'How is seat availability calculated?', 'What should I do if my route changes?', 'How do I update my assigned stop?'].map((question) => <details key={question}><summary>{question}<ChevronRight /></summary><p>SmartTransit shows the latest verified information from transport staff. For assignment changes, contact the transport office using the details above.</p></details>)}</section>
  </div>;
}
