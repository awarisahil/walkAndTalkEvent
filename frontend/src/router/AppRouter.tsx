import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import PublicLayout from "../layouts/PublicLayout";
import DashboardLayout from "../layouts/DashboardLayout";
import { RequireAdmin, RequireCustomer } from "./guards";
import LandingPage from "../pages/LandingPage";
import EventsPage from "../pages/EventsPage";
import EventDetailPage from "../pages/EventDetailPage";
import LoginPage from "../pages/LoginPage";
import ForgotPasswordPage from "../pages/ForgotPasswordPage";
import NotFoundPage from "../pages/NotFoundPage";
import OverviewPage from "../pages/dashboard/OverviewPage";
import RequestsPage from "../pages/dashboard/RequestsPage";
import RequestDetailPage from "../pages/dashboard/RequestDetailPage";
import AwaitingPaymentPage from "../pages/dashboard/AwaitingPaymentPage";
import PayRequestPage from "../pages/dashboard/PayRequestPage";
import PaymentsPage from "../pages/dashboard/PaymentsPage";
import PaymentDetailPage from "../pages/dashboard/PaymentDetailPage";
import TicketsPage from "../pages/dashboard/TicketsPage";
import TicketDetailPage from "../pages/dashboard/TicketDetailPage";
import ProfilePage from "../pages/dashboard/ProfilePage";
import AdminLayout from "../layouts/AdminLayout";
import AdminDashboardPage from "../pages/admin/AdminDashboardPage";
import AdminEventsPage from "../pages/admin/AdminEventsPage";
import { AdminEditEventPage, AdminNewEventPage } from "../pages/admin/EventFormPage";
import AdminEventDetailPage from "../pages/admin/AdminEventDetailPage";
import AdminAttendeesPage from "../pages/admin/AdminAttendeesPage";
import AdminRequestsPage from "../pages/admin/AdminRequestsPage";
import AdminPaymentsPage from "../pages/admin/AdminPaymentsPage";
import AdminCheckInPage from "../pages/admin/AdminCheckInPage";
import AdminCommunityPage from "../pages/admin/AdminCommunityPage";
import CommunityPage from "../pages/CommunityPage";
import InvitePayPage from "../pages/InvitePayPage";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/events/:id" element={<EventDetailPage />} />
          <Route path="/community" element={<CommunityPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        {/* Standalone invite payment page — opened from approval emails,
            intentionally outside the public layout (no navbar/footer). */}
        <Route path="/pay/:token" element={<InvitePayPage />} />

        <Route
          path="/dashboard"
          element={
            <RequireCustomer>
              <DashboardLayout />
            </RequireCustomer>
          }
        >
          <Route index element={<OverviewPage />} />
          <Route path="requests" element={<RequestsPage />} />
          <Route path="requests/payment-pending" element={<Navigate to="/dashboard/awaiting-payment" replace />} />
          <Route path="requests/:id" element={<RequestDetailPage />} />
          <Route path="requests/:id/pay" element={<PayRequestPage />} />
          <Route path="awaiting-payment" element={<AwaitingPaymentPage />} />
          <Route path="payments" element={<PaymentsPage />} />
          <Route path="payments/:id" element={<PaymentDetailPage />} />
          <Route path="tickets" element={<TicketsPage />} />
          <Route path="tickets/:id" element={<TicketDetailPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>

        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          }
        >
          <Route index element={<AdminDashboardPage />} />
          <Route path="events" element={<AdminEventsPage />} />
          <Route path="events/new" element={<AdminNewEventPage />} />
          <Route path="events/:id" element={<AdminEventDetailPage />} />
          <Route path="events/:id/edit" element={<AdminEditEventPage />} />
          <Route path="events/:id/attendees" element={<AdminAttendeesPage />} />
          <Route path="requests" element={<AdminRequestsPage />} />
          <Route path="payments" element={<AdminPaymentsPage />} />
          <Route path="check-in" element={<AdminCheckInPage />} />
          <Route path="community" element={<AdminCommunityPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
