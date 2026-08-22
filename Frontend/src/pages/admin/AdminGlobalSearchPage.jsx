import { BusFront, MapPinned, Route, Search, Users } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useAdminData } from "../../admin/AdminDataContext";
import { AdminPageHeading, AdminStatusBadge, } from "../../components/admin/AdminUI";
const entityConfig = {
    buses: { label: "Bus", path: "/admin/buses", icon: BusFront },
    drivers: { label: "Driver", path: "/admin/drivers", icon: Users },
    conductors: { label: "Conductor", path: "/admin/conductors", icon: Users },
    students: { label: "Student", path: "/admin/students", icon: Users },
    stops: { label: "Stop", path: "/admin/stops", icon: MapPinned },
};
export function AdminGlobalSearchPage() {
    const [params] = useSearchParams();
    const query = params.get("q")?.trim() ?? "";
    const normalized = query.toLowerCase();
    const { records, routes } = useAdminData();
    const entityResults = Object.keys(records).flatMap((kind) => records[kind]
        .filter((item) => `${item.name} ${item.code} ${item.detail} ${item.contact} ${item.assignment}`
        .toLowerCase()
        .includes(normalized))
        .map((item) => ({ kind, item })));
    const routeResults = routes.filter((item) => `${item.code} ${item.name} ${item.startPoint} ${item.destination}`
        .toLowerCase()
        .includes(normalized));
    const total = entityResults.length + routeResults.length;
    return (<div>
      <AdminPageHeading eyebrow="Operations search" title={query ? `Results for “${query}”` : "Search SmartTransit"} description={query
            ? `${total} matching transport records.`
            : "Search buses, routes, stops, students and operating staff from the top bar."}/>
      {!query ? (<section className="admin-search-state">
          <Search />
          <h2>Enter a search above</h2>
          <p>
            Try a bus number, route code, person’s name, stop or assignment.
          </p>
        </section>) : total === 0 ? (<section className="admin-search-state" role="status">
          <Search />
          <h2>No matching records</h2>
          <p>Check the spelling or try a broader transport term.</p>
        </section>) : (<section className="admin-search-results" aria-label="Global search results">
          {routeResults.map((routeItem) => (<Link key={routeItem.id} to="/admin/routes">
              <span className="admin-kpi-icon">
                <Route />
              </span>
              <span>
                <small>Route · {routeItem.code}</small>
                <strong>{routeItem.name}</strong>
                <em>
                  {routeItem.startPoint} to {routeItem.destination}
                </em>
              </span>
              <AdminStatusBadge status={routeItem.status}/>
            </Link>))}
          {entityResults.map(({ kind, item }) => {
                const config = entityConfig[kind];
                const Icon = config.icon;
                return (<Link key={`${kind}-${item.id}`} to={`${config.path}?search=${encodeURIComponent(item.code)}`}>
                <span className="admin-kpi-icon">
                  <Icon />
                </span>
                <span>
                  <small>
                    {config.label} · {item.code}
                  </small>
                  <strong>{item.name}</strong>
                  <em>{item.assignment}</em>
                </span>
                <AdminStatusBadge status={item.status}/>
              </Link>);
            })}
        </section>)}
    </div>);
}
