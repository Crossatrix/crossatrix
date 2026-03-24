import { useState, useEffect } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const PwaInstallBanner = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
  };

  if (!deferredPrompt || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-card p-3 shadow-lg shadow-primary/10 backdrop-blur-sm">
        <img src="/icon-192.png" alt="Crossatrix" className="h-10 w-10 rounded-lg" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Install Crossatrix</p>
          <p className="text-xs text-muted-foreground truncate">Add to home screen for the best experience</p>
        </div>
        <Button size="sm" onClick={handleInstall} className="shrink-0 gap-1.5">
          <Download className="h-3.5 w-3.5" />
          Install
        </Button>
        <button onClick={() => setDismissed(true)} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default PwaInstallBanner;
