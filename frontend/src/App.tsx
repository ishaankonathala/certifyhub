import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { Dashboard } from './pages/Dashboard'
import { GenerateCertificates } from './pages/GenerateCertificates'
import { JobDetail } from './pages/JobDetail'
import { JobsHistory } from './pages/JobsHistory'
import { Templates } from './pages/Templates'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="generate" element={<GenerateCertificates />} />
          <Route path="jobs" element={<JobsHistory />} />
          <Route path="jobs/:jobId" element={<JobDetail />} />
          <Route path="templates" element={<Templates />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
