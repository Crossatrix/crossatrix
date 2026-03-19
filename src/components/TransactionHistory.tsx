import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";

interface Transaction {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  created_at: string;
}

const transition = { type: "spring" as const, duration: 0.4, bounce: 0 };

export default function TransactionHistory({ userId }: { userId: string }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("croin_transactions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);

      setTransactions(data ?? []);
      setLoading(false);
    };
    load();
  }, [userId]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...transition, delay: 0.25 }}
      className="p-6 rounded-2xl border border-border bg-card shadow-vault"
    >
      <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-4">
        Transaction History
      </h2>

      {loading ? (
        <div className="flex justify-center py-6">
          <div className="h-2 w-2 rounded-full bg-primary glow-primary animate-pulse" />
        </div>
      ) : transactions.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          No transactions yet
        </p>
      ) : (
        <div className="space-y-3">
          {transactions.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center justify-between py-2 border-b border-border last:border-0"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    tx.type === "credit"
                      ? "bg-green-500/10 text-green-500"
                      : "bg-destructive/10 text-destructive"
                  }`}
                >
                  {tx.type === "credit" ? "+" : "−"}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {tx.description || (tx.type === "credit" ? "Credit" : "Debit")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(tx.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
              <span
                className={`text-sm font-mono font-semibold ${
                  tx.type === "credit" ? "text-green-500" : "text-destructive"
                }`}
              >
                {tx.type === "credit" ? "+" : "−"}¢{tx.amount.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
