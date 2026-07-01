import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AuthPage from "./pages/AuthPage";
import Dashboard from "./pages/Dashboard";
import TroublePage from "./pages/TroublePage";
import SettingsPage from "./pages/SettingsPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import BugPage from "./pages/BugPage";
import BugAppsPage from "./pages/BugAppsPage";
import BugReportsPage from "./pages/BugReportsPage";
import NewsPage from "./pages/NewsPage";
import SharePage from "./pages/SharePage";
import InfoPage from "./pages/InfoPage";
import NewSchoolPage from "./pages/school/NewSchoolPage";
import TeacherPage from "./pages/school/TeacherPage";
import PrincipalPage from "./pages/school/PrincipalPage";
import SchoolsAdminPage from "./pages/school/SchoolsAdminPage";
import NotFound from "./pages/NotFound";
import PwaInstallBanner from "./components/PwaInstallBanner";
import SiteGate from "./components/SiteGate";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <SiteGate>
        <Routes>
          <Route path="/" element={<AuthPage />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/trouble" element={<TroublePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/bug" element={<BugPage />} />
          <Route path="/Bug" element={<BugPage />} />
          <Route path="/bugapps" element={<BugAppsPage />} />
          <Route path="/bugreports" element={<BugReportsPage />} />
          <Route path="/Bugreports" element={<BugReportsPage />} />
          <Route path="/BugReports" element={<BugReportsPage />} />
          <Route path="/bugReports" element={<BugReportsPage />} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/News" element={<NewsPage />} />
          <Route path="/share" element={<SharePage />} />
          <Route path="/Share" element={<SharePage />} />
          <Route path="/info" element={<InfoPage />} />
          <Route path="/Info" element={<InfoPage />} />
          <Route path="/school/new-school" element={<NewSchoolPage />} />
          <Route path="/school/teacher" element={<TeacherPage />} />
          <Route path="/school/principal" element={<PrincipalPage />} />
          <Route path="/school/admin" element={<SchoolsAdminPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </SiteGate>
        <PwaInstallBanner />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
