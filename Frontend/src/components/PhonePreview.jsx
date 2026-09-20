import { Bell, BusFront, Clock3, MapPin, Navigation, Users } from 'lucide-react';
export function PhonePreview() {
    return (<div className="phone-wrap" aria-label="SmartTransit mobile application preview">
      <div className="route-orbit route-orbit--one"/>
      <div className="route-orbit route-orbit--two"/>
      <div className="phone">
        <div className="phone__top"><span>App preview</span><span>● ●●</span></div>
        <div className="phone__header"><span className="phone__logo"><BusFront /> SmartTransit</span><Bell /></div>
        <div className="phone__body">
          <p className="eyebrow">Student portal</p>
          <h3>Your daily commute</h3>
          <div className="mini-map">
            <div className="mini-map__road mini-map__road--one"/>
            <div className="mini-map__road mini-map__road--two"/>
            <span className="map-stop map-stop--a"/>
            <span className="map-stop map-stop--b"/>
            <span className="map-bus"><BusFront /></span>
            <span className="map-pin"><MapPin /></span>
          </div>
          <div className="bus-card">
            <div><span className="label">Assigned bus</span><strong>Your university bus</strong></div>
          </div>
          <div className="phone__stats">
            <div><Clock3 /><span>ETA</span><strong>-- min</strong></div>
            <div><Users /><span>Seats</span><strong>-- / --</strong></div>
          </div>
          <div className="next-stop"><Navigation /><span><small>Next stop</small> Your selected stop</span></div>
        </div>
        <div className="phone__nav"><span>Home</span><span>Track</span><span>Routes</span><span>Alerts</span></div>
      </div>
    </div>);
}
