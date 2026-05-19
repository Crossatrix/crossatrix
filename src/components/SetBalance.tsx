import { useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const ADMIN_EMAILS = [
  "ben.froehleke@gmx.de",
];

interface SetBalanceProps {
  userId: string;
  userEmail?: string;
  onBalanceSet: () => void;
}

export default function SetBalance({ userId, userEmail, onBalanceSet }: SetBalanceProps) {
  const [newBalance, setNewBalance] = useState("");
  const [setting, setSetting] = useState(false);

  if (!userEmail || !ADMIN_EMAILS.includes(userEmail.toLowerCase())) {
    return null;
  }

  const handleSetBalance = async () => {
    const amount = parseInt(newBalance, 10);
    if (isNaN(amount) || amount < 0) {
      toast.error("Please enter a valid balance (0 or more)");
      return;
    }

    setSetting(true);
    try {
      const { data, error } = await supabase.functions.invoke("croins", {
        body: { action: "set", user_id: userId, amount },
      });
      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "Failed");
      }
      toast.success(`Balance set to ¢${amount.toLocaleString()}`);
      setNewBalance("");
      onBalanceSet();
    } catch (e: any) {
      toast.error(e.message || "Failed to set balance");
    } finally {
      setSetting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", duration: 0.4, bounce: 0 }}
      className="mt-6 p-6 rounded-2xl border border-destructive/30 bg-destructive/5 shadow-vault space-y-4"
    >
      <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
        ⚡ Admin — Set Your Balance
      </p>
      <div className="flex gap-3">
        <Input
          type="number"
          min="0"
          placeholder="New balance"
          value={newBalance}
          onChange={(e) => setNewBalance(e.target.value)}
          className="flex-1"
        />
        <Button
          variant="destructive"
          onClick={handleSetBalance}
          disabled={setting || !newBalance}
        >
          {setting ? "Setting…" : "Set"}
        </Button>
      </div>
    </motion.div>
  );
}
