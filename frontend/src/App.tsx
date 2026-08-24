import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "@/components/AppShell";
import ProtectedRoute from "@/components/ProtectedRoute";
import AboutPage from "@/pages/AboutPage";
import CharactersPage from "@/pages/CharactersPage";
import CostumesPage from "@/pages/CostumesPage";
import CreateProductionPage from "@/pages/CreateProductionPage";
import CueCategoriesPage from "@/pages/CueCategoriesPage";
import GroupsPage from "@/pages/GroupsPage";
import ImportPage from "@/pages/ImportPage";
import LavChartPage from "@/pages/LavChartPage";
import LoginPage from "@/pages/LoginPage";
import ProductionOverviewPage from "@/pages/ProductionOverviewPage";
import ProductionListPage from "@/pages/ProductionListPage";
import PropsPage from "@/pages/PropsPage";
import CallSheetPage from "@/pages/CallSheetPage";
import RehearsalDetailPage from "@/pages/RehearsalDetailPage";
import RehearsalsPage from "@/pages/RehearsalsPage";
import ReportsPage from "@/pages/ReportsPage";
import SetPiecesPage from "@/pages/SetPiecesPage";
import ComponentGalleryPage from "@/pages/ComponentGalleryPage";
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
          <Route path="about" element={<AboutPage />} />
          <Route path="productions" element={<ProductionListPage />} />
          <Route path="productions/:id" element={<ProductionOverviewPage />} />
          <Route path="productions/:id/timeline" element={<TimelinePage />} />
          <Route
            path="productions/:id/rehearse"
            element={<Navigate to="../timeline?rehearse=1" replace />}
          />
          <Route path="productions/:id/rehearsals" element={<RehearsalsPage />} />
          <Route
            path="productions/:id/rehearsals/:rehearsalId"
            element={<RehearsalDetailPage />}
          />
          <Route
            path="productions/:id/rehearsals/:rehearsalId/call-sheet"
            element={<CallSheetPage />}
          />
          <Route path="productions/:id/characters" element={<CharactersPage />} />
          <Route path="productions/:id/songs" element={<SongsPage />} />
          <Route path="productions/:id/props" element={<PropsPage />} />
          <Route path="productions/:id/costumes" element={<CostumesPage />} />
          <Route path="productions/:id/set-pieces" element={<SetPiecesPage />} />
          <Route path="productions/:id/cue-categories" element={<CueCategoriesPage />} />

          <Route element={<ProtectedRoute directorOnly />}>
            <Route path="productions/:id/groups" element={<GroupsPage />} />
            <Route path="productions/:id/lav-chart" element={<LavChartPage />} />
            <Route path="productions/:id/reports" element={<ReportsPage />} />
          </Route>

          <Route element={<ProtectedRoute adminOnly />}>
            <Route path="productions/new" element={<CreateProductionPage />} />
            <Route path="productions/:id/import" element={<ImportPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="dev/ui" element={<ComponentGalleryPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/productions" replace />} />
    </Routes>
  );
}
