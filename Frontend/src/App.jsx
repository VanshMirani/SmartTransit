import { lazy } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { DeferredPage } from './components/DeferredPage';
import { backendConfig } from './services/apiClient';
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { StudentEntryRedirect } from "./auth/StudentEntryRedirect";
import { StudentLayout } from "./components/student/StudentLayout";
import { StaffLayout } from "./components/staff/StaffLayout";
import { ConductorOperationsProvider, DriverOperationsProvider, } from "./operations/OperationsContext";
import { HomePage } from "./pages/HomePage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { PublicHelpPage } from './pages/PublicHelpPage';
import { ForgotPasswordPage } from "./pages/auth/ForgotPasswordPage";
import { LoginPage } from "./pages/auth/LoginPage";
import { SignupPage } from "./pages/auth/SignupPage";
import { UnauthorizedPage } from "./pages/auth/UnauthorizedPage";
import { AdminDataProvider } from "./admin/AdminDataContext";
import { AdminLayout } from "./components/admin/AdminLayout";
const ComplaintsPage = lazy(() => import("./pages/student/ComplaintsPage").then((module) => ({ default: module.ComplaintsPage })));
const HelpPage = lazy(() => import("./pages/student/HelpPage").then((module) => ({ default: module.HelpPage })));
const NotificationsPage = lazy(() => import("./pages/student/NotificationsPage").then((module) => ({ default: module.NotificationsPage })));
const ProfilePage = lazy(() => import("./pages/student/ProfilePage").then((module) => ({ default: module.ProfilePage })));
const RoutesPage = lazy(() => import("./pages/student/RoutesPage").then((module) => ({ default: module.RoutesPage })));
const StudentDashboardPage = lazy(() => import("./pages/student/StudentDashboardPage").then((module) => ({ default: module.StudentDashboardPage })));
const DriverChecklistPage = lazy(() => import("./pages/driver/DriverChecklistPage").then((module) => ({ default: module.DriverChecklistPage })));
const DriverEmergencyPage = lazy(() => import("./pages/driver/DriverEmergencyPage").then((module) => ({ default: module.DriverEmergencyPage })));
const DriverHistoryPage = lazy(() => import("./pages/driver/DriverHistoryPage").then((module) => ({ default: module.DriverHistoryPage })));
const DriverHomePage = lazy(() => import("./pages/driver/DriverHomePage").then((module) => ({ default: module.DriverHomePage })));
const DriverProfilePage = lazy(() => import("./pages/driver/DriverProfilePage").then((module) => ({ default: module.DriverProfilePage })));
const ConductorEmergencyPage = lazy(() => import("./pages/conductor/ConductorEmergencyPage").then((module) => ({ default: module.ConductorEmergencyPage })));
const ConductorHistoryPage = lazy(() => import("./pages/conductor/ConductorHistoryPage").then((module) => ({ default: module.ConductorHistoryPage })));
const ConductorHomePage = lazy(() => import("./pages/conductor/ConductorHomePage").then((module) => ({ default: module.ConductorHomePage })));
const ConductorProfilePage = lazy(() => import("./pages/conductor/ConductorProfilePage").then((module) => ({ default: module.ConductorProfilePage })));
const ConductorTripPage = lazy(() => import("./pages/conductor/ConductorTripPage").then((module) => ({ default: module.ConductorTripPage })));
const ManagementPage = lazy(() => import("./components/admin/ManagementPage").then((module) => ({ default: module.ManagementPage })));
const AdminAssignmentsPage = lazy(() => import("./pages/admin/AdminAssignmentsPage").then((module) => ({ default: module.AdminAssignmentsPage })));
const AdminComplaintsPage = lazy(() => import("./pages/admin/AdminComplaintsPage").then((module) => ({ default: module.AdminComplaintsPage })));
const AdminNotificationsPage = lazy(() => import("./pages/admin/AdminNotificationsPage").then((module) => ({ default: module.AdminNotificationsPage })));
const AdminSettingsPage = lazy(() => import("./pages/admin/AdminSettingsPage").then((module) => ({ default: module.AdminSettingsPage })));
const AdminSystemStatesPage = lazy(() => import("./pages/admin/AdminSystemStatesPage").then((module) => ({ default: module.AdminSystemStatesPage })));
const AdminGlobalSearchPage = lazy(() => import("./pages/admin/AdminGlobalSearchPage").then((module) => ({ default: module.AdminGlobalSearchPage })));
const LiveTrackingPage = lazy(() => import('./pages/student/LiveTrackingPage').then((module) => ({ default: module.LiveTrackingPage })));
const DriverTripPage = lazy(() => import('./pages/driver/DriverTripPage').then((module) => ({ default: module.DriverTripPage })));
const AdminLiveOperationsPage = lazy(() => import('./pages/admin/AdminLiveOperationsPage').then((module) => ({ default: module.AdminLiveOperationsPage })));
const AdminOverviewPage = lazy(() => import('./pages/admin/AdminOverviewPage').then((module) => ({ default: module.AdminOverviewPage })));
const AdminReportsPage = lazy(() => import('./pages/admin/AdminReportsPage').then((module) => ({ default: module.AdminReportsPage })));
const AdminRoutesPage = lazy(() => import('./pages/admin/AdminRoutesPage').then((module) => ({ default: module.AdminRoutesPage })));
const AdminSimulatorPage = lazy(() => import('./pages/admin/AdminSimulatorPage').then((module) => ({ default: module.AdminSimulatorPage })));
export default function App() {
    const { pathname } = useLocation();
    if (backendConfig.configurationError && !['/help', '/privacy'].includes(pathname))
        return <main className="placeholder"><section className="placeholder__card" role="alert"><h1>Transport service unavailable</h1><p>{backendConfig.configurationError}</p><Link className="text-link" to="/help">Get account help</Link></section></main>;
    return (<Routes>
      <Route path="/" element={<HomePage />}/>
      <Route path="/track" element={<StudentEntryRedirect to="/student/track"/>}/>
      <Route path="/login" element={<LoginPage />}/>
      <Route path="/signin" element={<Navigate to="/login" replace/>}/>
      <Route path="/signup" element={<SignupPage />}/>
      <Route path="/forgot-password" element={<ForgotPasswordPage />}/>
      <Route path="/help" element={<PublicHelpPage />}/>
      <Route path="/privacy" element={<PrivacyPage />}/>
      <Route path="/unauthorized" element={<UnauthorizedPage />}/>
      <Route path="/student" element={<ProtectedRoute roles={["student"]}>
            <StudentLayout />
          </ProtectedRoute>}>
        <Route index element={<DeferredPage><StudentDashboardPage /></DeferredPage>}/>
        <Route path="track" element={<DeferredPage><LiveTrackingPage /></DeferredPage>}/>
        <Route path="routes" element={<DeferredPage><RoutesPage /></DeferredPage>}/>
        <Route path="alerts" element={<DeferredPage><NotificationsPage /></DeferredPage>}/>
        <Route path="complaints" element={<DeferredPage><ComplaintsPage /></DeferredPage>}/>
        <Route path="profile" element={<DeferredPage><ProfilePage /></DeferredPage>}/>
        <Route path="help" element={<DeferredPage><HelpPage /></DeferredPage>}/>
      </Route>
      <Route path="/driver" element={<ProtectedRoute roles={["driver"]}>
            <DriverOperationsProvider>
              <StaffLayout role="driver"/>
            </DriverOperationsProvider>
          </ProtectedRoute>}>
        <Route index element={<DeferredPage><DriverHomePage /></DeferredPage>}/>
        <Route path="checklist" element={<DeferredPage><DriverChecklistPage /></DeferredPage>}/>
        <Route path="trip" element={<DeferredPage><DriverTripPage /></DeferredPage>}/>
        <Route path="emergency" element={<DeferredPage><DriverEmergencyPage /></DeferredPage>}/>
        <Route path="history" element={<DeferredPage><DriverHistoryPage /></DeferredPage>}/>
        <Route path="profile" element={<DeferredPage><DriverProfilePage /></DeferredPage>}/>
      </Route>
      <Route path="/conductor" element={<ProtectedRoute roles={["conductor"]}>
            <ConductorOperationsProvider>
              <StaffLayout role="conductor"/>
            </ConductorOperationsProvider>
          </ProtectedRoute>}>
        <Route index element={<DeferredPage><ConductorHomePage /></DeferredPage>}/>
        <Route path="trip" element={<DeferredPage><ConductorTripPage /></DeferredPage>}/>
        <Route path="emergency" element={<DeferredPage><ConductorEmergencyPage /></DeferredPage>}/>
        <Route path="history" element={<DeferredPage><ConductorHistoryPage /></DeferredPage>}/>
        <Route path="profile" element={<DeferredPage><ConductorProfilePage /></DeferredPage>}/>
      </Route>
      <Route path="/admin" element={<ProtectedRoute roles={["admin"]}>
            <AdminDataProvider>
              <AdminLayout />
            </AdminDataProvider>
          </ProtectedRoute>}>
        <Route index element={<DeferredPage><AdminOverviewPage /></DeferredPage>}/>
        <Route path="live" element={<DeferredPage><AdminLiveOperationsPage /></DeferredPage>}/>
        <Route path="simulator" element={<DeferredPage><AdminSimulatorPage /></DeferredPage>}/>
        <Route path="buses" element={<DeferredPage><ManagementPage key="buses" kind="buses"/></DeferredPage>}/>
        <Route path="routes" element={<DeferredPage><AdminRoutesPage /></DeferredPage>}/>
        <Route path="stops" element={<DeferredPage><ManagementPage key="stops" kind="stops"/></DeferredPage>}/>
        <Route path="drivers" element={<DeferredPage><ManagementPage key="drivers" kind="drivers"/></DeferredPage>}/>
        <Route path="conductors" element={<DeferredPage><ManagementPage key="conductors" kind="conductors"/></DeferredPage>}/>
        <Route path="students" element={<DeferredPage><ManagementPage key="students" kind="students"/></DeferredPage>}/>
        <Route path="assignments" element={<DeferredPage><AdminAssignmentsPage /></DeferredPage>}/>
        <Route path="notifications" element={<DeferredPage><AdminNotificationsPage /></DeferredPage>}/>
        <Route path="complaints" element={<DeferredPage><AdminComplaintsPage /></DeferredPage>}/>
        <Route path="reports" element={<DeferredPage><AdminReportsPage /></DeferredPage>}/>
        <Route path="settings" element={<DeferredPage><AdminSettingsPage /></DeferredPage>}/>
        <Route path="settings/states" element={<DeferredPage><AdminSystemStatesPage /></DeferredPage>}/>
        <Route path="search" element={<DeferredPage><AdminGlobalSearchPage /></DeferredPage>}/>
      </Route>
      <Route path="*" element={<NotFoundPage />}/>
    </Routes>);
}
