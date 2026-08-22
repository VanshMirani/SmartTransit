import { BarChart3, CalendarDays, Clock3, Download, FileBarChart, MessageSquareWarning, Route, SearchX, TrendingUp, Users, } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, } from "recharts";
import { AdminFeedback, AdminPageHeading, } from "../../components/admin/AdminUI";
import { useCommunications } from "../../communications/CommunicationsContext";
import { reportRouteOptions, routeReportRecords, summarizeRoutes, } from "../../services/reportData";
import { downloadCsv, downloadSimplePdf } from "../../utils/reportExport";
const reportTabs = [
    { value: "overview", label: "Overview" },
    { value: "delays", label: "Delays" },
    { value: "complaints", label: "Complaints" },
    { value: "route-usage", label: "Route usage" },
    { value: "on-time", label: "On-time performance" },
];
const formatDate = (value) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(`${value}T12:00:00`));
const complaintDate = (value) => {
    const match = value.match(/^(\d{1,2})\s+([A-Za-z]{3})(?:\s+(\d{4}))?/);
    if (!match)
        return "2026-08-21";
    const month = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
    ].indexOf(match[2]);
    return `${match[3] ?? "2026"}-${String(month + 1).padStart(2, "0")}-${match[1].padStart(2, "0")}`;
};
export function AdminReportsPage() {
    const { complaints } = useCommunications();
    const [view, setView] = useState("overview");
    const [routeFilter, setRouteFilter] = useState("all");
    const [dateRange, setDateRange] = useState("7-days");
    const [fromDate, setFromDate] = useState("2026-08-15");
    const [toDate, setToDate] = useState("2026-08-21");
    const [feedback, setFeedback] = useState(null);
    const filteredRecords = useMemo(() => routeReportRecords.filter((record) => record.date >= fromDate &&
        record.date <= toDate &&
        (routeFilter === "all" || record.routeCode === routeFilter)), [fromDate, routeFilter, toDate]);
    const routeSummaries = useMemo(() => summarizeRoutes(filteredRecords), [filteredRecords]);
    const filteredComplaints = useMemo(() => complaints.filter((complaint) => complaintDate(complaint.createdAt) >= fromDate &&
        complaintDate(complaint.createdAt) <= toDate &&
        (routeFilter === "all" || complaint.routeCode === routeFilter)), [complaints, fromDate, routeFilter, toDate]);
    const dailyData = useMemo(() => {
        const dates = new Map();
        filteredRecords.forEach((record) => {
            const current = dates.get(record.date) ?? {
                date: record.date,
                trips: 0,
                delayed: 0,
                onTime: 0,
                usage: 0,
            };
            current.trips += record.trips;
            current.delayed += record.delayedTrips;
            current.onTime += record.onTimeTrips;
            current.usage += record.studentJourneys;
            dates.set(record.date, current);
        });
        return [...dates.values()].map((day) => ({
            ...day,
            label: formatDate(day.date),
            onTimeRate: day.trips
                ? Math.round((day.onTime / day.trips) * 1000) / 10
                : 0,
        }));
    }, [filteredRecords]);
    const metrics = useMemo(() => {
        const trips = filteredRecords.reduce((sum, record) => sum + record.trips, 0);
        const onTimeTrips = filteredRecords.reduce((sum, record) => sum + record.onTimeTrips, 0);
        const delays = filteredRecords.reduce((sum, record) => sum + record.delayedTrips, 0);
        const delayMinutes = filteredRecords.reduce((sum, record) => sum + record.delayedTrips * record.averageDelayMinutes, 0);
        return {
            trips,
            onTimeRate: trips ? (onTimeTrips / trips) * 100 : 0,
            delays,
            averageDelay: delays ? delayMinutes / delays : 0,
            usage: filteredRecords.reduce((sum, record) => sum + record.studentJourneys, 0),
            openComplaints: filteredComplaints.filter((complaint) => complaint.status !== "resolved").length,
        };
    }, [filteredComplaints, filteredRecords]);
    const hasRows = view === "complaints"
        ? filteredComplaints.length > 0
        : filteredRecords.length > 0;
    const setPreset = (value) => {
        setDateRange(value);
        if (value === "7-days") {
            setFromDate("2026-08-15");
            setToDate("2026-08-21");
        }
        if (value === "14-days") {
            setFromDate("2026-08-08");
            setToDate("2026-08-21");
        }
    };
    const exportRows = () => {
        if (view === "complaints") {
            return {
                headers: ["Complaint ID", "Category", "Route", "Status", "Created"],
                rows: filteredComplaints.map((complaint) => [
                    complaint.id,
                    complaint.category,
                    complaint.routeCode,
                    complaint.status,
                    complaint.createdAt,
                ]),
            };
        }
        if (view === "delays") {
            return {
                headers: ["Date", "Route", "Delayed trips", "Average delay (minutes)"],
                rows: filteredRecords
                    .filter((record) => record.delayedTrips > 0)
                    .map((record) => [
                    record.date,
                    record.routeCode,
                    record.delayedTrips,
                    record.averageDelayMinutes,
                ]),
            };
        }
        return {
            headers: [
                "Route",
                "Trips",
                "On-time rate",
                "Delayed trips",
                "Average delay",
                "Student journeys",
            ],
            rows: routeSummaries.map((route) => [
                route.routeCode,
                route.trips,
                `${route.onTimeRate.toFixed(1)}%`,
                route.delayedTrips,
                `${route.averageDelayMinutes.toFixed(1)} min`,
                route.studentJourneys,
            ]),
        };
    };
    const handleExport = (kind) => {
        const exportData = exportRows();
        const label = reportTabs.find((tab) => tab.value === view)?.label ?? "Report";
        const filename = `smarttransit-${view}-${fromDate}-to-${toDate}`;
        try {
            if (kind === "csv") {
                downloadCsv(`${filename}.csv`, exportData.headers, exportData.rows);
            }
            else {
                downloadSimplePdf(`${filename}.pdf`, `SmartTransit - ${label}`, [
                    `Period: ${fromDate} to ${toDate}`,
                    `Route: ${routeFilter === "all" ? "All routes" : routeFilter}`,
                    "",
                    exportData.headers.join(" | "),
                    ...exportData.rows.map((row) => row.join(" | ")),
                ]);
            }
            setFeedback(`${label} ${kind.toUpperCase()} export downloaded.`);
        }
        catch {
            setFeedback("The report could not be exported. Please try again.");
        }
    };
    return (<div>
      <AdminPageHeading eyebrow="Analytics" title="Reports & performance" description="Compare delays, complaint trends, route usage and on-time performance." actions={<>
            <button className="button button--secondary" disabled={!hasRows} onClick={() => handleExport("csv")}>
              <Download /> Export CSV
            </button>
            <button className="button admin-primary-button" disabled={!hasRows} onClick={() => handleExport("pdf")}>
              <Download /> Export PDF
            </button>
          </>}/>

      {feedback && (<AdminFeedback type={feedback.includes("could not") ? "error" : "success"} title={feedback.includes("could not") ? "Export failed" : "Export ready"} message={feedback} dismiss={() => setFeedback(null)}/>)}

      <nav className="report-tabs" aria-label="Report type">
        {reportTabs.map((tab) => (<button key={tab.value} aria-pressed={view === tab.value} onClick={() => setView(tab.value)}>
            {tab.label}
          </button>))}
      </nav>

      <section className="report-filter-bar" aria-label="Report filters">
        <label>
          <span>Date range</span>
          <span className="report-filter-control">
            <CalendarDays />
            <select aria-label="Report date range" value={dateRange} onChange={(event) => setPreset(event.target.value)}>
              <option value="7-days">Last 7 days</option>
              <option value="14-days">Last 14 days</option>
              <option value="custom">Custom range</option>
            </select>
          </span>
        </label>
        <label>
          <span>From</span>
          <input type="date" value={fromDate} max={toDate} onChange={(event) => {
            setFromDate(event.target.value);
            setDateRange("custom");
        }}/>
        </label>
        <label>
          <span>To</span>
          <input type="date" value={toDate} min={fromDate} onChange={(event) => {
            setToDate(event.target.value);
            setDateRange("custom");
        }}/>
        </label>
        <label>
          <span>Route</span>
          <span className="report-filter-control">
            <Route />
            <select aria-label="Report route" value={routeFilter} onChange={(event) => setRouteFilter(event.target.value)}>
              {reportRouteOptions.map((route) => (<option key={route.value} value={route.value}>
                  {route.label}
                </option>))}
            </select>
          </span>
        </label>
      </section>

      <section className="admin-kpi-grid report-kpis" aria-label="Report KPIs">
        <article>
          <span className="admin-kpi-icon">
            <BarChart3 />
          </span>
          <div>
            <small>Total trips</small>
            <strong>{metrics.trips}</strong>
            <em>selected period</em>
          </div>
        </article>
        <article>
          <span className="admin-kpi-icon admin-kpi-icon--green">
            <TrendingUp />
          </span>
          <div>
            <small>On-time rate</small>
            <strong>{metrics.onTimeRate.toFixed(1)}%</strong>
            <em>of completed trips</em>
          </div>
        </article>
        <article>
          <span className="admin-kpi-icon admin-kpi-icon--gold">
            <Clock3 />
          </span>
          <div>
            <small>Delays</small>
            <strong>{metrics.delays}</strong>
            <em>{metrics.averageDelay.toFixed(1)} min average</em>
          </div>
        </article>
        <article>
          <span className="admin-kpi-icon">
            <Users />
          </span>
          <div>
            <small>Route usage</small>
            <strong>{metrics.usage.toLocaleString("en-IN")}</strong>
            <em>student journeys</em>
          </div>
        </article>
        <article>
          <span className="admin-kpi-icon admin-kpi-icon--red">
            <MessageSquareWarning />
          </span>
          <div>
            <small>Open complaints</small>
            <strong>{metrics.openComplaints}</strong>
            <em>new or in progress</em>
          </div>
        </article>
      </section>

      {filteredRecords.length > 0 ? (<div className="admin-report-grid">
          <section className="admin-panel chart-panel">
            <div className="admin-panel-title">
              <div>
                <h2>Operating performance</h2>
                <p>Daily trips, delays and on-time rate</p>
              </div>
            </div>
            <div className="report-chart" aria-label="Daily operating performance chart">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyData} margin={{ left: -18, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4ebf1"/>
                  <XAxis dataKey="label" tick={{ fontSize: 11 }}/>
                  <YAxis tick={{ fontSize: 11 }}/>
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="trips" name="Trips" stroke="#0b948f" strokeWidth={3}/>
                  <Line type="monotone" dataKey="delayed" name="Delayed" stroke="#d48a1f" strokeWidth={2}/>
                  <Line type="monotone" dataKey="onTimeRate" name="On-time %" stroke="#244f73" strokeWidth={2}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
          <section className="admin-panel chart-panel">
            <div className="admin-panel-title">
              <div>
                <h2>Student route usage</h2>
                <p>Journeys recorded each day</p>
              </div>
            </div>
            <div className="report-chart" aria-label="Student route usage chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData} margin={{ left: -10, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4ebf1"/>
                  <XAxis dataKey="label" tick={{ fontSize: 11 }}/>
                  <YAxis tick={{ fontSize: 11 }}/>
                  <Tooltip />
                  <Bar dataKey="usage" name="Student journeys" fill="#16a6a1" radius={[5, 5, 0, 0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>) : (<section className="report-empty" role="status">
          <SearchX />
          <h2>No report data found</h2>
          <p>Try another route or extend the selected date range.</p>
          <button className="button button--secondary" onClick={() => {
                setRouteFilter("all");
                setPreset("7-days");
            }}>
            Clear filters
          </button>
        </section>)}

      <ReportTable view={view} records={filteredRecords} complaints={filteredComplaints}/>
    </div>);
}
function ReportTable({ view, records, complaints, }) {
    const summaries = useMemo(() => summarizeRoutes(records), [records]);
    if (view === "complaints") {
        return (<section className="admin-table-card report-table-card">
        <header>
          <div>
            <h2>Complaint report</h2>
            <p>Cases linked to the selected route</p>
          </div>
        </header>
        {complaints.length ? (<div className="admin-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Category</th>
                  <th>Route</th>
                  <th>Status</th>
                  <th>Assigned to</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {complaints.map((complaint) => (<tr key={complaint.id}>
                    <td>
                      <strong>{complaint.id}</strong>
                    </td>
                    <td>{complaint.category}</td>
                    <td>{complaint.routeCode}</td>
                    <td>{complaint.status.replace("-", " ")}</td>
                    <td>{complaint.assignedTo}</td>
                    <td>{complaint.createdAt}</td>
                  </tr>))}
              </tbody>
            </table>
          </div>) : (<div className="report-table-empty">
            <FileBarChart />
            <span>No complaint records match this route.</span>
          </div>)}
      </section>);
    }
    if (view === "delays") {
        const delayRows = records.filter((record) => record.delayedTrips > 0);
        return (<section className="admin-table-card report-table-card">
        <header>
          <div>
            <h2>Delay report</h2>
            <p>Trips that missed their scheduled arrival</p>
          </div>
        </header>
        {delayRows.length ? (<div className="admin-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Route</th>
                  <th>Trips</th>
                  <th>Delayed</th>
                  <th>Average delay</th>
                  <th>Journeys</th>
                </tr>
              </thead>
              <tbody>
                {delayRows.map((record) => (<tr key={`${record.date}-${record.routeCode}`}>
                    <td>{formatDate(record.date)}</td>
                    <td>
                      <strong>{record.routeCode}</strong>
                      <small>{record.routeName}</small>
                    </td>
                    <td>{record.trips}</td>
                    <td>{record.delayedTrips}</td>
                    <td>{record.averageDelayMinutes} min</td>
                    <td>{record.studentJourneys}</td>
                  </tr>))}
              </tbody>
            </table>
          </div>) : (<div className="report-table-empty">
            <TrendingUp />
            <span>No delayed trips in this period.</span>
          </div>)}
      </section>);
    }
    const heading = view === "route-usage"
        ? "Route-usage report"
        : view === "on-time"
            ? "On-time performance"
            : "Route performance summary";
    return (<section className="admin-table-card report-table-card">
      <header>
        <div>
          <h2>{heading}</h2>
          <p>Route-level totals for the selected period</p>
        </div>
      </header>
      {summaries.length ? (<div className="admin-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Route</th>
                <th>Total trips</th>
                <th>On-time</th>
                <th>Delayed</th>
                <th>Average delay</th>
                <th>Student journeys</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((route) => (<tr key={route.routeCode}>
                  <td>
                    <strong>{route.routeCode}</strong>
                    <small>{route.routeName}</small>
                  </td>
                  <td>{route.trips}</td>
                  <td>
                    <strong>{route.onTimeRate.toFixed(1)}%</strong>
                  </td>
                  <td>{route.delayedTrips}</td>
                  <td>{route.averageDelayMinutes.toFixed(1)} min</td>
                  <td>{route.studentJourneys.toLocaleString("en-IN")}</td>
                </tr>))}
            </tbody>
          </table>
        </div>) : (<div className="report-table-empty">
          <FileBarChart />
          <span>No route records match these filters.</span>
        </div>)}
    </section>);
}
