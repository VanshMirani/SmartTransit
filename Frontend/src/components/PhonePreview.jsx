import { Bell, BusFront, Clock3, MapPin, Navigation, Users } from 'lucide-react';
import { formatTime } from '../utils/dateLabels';
export function PhonePreview() {
    return (<div className="phone-wrap" aria-label="SmartTransit mobile application preview">
      <div className="route-orbit route-orbit--one"/>
      <div className="route-orbit route-orbit--two"/>
      <div className="phone">
        <div className="phone__top"><span>{formatTime()}</span><span>● ●●</span></div>
        <div className="phone__header"><span className="phone__logo"><BusFront /> SmartTransit</span><Bell /></div>
        <div className="phone__body">
          <p className="eyebrow">Good morning, Aarav</p>
          <h3>Your bus is on the way</h3>
          <div className="mini-map">
            <div className="mini-map__road mini-map__road--one"/>
            <div className="mini-map__road mini-map__road--two"/>
            <span className="map-stop map-stop--a"/>
            <span className="map-stop map-stop--b"/>
            <span className="map-bus"><BusFront /></span>
            <span className="map-pin"><MapPin /></span>
          </div>
          <div className="bus-card">
            <div><span className="label">Assigned bus</span><strong>GJ-01-FT-9468</strong></div>
            <span className="status"><span /> On time</span>
          </div>
          <div className="phone__stats">
            <div><Clock3 /><span>ETA</span><strong>8 min</strong></div>
            <div><Users /><span>Seats</span><strong>17 / 50</strong></div>
          </div>
          <div className="next-stop"><Navigation /><span><small>Next stop</small> Shilaj Circle</span></div>
        </div>
        <div className="phone__nav"><span>Home</span><span>Track</span><span>Routes</span><span>Alerts</span></div>
      </div>
      <div className="live-pill"><span /> Live now</div>
    </div>);
}
