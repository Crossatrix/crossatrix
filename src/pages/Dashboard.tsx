import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import TransactionHistory from "@/components/TransactionHistory";
import CroinChart from "@/components/CroinChart";
import SendCroins from "@/components/SendCroins";
import SetBalance from "@/components/SetBalance";
import BalanceNotifications from "@/components/BalanceNotifications";
import OtherStuff from "@/components/OtherStuff";
import News from "@/components/News";
import Newspaper from "@/components/Newspaper";
import ShareButton from "@/components/ShareButton";
import RedeemCode from "@/components/RedeemCode";
import Shares from "@/components/Shares";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useStudentRestrictions } from "@/hooks/useStudentRestrictions";
import { readCache, writeCache, triggerRefresh } from "@/lib/dataCache";

const transition = { type: "spring" as const, duration: 0.4, bounce: 0 };

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [crossChatId, setCrossChatId] = useState("");
  const [crossiAiId, setCrossiAiId] = useState("");
  const [saving, setSaving] = useState(false);
  const [croinBalance, setCroinBalance] = useState<number>(0);
  const [refreshing, setRefreshing] = useState(false);
  const navigate = useNavigate();
  const restr = useStudentRestrictions(user?.id);
  const restrReady = !!user && !restr.loading;
  const visibleTabs = (restrReady
    ? [
        { v: "wallet", label: "Wallet", show: !restr.croins },
        { v: "shares", label: "Shares", show: !restr.croins },
        { v: "news", label: "News", show: !restr.news },
        { v: "paper", label: "Paper", show: !restr.newspaper },
        { v: "other", label: "Other", show: !restr.other },
      ]
    : [
        { v: "wallet", label: "Wallet", show: true },
        { v: "shares", label: "Shares", show: true },
        { v: "news", label: "News", show: true },
        { v: "paper", label: "Paper", show: true },
        { v: "other", label: "Other", show: true },
      ]
  ).filter((t) => t.show);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (!session?.user) navigate("/");
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (!session?.user) navigate("/");
      else {
        loadProfile(session.user.id);
        loadBalance(session.user.id);
        // route school members to their pages
        supabase
          .from("school_members")
          .select("role")
          .eq("user_id", session.user.id)
          .maybeSingle()
          .then(({ data }) => {
            if (data?.role === "principal") navigate("/school/principal");
            else if (data?.role === "teacher") navigate("/school/teacher");
          });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const loadProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("cross_chat_id, crossi_ai_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (data) {
      setCrossChatId(data.cross_chat_id || "");
      setCrossiAiId(data.crossi_ai_id || "");
    }
  };

  const loadBalance = async (userId: string) => {
    const { data } = await supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", userId)
      .maybeSingle();

    setCroinBalance(data?.balance ?? 0);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .upsert(
        { user_id: user.id, cross_chat_id: crossChatId, crossi_ai_id: crossiAiId, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );

    setSaving(false);
    if (error) {
      toast.error("Failed to save IDs");
    } else {
      toast.success("IDs saved successfully");
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-2 w-2 rounded-full bg-primary glow-primary animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-8 md:py-16">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={transition}
          className="flex items-center justify-between mb-10"
        >
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-primary glow-primary" />
            <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Session Active
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/settings")} className="text-muted-foreground">
              Settings
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-muted-foreground">
              Sign Out
            </Button>
          </div>
        </motion.div>

        {/* Croins Balance */}
        {!restr.croins && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...transition, delay: 0.05 }}
          className="mb-8 p-6 rounded-2xl border border-primary/30 bg-primary/5 shadow-vault"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">
                Croins Balance
              </p>
              <p className="text-3xl font-bold tracking-tight text-foreground">
                ¢{croinBalance.toLocaleString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <BalanceNotifications userId={user!.id} onBalanceChange={() => loadBalance(user!.id)} />
              <div className="h-12 w-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                <span className="text-2xl font-bold text-primary">¢</span>
              </div>
            </div>
          </div>
        </motion.div>
        )}

        {/* Tabs */}
        <Tabs key={visibleTabs.map((t) => t.v).join("|")} defaultValue={visibleTabs[0]?.v || "wallet"} className="w-full">
          <TabsList className="grid w-full mb-6" style={{ gridTemplateColumns: `repeat(${visibleTabs.length || 1}, minmax(0, 1fr))` }}>
            {visibleTabs.map((t) => (
              <TabsTrigger key={t.v} value={t.v}>{t.label}</TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="wallet" className="space-y-0">
            {/* Croin Trading Chart */}
            <CroinChart userEmail={user?.email} />

            {/* Title */}
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...transition, delay: 0.1 }}
              className="text-2xl font-semibold tracking-tight-brand text-foreground mb-2"
            >
              Link Your Services
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ ...transition, delay: 0.15 }}
              className="text-sm text-muted-foreground mb-8"
            >
              Enter your IDs to connect Cross-Chat and Crossi-AI to your Crossatrix account.
            </motion.p>

            {/* ID Form */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...transition, delay: 0.2 }}
              className="p-6 rounded-2xl border border-border bg-card shadow-vault space-y-6"
            >
              <div className="space-y-2">
                <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                  Cross-Chat ID
                </label>
                <Input
                  placeholder="Enter your Cross-Chat ID"
                  value={crossChatId}
                  onChange={(e) => setCrossChatId(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                  Crossi-AI ID
                </label>
                <Input
                  placeholder="Enter your Crossi-AI ID"
                  value={crossiAiId}
                  onChange={(e) => setCrossiAiId(e.target.value)}
                />
              </div>

              <Button
                variant="signal"
                className="w-full"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save IDs"}
              </Button>
            </motion.div>

            {/* Admin Set Balance */}
            {user && <SetBalance userId={user.id} userEmail={user.email} onBalanceSet={() => loadBalance(user.id)} />}

            {/* Send Croins */}
            {user && <SendCroins userId={user.id} onSent={() => loadBalance(user.id)} />}

            {/* Share & Earn */}
            {user && <ShareButton userId={user.id} />}

            {/* Redeem Code */}
            {user && <RedeemCode userId={user.id} userEmail={user.email} />}

            {/* Transaction History */}
            {user && <TransactionHistory userId={user.id} />}
          </TabsContent>

          <TabsContent value="shares">
            {user && <Shares userId={user.id} userEmail={user.email} onTrade={() => loadBalance(user.id)} />}
          </TabsContent>

          <TabsContent value="news">
            <News userEmail={user?.email} />
          </TabsContent>

          <TabsContent value="paper">
            <Newspaper userEmail={user?.email} userId={user?.id} />
          </TabsContent>

          <TabsContent value="other">
            <OtherStuff userEmail={user?.email} />
          </TabsContent>
        </Tabs>

        {/* User info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ ...transition, delay: 0.3 }}
          className="mt-8 p-4 rounded-xl border border-border bg-card/50"
        >
          <p className="text-xs text-muted-foreground">
            Signed in as <span className="font-mono text-foreground">{user?.email}</span>
          </p>
        </motion.div>

        {/* Footer */}
        <div className="mt-10 pt-6 border-t border-border">
          <p className="text-xs text-muted-foreground/50 font-mono text-center">
            crossatrix.identity.v1
          </p>
        </div>
      </div>
    </div>
  );
}
