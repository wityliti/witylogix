"use client";

import { memo, useState, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Card, Button, Badge } from "@/components/ui";

interface Deal {
  id: string;
  name: string;
  value: number;
  contact: {
    id: string;
    name: string;
    avatar?: string;
  };
  probability: number;
  expectedCloseDate?: string;
}

interface PipelineStage {
  id: string;
  name: string;
  deals: Deal[];
}

interface DealPipelineProps {
  stages: PipelineStage[];
  onDealMove?: (dealId: string, fromStageId: string, toStageId: string) => void;
  onDealClick?: (dealId: string) => void;
  onStageClick?: (stageId: string) => void;
  showConversionRates?: boolean;
  defaultStages?: boolean;
}

const probabilityConfig = (prob: number) => {
  if (prob >= 80) return { color: "success", label: "High" };
  if (prob >= 50) return { color: "warning", label: "Medium" };
  if (prob >= 20) return { color: "info", label: "Low" };
  return { color: "danger", label: "Cold" };
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

const DealCard = memo(
  ({
    deal,
    onDragStart,
    onClick,
  }: {
    deal: Deal;
    onDragStart: (dealId: string, e: React.DragEvent) => void;
    onClick: () => void;
  }) => {
    const probConfig = probabilityConfig(deal.probability);

    return (
      <div
        draggable
        onDragStart={(e) => onDragStart(deal.id, e)}
        onClick={onClick}
        className="p-3 bg-wl-bg-overlay rounded-lg border border-wl-border-subtle hover:border-wl-border-default cursor-move transition-all hover:shadow-md group"
        role="button"
        tabIndex={0}
        aria-label={`Deal: ${deal.name}`}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        }}
      >
        <div className="space-y-2">
          {/* Deal Name */}
          <h4 className="text-sm font-semibold text-wl-text-primary line-clamp-2">
            {deal.name}
          </h4>

          {/* Value and Probability */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-wl-success-400">
              {formatCurrency(deal.value)}
            </span>
            <Badge variant={probabilityConfig(deal.probability).color as any} dot>
              {deal.probability}%
            </Badge>
          </div>

          {/* Contact */}
          <div className="flex items-center gap-2 text-xs text-wl-text-secondary">
            <div className="w-5 h-5 rounded-full bg-wl-primary-500/20 flex items-center justify-center text-xs font-semibold text-wl-primary-400">
              {deal.contact.name
                .split(" ")
                .map((part) => part[0])
                .join("")
                .slice(0, 2)}
            </div>
            <span className="truncate">{deal.contact.name}</span>
          </div>

          {/* Close Date */}
          {deal.expectedCloseDate && (
            <p className="text-xs text-wl-text-tertiary">
              {new Date(deal.expectedCloseDate).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </p>
          )}
        </div>
      </div>
    );
  }
);

DealCard.displayName = "DealCard";

const PipelineColumn = memo(
  ({
    stage,
    totalValue,
    avgProbability,
    onDrop,
    onDealClick,
    onStageClick,
  }: {
    stage: PipelineStage;
    totalValue: number;
    avgProbability: number;
    onDrop: (dealId: string, e: React.DragEvent) => void;
    onDealClick: (dealId: string) => void;
    onStageClick: () => void;
  }) => {
    const [dragOver, setDragOver] = useState(false);

    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(true);
    };

    const handleDragLeave = () => {
      setDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      onDrop(e.dataTransfer.getData("dealId"), e);
    };

    return (
      <div
        className={cn(
          "flex flex-col gap-3 p-4 rounded-lg min-h-[500px] flex-1",
          "border-2 transition-all duration-fast",
          dragOver
            ? "border-wl-primary-500 bg-wl-primary-500/5"
            : "border-wl-border-subtle bg-wl-bg-overlay"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role="region"
        aria-label={`Pipeline stage: ${stage.name}`}
      >
        {/* Header */}
        <div className="sticky top-0 z-10">
          <button
            onClick={onStageClick}
            className="w-full text-left px-3 py-2 rounded-md hover:bg-wl-bg-elevated transition-colors"
            aria-label={`View stage: ${stage.name}`}
          >
            <h3 className="text-sm font-semibold text-wl-text-primary">{stage.name}</h3>
          </button>

          {/* Stage Stats */}
          <div className="mt-2 px-3 space-y-1 text-xs text-wl-text-secondary">
            <p>
              {stage.deals.length} deal{stage.deals.length !== 1 ? "s" : ""}
            </p>
            <p>Total: {formatCurrency(totalValue)}</p>
            {stage.deals.length > 0 && (
              <p>Avg Probability: {Math.round(avgProbability)}%</p>
            )}
          </div>
        </div>

        {/* Deals */}
        <div className="flex-1 space-y-2 overflow-y-auto">
          {stage.deals.length > 0 ? (
            stage.deals.map((deal) => (
              <DealCard
                key={deal.id}
                deal={deal}
                onDragStart={(dealId, e) => {
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("dealId", dealId);
                }}
                onClick={() => onDealClick(deal.id)}
              />
            ))
          ) : (
            <div className="flex items-center justify-center h-20 text-xs text-wl-text-tertiary">
              Drop deals here
            </div>
          )}
        </div>
      </div>
    );
  }
);

PipelineColumn.displayName = "PipelineColumn";

export const DealPipeline = memo(function DealPipeline({
  stages: initialStages,
  onDealMove,
  onDealClick = () => {},
  onStageClick = () => {},
  showConversionRates = true,
  defaultStages = false,
}: DealPipelineProps) {
  const [stages, setStages] = useState<PipelineStage[]>(initialStages);
  const [draggedDealId, setDraggedDealId] = useState<string | null>(null);

  const handleDrop = useCallback(
    (dealId: string, toStageId: string) => {
      // Find the deal and its current stage
      let currentStageId: string | null = null;
      let dealToMove: Deal | null = null;

      for (const stage of stages) {
        const deal = stage.deals.find((d) => d.id === dealId);
        if (deal) {
          currentStageId = stage.id;
          dealToMove = deal;
          break;
        }
      }

      if (!currentStageId || !dealToMove || currentStageId === toStageId) {
        return;
      }

      // Update local state
      const updatedStages = stages.map((stage) => {
        if (stage.id === currentStageId) {
          return {
            ...stage,
            deals: stage.deals.filter((d) => d.id !== dealId),
          };
        }
        if (stage.id === toStageId) {
          return {
            ...stage,
            deals: [...stage.deals, dealToMove],
          };
        }
        return stage;
      });

      setStages(updatedStages);
      onDealMove?.(dealId, currentStageId, toStageId);
      setDraggedDealId(null);
    },
    [stages, onDealMove]
  );

  const stageMetrics = useMemo(() => {
    return stages.map((stage) => {
      const totalValue = stage.deals.reduce((sum, deal) => sum + deal.value, 0);
      const avgProbability =
        stage.deals.length > 0
          ? stage.deals.reduce((sum, deal) => sum + deal.probability, 0) /
            stage.deals.length
          : 0;

      return { totalValue, avgProbability };
    });
  }, [stages]);

  const pipelineTotal = useMemo(
    () => stageMetrics.reduce((sum, metric) => sum + metric.totalValue, 0),
    [stageMetrics]
  );

  return (
    <div className="space-y-4">
      {/* Pipeline Header */}
      <div className="flex items-center justify-between px-1">
        <h2 className="text-lg font-semibold text-wl-text-primary">Sales Pipeline</h2>
        <div className="text-right">
          <p className="text-sm text-wl-text-secondary">Total Pipeline Value</p>
          <p className="text-2xl font-bold text-wl-success-400">
            {formatCurrency(pipelineTotal)}
          </p>
        </div>
      </div>

      {/* Pipeline Stages */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage, idx) => (
          <PipelineColumn
            key={stage.id}
            stage={stage}
            totalValue={stageMetrics[idx].totalValue}
            avgProbability={stageMetrics[idx].avgProbability}
            onDrop={(dealId, e) => handleDrop(dealId, stage.id)}
            onDealClick={onDealClick}
            onStageClick={() => onStageClick(stage.id)}
          />
        ))}
      </div>

      {/* Conversion Metrics */}
      {showConversionRates && stages.length > 1 && (
        <Card className="mt-6">
          <h3 className="text-sm font-semibold text-wl-text-primary mb-4">
            Conversion Metrics
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stages.map((stage, idx) => {
              const conversionRate =
                idx > 0 && stages[idx - 1].deals.length > 0
                  ? ((stage.deals.length / stages[idx - 1].deals.length) * 100).toFixed(1)
                  : "-";

              return (
                <div key={stage.id} className="text-center">
                  <p className="text-xs text-wl-text-secondary mb-1">
                    {stage.name} Conversion
                  </p>
                  <p className="text-lg font-semibold text-wl-primary-400">
                    {conversionRate}%
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
});

DealPipeline.displayName = "DealPipeline";
