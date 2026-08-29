import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { StudentEntryRedirect } from "./auth/StudentEntryRedirect";
import { StudentLayout } from "./components/student/StudentLayout";
import { StaffLayout } from "./components/staff/StaffLayout";
import { ConductorOperationsProvider, DriverOperationsProvider, } from "./operations/OperationsContext";
import { HomePage } from "./pages/HomePage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { ForgotPasswordPage } from "./pages/auth/ForgotPasswordPage";
import { LoginPage } from "./pages/auth/LoginPage";
import { SignupPage } from "./pages/auth/SignupPage";
import { UnauthorizedPage } from "./pages/auth/UnauthorizedPage";
import { ComplaintsPage } from "./pages/student/ComplaintsPage";
import { HelpPage } from "./pages/student/HelpPage";
import { LiveTrackingPage } from "./pages/student/LiveTrackingPage";
import { NotificationsPage } from "./pages/student/NotificationsPage";
import { ProfilePage } from "./pages/student/ProfilePage";
import { RoutesPage } from "./pages/student/RoutesPage";
import { StudentDashboardPage } from "./pages/student/StudentDashboardPage";
import { DriverChecklistPage } from "./pages/driver/DriverChecklistPage";
import { DriverEmergencyPage } from "./pages/driver/DriverEmergencyPage";
import { DriverHistoryPage } from "./pages/driver/DriverHistoryPage";
import { DriverHomePage } from "./pages/driver/DriverHomePage";
import { DriverProfilePage } from "./pages/driver/DriverProfilePage";
import { DriverTripPage } from "./pages/driver/DriverTripPage";
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
import { AdminLiveOperationsPage } from "./pages/admin/AdminLiveOperationsPage";
import { AdminNotificationsPage } from "./pages/admin/AdminNotificationsPage";
import { AdminOverviewPage } from "./pages/admin/AdminOverviewPage";
import { AdminReportsPage } from "./pages/admin/AdminReportsPage";
import { AdminRoutesPage } from "./pages/admin/AdminRoutesPage";
import { AdminSettingsPage } from "./pages/admin/AdminSettingsPage";
import { AdminSystemStatesPage } from "./pages/admin/AdminSystemStatesPage";
import { AdminGlobalSearchPage } from "./pages/admin/AdminGlobalSearchPage";
export default function App() {
    return (<Routes>
      <Route path="/" element={<HomePage />}/>
      <Route path="/track" element={<StudentEntryRedirect to="/student/track"/>}/>
      <Route path="/login" element={<LoginPage />}/>
      <Route path="/signin" element={<Navigate to="/login" replace/>}/>
      <Route path="/signup" element={<SignupPage />}/>
      <Route path="/forgot-password" element={<ForgotPasswordPage />}/>
      <Route path="/help" element={<StudentEntryRedirect to="/student/help"/>}/>
      <Route path="/privacy" element={<PrivacyPage />}/>
      <Route path="/unauthorized" element={<UnauthorizedPage />}/>
      <Route path="/student" element={<ProtectedRoute roles={["student"]}>
            <StudentLayout />
          </ProtectedRoute>}>
        <Route index element={<StudentDashboardPage />}/>
        <Route path="track" element={<LiveTrackingPage />}/>
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
        <Route path="trip" element={<DriverTripPage />}/>
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
        <Route index element={<AdminOverviewPage />}/>
        <Route path="live" element={<AdminLiveOperationsPage />}/>
        <Route path="buses" element={<ManagementPage kind="buses"/>}/>
        <Route path="routes" element={<AdminRoutesPage />}/>
        <Route path="stops" element={<ManagementPage kind="stops"/>}/>
        <Route path="drivers" element={<ManagementPage kind="drivers"/>}/>
        <Route path="conductors" element={<ManagementPage kind="conductors"/>}/>
        <Route path="students" element={<ManagementPage kind="students"/>}/>
        <Route path="assignments" element={<AdminAssignmentsPage />}/>
        <Route path="notifications" element={<AdminNotificationsPage />}/>
        <Route path="complaints" element={<AdminComplaintsPage />}/>
        <Route path="reports" element={<AdminReportsPage />}/>
        <Route path="settings" element={<AdminSettingsPage />}/>
        <Route path="settings/states" element={<AdminSystemStatesPage />}/>
        <Route path="search" element={<AdminGlobalSearchPage />}/>
      </Route>
      <Route path="*" element={<NotFoundPage />}/>
    </Routes>);
}
