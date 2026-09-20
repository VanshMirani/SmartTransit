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
import { ComplaintsPage } from "./pages/student/ComplaintsPage";
import { HelpPage } from "./pages/student/HelpPage";
import { NotificationsPage } from "./pages/student/NotificationsPage";
import { ProfilePage } from "./pages/student/ProfilePage";
import { RoutesPage } from "./pages/student/RoutesPage";
import { StudentDashboardPage } from "./pages/student/StudentDashboardPage";
import { DriverChecklistPage } from "./pages/driver/DriverChecklistPage";
import { DriverEmergencyPage } from "./pages/driver/DriverEmergencyPage";
import { DriverHistoryPage } from "./pages/driver/DriverHistoryPage";
import { DriverHomePage } from "./pages/driver/DriverHomePage";
import { DriverProfilePage } from "./pages/driver/DriverProfilePage";
import { ConductorEmergencyPage } from "./pages/conductor/ConductorEmergencyPage";
import { ConductorHistoryPage } from "./pages/conductor/ConductorHistoryPage";
import { ConductorHomePage } from "./pages/conductor/ConductorHomePage";
import { ConductorProfilePage } from "./pages/conductor/ConductorProfilePage";
import { ConductorTripPage } from "./pages/conductor/ConductorTripPage";
import { AdminDataProvider } from "./admin/AdminDataContext";
import { AdminLayout } from "./components/admin/AdminLayout";
import { ManagementPage } from "./components/admin/ManagementPage";
import { AdminAssignmentsPage } from "./pages/admin/AdminAssignmentsPage";
import { AdminComplaintsPage } from "./pages/admin/AdminComplaintsPage";
import { AdminNotificationsPage } from "./pages/admin/AdminNotificationsPage";
import { AdminSettingsPage } from "./pages/admin/AdminSettingsPage";
import { AdminSystemStatesPage } from "./pages/admin/AdminSystemStatesPage";
import { AdminGlobalSearchPage } from "./pages/admin/AdminGlobalSearchPage";
const LiveTrackingPage = lazy(() => import('./pages/student/LiveTrackingPage').then((module) => ({ default: module.LiveTrackingPage })));
const DriverTripPage = lazy(() => import('./pages/driver/DriverTripPage').then((module) => ({ default: module.DriverTripPage })));
const AdminLiveOperationsPage = lazy(() => import('./pages/admin/AdminLiveOperationsPage').then((module) => ({ default: module.AdminLiveOperationsPage })));
const AdminOverviewPage = lazy(() => import('./pages/admin/AdminOverviewPage').then((module) => ({ default: module.AdminOverviewPage })));
const AdminReportsPage = lazy(() => import('./pages/admin/AdminReportsPage').then((module) => ({ default: module.AdminReportsPage })));
const AdminRoutesPage = lazy(() => import('./pages/admin/AdminRoutesPage').then((module) => ({ default: module.AdminRoutesPage })));
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
        <Route index element={<StudentDashboardPage />}/>
        <Route path="track" element={<DeferredPage><LiveTrackingPage /></DeferredPage>}/>
        <Route path="routes" element={<RoutesPage />}/>
        <Route path="alerts" element={<NotificationsPage />}/>
        <Route path="complaints" element={<ComplaintsPage />}/>
        <Route path="profile" element={<ProfilePage />}/>
        <Route path="help" element={<HelpPage />}/>
      </Route>
      <Route path="/driver" element={<ProtectedRoute roles={["driver"]}>
            <DriverOperationsProvider>
              <StaffLayout role="driver"/>
            </DriverOperationsProvider>
          </ProtectedRoute>}>
        <Route index element={<DriverHomePage />}/>
        <Route path="checklist" element={<DriverChecklistPage />}/>
        <Route path="trip" element={<DeferredPage><DriverTripPage /></DeferredPage>}/>
        <Route path="emergency" element={<DriverEmergencyPage />}/>
        <Route path="history" element={<DriverHistoryPage />}/>
        <Route path="profile" element={<DriverProfilePage />}/>
      </Route>
      <Route path="/conductor" element={<ProtectedRoute roles={["conductor"]}>
            <ConductorOperationsProvider>
              <StaffLayout role="conductor"/>
            </ConductorOperationsProvider>
          </ProtectedRoute>}>
        <Route index element={<ConductorHomePage />}/>
        <Route path="trip" element={<ConductorTripPage />}/>
        <Route path="emergency" element={<ConductorEmergencyPage />}/>
        <Route path="history" element={<ConductorHistoryPage />}/>
        <Route path="profile" element={<ConductorProfilePage />}/>
      </Route>
      <Route path="/admin" element={<ProtectedRoute roles={["admin"]}>
            <AdminDataProvider>
              <AdminLayout />
            </AdminDataProvider>
          </ProtectedRoute>}>
        <Route index element={<DeferredPage><AdminOverviewPage /></DeferredPage>}/>
        <Route path="live" element={<DeferredPage><AdminLiveOperationsPage /></DeferredPage>}/>
        <Route path="buses" element={<ManagementPage kind="buses"/>}/>
        <Route path="routes" element={<DeferredPage><AdminRoutesPage /></DeferredPage>}/>
        <Route path="stops" element={<ManagementPage kind="stops"/>}/>
        <Route path="drivers" element={<ManagementPage kind="drivers"/>}/>
        <Route path="conductors" element={<ManagementPage kind="conductors"/>}/>
        <Route path="students" element={<ManagementPage kind="students"/>}/>
        <Route path="assignments" element={<AdminAssignmentsPage />}/>
        <Route path="notifications" element={<AdminNotificationsPage />}/>
        <Route path="complaints" element={<AdminComplaintsPage />}/>
        <Route path="reports" element={<DeferredPage><AdminReportsPage /></DeferredPage>}/>
        <Route path="settings" element={<AdminSettingsPage />}/>
        <Route path="settings/states" element={<AdminSystemStatesPage />}/>
        <Route path="search" element={<AdminGlobalSearchPage />}/>
      </Route>
      <Route path="*" element={<NotFoundPage />}/>
    </Routes>);
}
