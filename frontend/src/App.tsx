import { Navigate, Route, Routes } from "react-router-dom";
import HomePage from "./pages/HomePage";
import LibraryPage from "./pages/LibraryPage";
import LoginPage from "./pages/LoginPage";
import ProjectsPage from "./pages/ProjectsPage";
import SettingsPage from "./pages/SettingsPage";
import StudioPage from "./pages/StudioPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/projects" element={<ProjectsPage />} />
      <Route path="/projects/:id" element={<StudioPage />} />
      <Route path="/library" element={<LibraryPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
