import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Area, AreaChart, XAxis, YAxis } from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";

interface PricePoint {
  time: string;
  price: number;
}

const chartConfig = {
  price: {
    label: "Price",
    color: "hsl(var(--primary))",
  },
};

export default function CroinChart({ userEmail }: { userEmail?: string }) {
  const [data, setData] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const isAdmin = userEmail === "cross.a.trix.owner@hotmail.com";

  const fetchPrices = async () => {
    const { data: prices } = await supabase
      .from("croin_price_history")
      .select("price, created_at")
      .order("created_at", { ascending: true })
      .limit(50);

    if (prices) {
      setData(
        prices.map((p) => ({
          time: new Date(p.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          price: Number(p.price),
        }))
      );
    }
  };

  useEffect(() => {
    fetchPrices();

    const channel = supabase
      .channel("croin-price")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "croin_price_history" },
        () => fetchPrices()
      )
      .subscribe();

    // Trigger micro-fluctuations every 30 seconds
    const simulationInterval = setInterval(async () => {
      await supabase.functions.invoke("croin-simulate");
    }, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(simulationInterval);
    };
  }, []);

  const handlePriceChange = async (action: "up" | "down") => {
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("croin-price", {
        body: { action },
      });

      if (error) {
        toast.error("Failed to update price");
      } else {
        toast.success(
          `Price ${action === "up" ? "increased" : "decreased"} to ¢${result.new_price}`
        );
      }
    } catch {
      toast.error("Failed to update price");
    }
    setLoading(false);
  };

  const currentPrice = data.length > 0 ? data[data.length - 1].price : 1;
  const previousPrice = data.length > 1 ? data[data.length - 2].price : currentPrice;
  const priceChange = currentPrice - previousPrice;
  const isUp = priceChange >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", duration: 0.4, bounce: 0 }}
      className="mb-8 p-6 rounded-2xl border border-border bg-card shadow-vault"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">
            Croin Market Value
          </p>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              ¢{currentPrice.toFixed(2)}
            </span>
            <span
              className={`text-xs font-mono flex items-center gap-0.5 ${
                isUp ? "text-green-400" : "text-red-400"
              }`}
            >
              {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {isUp ? "+" : ""}
              {priceChange.toFixed(2)}
            </span>
          </div>
        </div>
        <div className="h-10 w-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
          <span className="text-lg font-bold text-primary">¢</span>
        </div>
      </div>

      <ChartContainer config={chartConfig} className="h-[200px] w-full">
        <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
          <defs>
            <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="time"
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={["auto", "auto"]}
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={40}
            tickFormatter={(v) => `¢${v}`}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Area
            type="monotone"
            dataKey="price"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            fill="url(#priceGrad)"
          />
        </AreaChart>
      </ChartContainer>

      {isAdmin && (
        <div className="mt-4 flex gap-3">
          <Button
            variant="outline"
            className="flex-1 gap-2 text-green-400 border-green-400/30 hover:bg-green-400/10"
            onClick={() => handlePriceChange("up")}
            disabled={loading}
          >
            <TrendingUp className="h-4 w-4" /> Push Up
          </Button>
          <Button
            variant="outline"
            className="flex-1 gap-2 text-red-400 border-red-400/30 hover:bg-red-400/10"
            onClick={() => handlePriceChange("down")}
            disabled={loading}
          >
            <TrendingDown className="h-4 w-4" /> Push Down
          </Button>
        </div>
      )}
    </motion.div>
  );
}
