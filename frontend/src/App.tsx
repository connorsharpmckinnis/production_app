import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "@/components/AppShell";
import ProtectedRoute from "@/components/ProtectedRoute";
import CreateProductionPage from "@/pages/CreateProductionPage";
import ImportPage from "@/pages/ImportPage";
import LoginPage from "@/pages/LoginPage";
import ProductionListPage from "@/pages/ProductionListPage";
import TimelinePage from "@/pages/TimelinePage";
import UsersPage from "@/pages/UsersPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/productions" replace />} />
          <Route path="productions" element={<ProductionListPage />} />
          <Route path="productions/:id/timeline" element={<TimelinePage />} />

          <Route element={<ProtectedRoute adminOnly />}>
            <Route path="productions/new" element={<CreateProductionPage />} />
            <Route path="productions/:id/import" element={<ImportPage />} />
            <Route path="users" element={<UsersPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/productions" replace />} />
    </Routes>
  );
}
