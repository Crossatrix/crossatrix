import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Share2, Copy, Check } from "lucide-react";
import { toast } from "sonner";

export default function ShareButton({ userId }: { userId: string }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/share?user=${userId}`;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join Crossatrix",
          text: "Join me on Crossatrix and I'll get 100 ¢!",
          url: link,
        });
        return;
      } catch {
        // fall through to copy
      }
    }
    await navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success("Invite link copied");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-6 p-4 rounded-2xl border border-border bg-card shadow-vault">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            Invite & Earn
          </p>
          <p className="text-sm text-foreground mt-1">
            Get <span className="text-primary font-semibold">100 ¢</span> per signup
          </p>
        </div>
        <Button onClick={handleShare} variant="signal" size="sm" className="h-10">
          {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
          Share
        </Button>
      </div>
      <button
        onClick={handleShare}
        className="w-full text-left text-xs font-mono text-muted-foreground bg-muted/20 px-3 py-2 rounded-lg truncate hover:text-foreground transition-brand flex items-center gap-2"
      >
        <Copy className="h-3 w-3 shrink-0" />
        <span className="truncate">{link}</span>
      </button>
    </div>
  );
}
