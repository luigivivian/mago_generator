"use client";

import { useState } from "react";
import { Coins, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { StatsCard } from "@/components/panels/stats-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreditBalance, useCreditLogs } from "@/hooks/use-api";
import { topUpCredits } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";

const TYPE_LABELS: Record<string, string> = {
  deduction: "Deducao",
  refund: "Reembolso",
  top_up: "Recarga",
  blocked: "Bloqueado",
};

const TYPE_COLORS: Record<string, string> = {
  deduction: "bg-red-500/20 text-red-400 border-red-500/30",
  refund: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  top_up: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  blocked: "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

const STATUS_COLORS: Record<string, string> = {
  success: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  failed: "bg-red-500/20 text-red-400 border-red-500/30",
  blocked: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  refunded: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

const KNOWN_MODELS = [
  "hailuo/2-3-image-to-video-standard",
  "hailuo/2-3-image-to-video-pro",
  "bytedance/v1-pro-fast-image-to-video",
  "bytedance/v1-lite-image-to-video",
  "wan/2-6-flash-image-to-video",
  "wan/2-6-image-to-video",
  "kling/v2-1-standard",
  "bytedance/seedance-1.5-pro",
  "kling-3.0/video",
  "grok-imagine/image-to-video",
  "suno/v4",
];

function formatModel(model: string | null): string {
  if (!model) return "-";
  const parts = model.split("/");
  return parts.length > 1 ? parts[1] : model;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CreditsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  // Balance
  const { balance, isLoading: balanceLoading } = useCreditBalance();

  // Log filters
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [model, setModel] = useState("");
  const [logType, setLogType] = useState("");

  const { logs, isLoading: logsLoading, mutate: mutateLogs } = useCreditLogs({
    page,
    perPage: 25,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    model: model || undefined,
    logType: logType || undefined,
  });

  // Admin top-up
  const [topUpUserId, setTopUpUserId] = useState("");
  const [topUpAmount, setTopUpAmount] = useState("");
  const [topUpNote, setTopUpNote] = useState("");
  const [topUpLoading, setTopUpLoading] = useState(false);
  const [topUpResult, setTopUpResult] = useState<string | null>(null);

  const handleTopUp = async () => {
    const uid = parseInt(topUpUserId, 10);
    const amt = parseInt(topUpAmount, 10);
    if (!uid || !amt || amt <= 0) return;

    setTopUpLoading(true);
    setTopUpResult(null);
    try {
      const res = await topUpCredits(uid, amt, topUpNote);
      setTopUpResult(`Adicionado ${res.credits_added} creditos. Novo saldo: ${res.new_balance}`);
      setTopUpUserId("");
      setTopUpAmount("");
      setTopUpNote("");
      mutateLogs();
    } catch (err) {
      setTopUpResult(`Erro: ${err instanceof Error ? err.message : "Falha ao adicionar creditos"}`);
    } finally {
      setTopUpLoading(false);
    }
  };

  const totalPages = logs ? Math.ceil(logs.total / logs.per_page) : 1;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Coins className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Creditos</h1>
          <p className="text-sm text-muted-foreground">Saldo e historico de operacoes</p>
        </div>
      </div>

      {/* Balance card */}
      {balanceLoading ? (
        <Skeleton className="h-28 w-full max-w-sm" />
      ) : (
        <StatsCard
          title="Saldo de Creditos"
          value={balance ? `${balance.balance.toLocaleString("pt-BR")}` : "0"}
          icon={Coins}
          description={
            balance
              ? `Equivalente a $${balance.equivalent_usd.toFixed(2)} USD ($7 = 1.000 creditos)`
              : "Carregando..."
          }
          className="max-w-sm"
        />
      )}

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Historico de Operacoes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">De</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                className="w-40"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Ate</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                className="w-40"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Modelo</label>
              <Select value={model} onValueChange={(v) => { setModel(v === "all" ? "" : v); setPage(1); }}>
                <SelectTrigger className="w-52">
                  <SelectValue placeholder="Todos os modelos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os modelos</SelectItem>
                  {KNOWN_MODELS.map((m) => (
                    <SelectItem key={m} value={m}>{formatModel(m)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Tipo</label>
              <Select value={logType} onValueChange={(v) => { setLogType(v === "all" ? "" : v); setPage(1); }}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="deduction">Deducao</SelectItem>
                  <SelectItem value="refund">Reembolso</SelectItem>
                  <SelectItem value="top_up">Recarga</SelectItem>
                  <SelectItem value="blocked">Bloqueado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Logs table */}
          {logsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !logs || logs.logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Coins className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">Nenhuma operacao encontrada</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50 text-left">
                      <th className="pb-2 pr-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Data</th>
                      <th className="pb-2 pr-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Tipo</th>
                      <th className="pb-2 pr-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Modelo</th>
                      <th className="pb-2 pr-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Duracao</th>
                      <th className="pb-2 pr-4 font-medium text-muted-foreground text-xs uppercase tracking-wide text-right">Creditos</th>
                      <th className="pb-2 pr-4 font-medium text-muted-foreground text-xs uppercase tracking-wide text-right">Saldo Apos</th>
                      <th className="pb-2 pr-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                      <th className="pb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">Job</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.logs.map((log) => (
                      <tr key={log.id} className="border-b border-border/20 hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 pr-4 text-xs tabular-nums">{formatDate(log.created_at)}</td>
                        <td className="py-2.5 pr-4">
                          <Badge variant="outline" className={TYPE_COLORS[log.type] || ""}>
                            {TYPE_LABELS[log.type] || log.type}
                          </Badge>
                        </td>
                        <td className="py-2.5 pr-4 text-xs text-muted-foreground">{formatModel(log.model)}</td>
                        <td className="py-2.5 pr-4 text-xs tabular-nums">{log.duration ? `${log.duration}s` : "-"}</td>
                        <td className="py-2.5 pr-4 text-right tabular-nums font-medium">
                          <span className={log.type === "deduction" || log.type === "blocked" ? "text-red-400" : "text-emerald-400"}>
                            {log.type === "deduction" || log.type === "blocked" ? "-" : "+"}
                            {log.credits}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 text-right tabular-nums text-muted-foreground">{log.balance_after}</td>
                        <td className="py-2.5 pr-4">
                          <Badge variant="outline" className={STATUS_COLORS[log.status] || ""}>
                            {log.status}
                          </Badge>
                        </td>
                        <td className="py-2.5 text-xs text-muted-foreground">
                          {log.job_type && log.job_id ? `${log.job_type}/${log.job_id.slice(0, 8)}` : log.note || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-muted-foreground">
                  {logs.total} operacao{logs.total !== 1 ? "es" : ""} no total
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Anterior
                  </Button>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Proximo
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Admin top-up section */}
      {isAdmin && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recarga de Creditos (Admin)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">User ID</label>
                <Input
                  type="number"
                  placeholder="ID do usuario"
                  value={topUpUserId}
                  onChange={(e) => setTopUpUserId(e.target.value)}
                  className="w-32"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Quantidade</label>
                <Input
                  type="number"
                  placeholder="Creditos"
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(e.target.value)}
                  className="w-32"
                />
              </div>
              <div className="space-y-1 flex-1 min-w-[200px]">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Nota (opcional)</label>
                <Input
                  placeholder="Motivo da recarga"
                  value={topUpNote}
                  onChange={(e) => setTopUpNote(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={handleTopUp} disabled={topUpLoading || !topUpUserId || !topUpAmount}>
                {topUpLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Adicionar Creditos
              </Button>
              {topUpResult && (
                <p className={`text-sm ${topUpResult.startsWith("Erro") ? "text-red-400" : "text-emerald-400"}`}>
                  {topUpResult}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
