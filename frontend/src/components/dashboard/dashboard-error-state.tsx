import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

export interface DashboardErrorStateProps {
  error: string;
  onRetry: () => void;
  isRetrying?: boolean;
}

export function DashboardErrorState({
  error,
  onRetry,
  isRetrying = false,
}: DashboardErrorStateProps) {
  return (
    <Card className="border-red-500/30 bg-[#121922] p-8 text-center shadow-xl">
      <CardContent className="max-w-md mx-auto space-y-4">
        <div className="h-14 w-14 mx-auto rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-[#F8FAFC]">
            Failed to Load Dashboard Metrics
          </h3>
          <p className="text-xs text-red-400/90 leading-relaxed font-mono">
            {error}
          </p>
        </div>

        <div className="pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            isLoading={isRetrying}
            className="border-red-500/40 text-red-300 hover:bg-red-500/10"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Retry Connection</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
