import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BalanceNotificationsProps {
  userId: string;
  onBalanceChange?: () => void;
}

export default function BalanceNotifications({ userId, onBalanceChange }: BalanceNotificationsProps) {
  const [enabled, setEnabled] = useState(() => {
    return localStorage.getItem("croin-notifications") === "true";
  });
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );

  // Subscribe to wallet changes when enabled
  useEffect(() => {
    if (!enabled || permission !== "granted") return;

    const channel = supabase
      .channel(`wallet-notify-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "wallets",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const oldBalance = (payload.old as any)?.balance;
          const newBalance = (payload.new as any)?.balance;
          if (oldBalance !== undefined && newBalance !== undefined && oldBalance !== newBalance) {
            const diff = newBalance - oldBalance;
            const sign = diff > 0 ? "+" : "";
            new Notification("Croins Balance Updated", {
              body: `Your balance changed by ${sign}${diff.toLocaleString()} Croins.\nNew balance: ¢${newBalance.toLocaleString()}`,
              icon: "/pwa-icon-192.png",
            });
            onBalanceChange?.();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, permission, userId, onBalanceChange]);

  const toggleNotifications = async () => {
    if (typeof Notification === "undefined") {
      toast.error("Notifications are not supported in this browser");
      return;
    }

    if (!enabled) {
      // Enable
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm === "granted") {
        setEnabled(true);
        localStorage.setItem("croin-notifications", "true");
        toast.success("Balance notifications enabled");
      } else {
        toast.error("Notification permission denied");
      }
    } else {
      // Disable
      setEnabled(false);
      localStorage.setItem("croin-notifications", "false");
      toast("Balance notifications disabled");
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleNotifications}
      className={enabled && permission === "granted" ? "text-primary" : "text-muted-foreground"}
      title={enabled ? "Disable balance notifications" : "Enable balance notifications"}
    >
      {enabled && permission === "granted" ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
    </Button>
  );
}
