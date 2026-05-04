import { useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const ADMIN_EMAILS = [
  "cross.a.trix.owner@hotmail.com",
  "moritz.loeseke7@gmail.com",
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
      // Ensure wallet exists
      const { data: wallet } = await supabase
        .from("wallets")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (!wallet) {
        await supabase.from("wallets").insert({ user_id: userId, balance: amount });
      } else {
        await supabase
          .from("wallets")
          .update({ balance: amount, updated_at: new Date().toISOString() })
          .eq("user_id", userId);
      }

      toast.success(`Balance set to ¢${amount.toLocaleString()}`);
      setNewBalance("");
      onBalanceSet();
    } catch {
      toast.error("Failed to set balance");
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
