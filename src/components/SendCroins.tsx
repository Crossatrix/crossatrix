import { useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Send } from "lucide-react";

interface SendCroinsProps {
  userId: string;
  onSent: () => void;
}

export default function SendCroins({ userId, onSent }: SendCroinsProps) {
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    const parsedAmount = parseInt(amount, 10);
    if (!email.trim()) {
      toast.error("Please enter a recipient email");
      return;
    }
    if (!parsedAmount || parsedAmount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setSending(true);
    const { data, error } = await supabase.functions.invoke("send-croins", {
      body: { recipient_email: email.trim(), amount: parsedAmount },
    });

    setSending(false);

    if (error || data?.error) {
      toast.error(data?.error || "Failed to send Croins");
      return;
    }

    toast.success(`Sent ¢${parsedAmount} to ${email.trim()}`);
    setEmail("");
    setAmount("");
    onSent();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", duration: 0.4, bounce: 0 }}
      className="mt-8 p-6 rounded-2xl border border-border bg-card shadow-vault space-y-4"
    >
      <div className="flex items-center gap-2 mb-2">
        <Send className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground">
          Send Croins
        </h2>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          Recipient Email
        </label>
        <Input
          type="email"
          placeholder="user@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          Amount
        </label>
        <Input
          type="number"
          min="1"
          step="1"
          placeholder="100"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>

      <Button
        variant="signal"
        className="w-full"
        onClick={handleSend}
        disabled={sending}
      >
        {sending ? "Sending…" : "Send Croins"}
      </Button>
    </motion.div>
  );
}
