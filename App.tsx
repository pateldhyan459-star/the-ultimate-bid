import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import RequireAdmin from './components/RequireAdmin';
import Home from './pages/Home';
import Join from './pages/Join';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import AdminRoom from './pages/AdminRoom';
import Screen from './pages/Screen';
import Room from './pages/Room';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <Routes>
      {/* Full-screen projector view: no site header or footer. */}
      <Route element={<RequireAdmin />}>
        <Route path="admin/rooms/:id/screen" element={<Screen />} />
      </Route>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        {/* Invitation link: https://your-site/r/ABC234 */}
        <Route path="r/:code" element={<Join />} />
        <Route path="join" element={<Join />} />
        <Route path="room/:code" element={<Room />} />
        <Route path="admin/login" element={<AdminLogin />} />
        <Route element={<RequireAdmin />}>
          <Route path="admin" element={<AdminDashboard />} />
          <Route path="admin/rooms/:id" element={<AdminRoom />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
