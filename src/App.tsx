import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AuthPage from "./pages/AuthPage";
import Dashboard from "./pages/Dashboard";
import TroublePage from "./pages/TroublePage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import BugPage from "./pages/BugPage";
import BugAppsPage from "./pages/BugAppsPage";
import BugReportsPage from "./pages/BugReportsPage";
import NewsPage from "./pages/NewsPage";
import NotFound from "./pages/NotFound";
import PwaInstallBanner from "./components/PwaInstallBanner";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AuthPage />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/trouble" element={<TroublePage />} />
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
          <Route path="*" element={<NotFound />} />
        </Routes>
        <PwaInstallBanner />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
