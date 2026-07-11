import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "@/components/AppShell";
import ProtectedRoute from "@/components/ProtectedRoute";
import CharactersPage from "@/pages/CharactersPage";
import CostumesPage from "@/pages/CostumesPage";
import CreateProductionPage from "@/pages/CreateProductionPage";
import CueCategoriesPage from "@/pages/CueCategoriesPage";
import GroupsPage from "@/pages/GroupsPage";
import ImportPage from "@/pages/ImportPage";
import LoginPage from "@/pages/LoginPage";
import MicrophonesPage from "@/pages/MicrophonesPage";
import ProductionOverviewPage from "@/pages/ProductionOverviewPage";
import ProductionListPage from "@/pages/ProductionListPage";
import PropsPage from "@/pages/PropsPage";
import RehearsePage from "@/pages/RehearsePage";
import ReportsPage from "@/pages/ReportsPage";
import SetPiecesPage from "@/pages/SetPiecesPage";
import SettingsPage from "@/pages/SettingsPage";
import SongsPage from "@/pages/SongsPage";
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
          <Route path="productions/:id" element={<ProductionOverviewPage />} />
          <Route path="productions/:id/timeline" element={<TimelinePage />} />
          <Route path="productions/:id/rehearse" element={<RehearsePage />} />
          <Route path="productions/:id/characters" element={<CharactersPage />} />
          <Route path="productions/:id/songs" element={<SongsPage />} />
          <Route path="productions/:id/props" element={<PropsPage />} />
          <Route path="productions/:id/costumes" element={<CostumesPage />} />
          <Route path="productions/:id/microphones" element={<MicrophonesPage />} />
          <Route path="productions/:id/set-pieces" element={<SetPiecesPage />} />
          <Route path="productions/:id/cue-categories" element={<CueCategoriesPage />} />

          <Route element={<ProtectedRoute directorOnly />}>
            <Route path="productions/:id/groups" element={<GroupsPage />} />
            <Route path="productions/:id/reports" element={<ReportsPage />} />
          </Route>

          <Route element={<ProtectedRoute adminOnly />}>
            <Route path="productions/new" element={<CreateProductionPage />} />
            <Route path="productions/:id/import" element={<ImportPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/productions" replace />} />
    </Routes>
  );
}
