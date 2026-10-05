import { Navigate, Route, Routes } from 'react-router-dom'

import { AvailabilityPage } from '@/routes/availability'
import { PublicFeedbackPage } from '@/routes/feedback'
import { FeedbackPage, FeedbackDetailPage } from '@/admin/feedback-page'
import { PublicLayout } from '@/public/layout'
import {
  HomePage,
  PublicCatalog,
  FaqPage,
  ContactPage,
  NotFoundPage,
} from '@/public/pages'
import { AdminPage } from '@/routes/admin'
import { LoginPage } from '@/routes/login'
import { CatalogPage } from '@/admin/catalog-page'
import { HoursPage } from '@/admin/hours-page'
import { ClientsPage, ClientProfilePage, ClientFormPage } from '@/admin/clients-page'
import {
  AppointmentsPage,
  AppointmentDetailPage,
  AppointmentFormPage,
} from '@/admin/appointments/pages'
import { AppointmentCompletePage } from '@/admin/appointments/complete-page'
import { ProductsPage, ProductDetailPage, ProductFormPage } from '@/admin/products-page'
import { AdminLayout, MorePage } from '@/admin/layout'
import { DashboardPage } from '@/admin/dashboard'
export function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/services" element={<PublicCatalog key="services" resource="services" />} />
        <Route path="/products" element={<PublicCatalog key="products" resource="products" />} />
        <Route path="/gallery" element={<Navigate to="/" replace />} />
        <Route path="/faq" element={<FaqPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="*" element={<NotFoundPage />} />
        <Route path="/availability" element={<AvailabilityPage />} />
        <Route path="/feedback" element={<PublicFeedbackPage />} />
      </Route>
      <Route
        path="/login"
        element={
          <main>
            <LoginPage />
          </main>
        }
      />
      <Route element={<AdminLayout />}>
        <Route path="/admin/more" element={<MorePage />} />
        <Route path="/admin/access" element={<AdminPage />} />
        <Route path="/admin/feedback" element={<FeedbackPage />} />
        <Route path="/admin/feedback/:feedbackId" element={<FeedbackDetailPage />} />
        <Route path="/admin/products" element={<ProductsPage />} />
        <Route path="/admin/inventory" element={<ProductsPage inventory />} />
        <Route path="/admin/products/new" element={<ProductFormPage />} />
        <Route path="/admin/products/:productId" element={<ProductDetailPage />} />
        <Route path="/admin/products/:productId/edit" element={<ProductFormPage />} />
        <Route path="/admin" element={<DashboardPage />} />
        <Route
          path="/admin/services"
          element={<CatalogPage key="services" resource="services" />}
        />
        <Route
          path="/admin/hairdressers"
          element={<CatalogPage key="barbers" resource="barbers" />}
        />
        <Route path="/admin/barbers" element={<Navigate to="/admin/hairdressers" replace />} />
        <Route path="/admin/business-hours" element={<HoursPage />} />
        <Route path="/admin/clients" element={<ClientsPage />} />
        <Route path="/admin/clients/new" element={<ClientFormPage />} />
        <Route path="/admin/clients/:clientId" element={<ClientProfilePage />} />
        <Route path="/admin/clients/:clientId/edit" element={<ClientFormPage />} />
        <Route path="/admin/appointments" element={<AppointmentsPage />} />
        <Route path="/admin/appointments/new" element={<AppointmentFormPage />} />
        <Route path="/admin/appointments/:appointmentId" element={<AppointmentDetailPage />} />
        <Route path="/admin/appointments/:appointmentId/edit" element={<AppointmentFormPage />} />
        <Route
          path="/admin/appointments/:appointmentId/complete"
          element={<AppointmentCompletePage />}
        />
        <Route path="/admin/*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
