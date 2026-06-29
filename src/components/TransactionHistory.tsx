import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { readCache, writeCache, useRefreshSignal } from "@/lib/dataCache";

interface Transaction {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  created_at: string;
}

const PAGE_SIZE = 10;
const transition = { type: "spring" as const, duration: 0.4, bounce: 0 };

export default function TransactionHistory({ userId }: { userId: string }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const fetchPage = useCallback(async (offset: number, append: boolean) => {
    const { data } = await supabase
      .from("croin_transactions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    const rows = data ?? [];
    setTransactions((prev) => (append ? [...prev, ...rows] : rows));
    setHasMore(rows.length === PAGE_SIZE);
    if (offset === 0 && !append) writeCache(`tx-${userId}`, rows);
  }, [userId]);

  useEffect(() => {
    const cached = readCache<Transaction[]>(`tx-${userId}`);
    if (cached) {
      setTransactions(cached);
      setHasMore(cached.length === PAGE_SIZE);
      setLoading(false);
    } else {
      setLoading(true);
      fetchPage(0, false).finally(() => setLoading(false));
    }
  }, [userId, fetchPage]);

  useRefreshSignal(() => {
    fetchPage(0, false);
  });

  const loadMore = async () => {
    setLoadingMore(true);
    await fetchPage(transactions.length, true);
    setLoadingMore(false);
  };

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
        <>
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

          {hasMore && (
            <div className="mt-4 flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={loadMore}
                disabled={loadingMore}
                className="text-xs font-mono uppercase tracking-widest text-muted-foreground"
              >
                {loadingMore ? "Loading…" : "Load More"}
              </Button>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}
