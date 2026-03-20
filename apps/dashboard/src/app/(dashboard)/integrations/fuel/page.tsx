'use client';

import { useState, useMemo } from 'react';
import { useApiList } from '@/hooks/use-api';
import { cn } from '@/lib/utils';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui/stat-card';
import {
  Fuel,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  MapPin,
  Plus,
  Settings,
  Eye,
  Trash2,
  AlertCircle,
  CheckCircle,
  Clock,
  DollarSign,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════
   FUEL INTEGRATIONS — Fuel card management & analytics
   ═══════════════════════════════════════════════════════════ */

type FuelProvider = "wex" | "comdata" | "fuelman" | "efs";
type CardStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING";
type AssignmentType = "DRIVER" | "VEHICLE" | "BOTH";
type FraudLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

interface FuelCard {
  id: string;
  provider: FuelProvider;
  cardNumber: string;
  status: CardStatus;
  assignedTo: string;
  assignmentType: AssignmentType;
  driver?: string;
  vehicle?: string;
  createdDate: string;
  lastUsed: string;
  monthlyLimit: number;
  monthlySpend: number;
  transactions: number;
}

interface Transaction {
  id: string;
  cardId: string;
  provider: FuelProvider;
  date: string;
  location: string;
  gallons: number;
  costPerGallon: number;
  totalCost: number;
  mileage?: number;
  fraudRisk: FraudLevel;
  status: "APPROVED" | "PENDING" | "FLAGGED" | "DECLINED";
}

interface FuelAnalytics {
  month: string;
  totalGallons: number;
  totalCost: number;
  avgPricePerGallon: number;
  avgMPG: number;
  estimatedWaste: number;
  transactionCount: number;
  uniqueLocations: number;
}

interface PurchasePolicy {
  id: string;
  name: string;
  dailyLimit: number;
  monthlyLimit: number;
  approvedStations?: string[];
  deniedStations?: string[];
  allowedHours?: string;
  requiresApproval: boolean;
  activationDate: string;
}

interface StationNetwork {
  id: string;
  name: string;
  location: string;
  distance: number;
  address: string;
  pricePerGallon: number;
  amenities: string[];
  partnered: boolean;
  rating: number;
  lastPriceUpdate: string;
}

interface MonthlyReport {
  month: string;
  totalCost: number;
  totalGallons: number;
  totalMiles: number;
  avgMPG: number;
  highCostDays: number;
  fraudAlerts: number;
  complianceScore: number;
  driverCount: number;
  vehicleCount: number;
}

const FUEL_PROVIDERS = [
  {
    slug: "wex",
    name: "WEX",
    icon: "🔴",
    description: "Leading fuel card network",
  },
  {
    slug: "comdata",
    name: "Comdata",
    icon: "🟢",
    description: "Fuel and non-fuel solutions",
  },
  {
    slug: "fuelman",
    name: "Fuelman",
    icon: "🔵",
    description: "Multi-service fleet card",
  },
  {
    slug: "efs",
    name: "EFS",
    icon: "🟠",
    description: "Electronic fuel services",
  },
];

const FUEL_CARDS: FuelCard[] = [
  {
    id: "card-1",
    provider: "wex",
    cardNumber: "****1234",
    status: "ACTIVE",
    assignedTo: "Carlos Martinez",
    assignmentType: "DRIVER",
    driver: "Carlos Martinez",
    createdDate: "2024-01-15",
    lastUsed: "Today 2:30 PM",
    monthlyLimit: 5000,
    monthlySpend: 3420,
    transactions: 18,
  },
  {
    id: "card-2",
    provider: "comdata",
    cardNumber: "****5678",
    status: "ACTIVE",
    assignedTo: "Vehicle VTY-4501",
    assignmentType: "VEHICLE",
    vehicle: "VTY-4501",
    createdDate: "2024-02-01",
    lastUsed: "Yesterday 8:15 AM",
    monthlyLimit: 6000,
    monthlySpend: 4250,
    transactions: 22,
  },
  {
    id: "card-3",
    provider: "fuelman",
    cardNumber: "****9012",
    status: "ACTIVE",
    assignedTo: "Sarah Johnson",
    assignmentType: "DRIVER",
    driver: "Sarah Johnson",
    createdDate: "2024-01-20",
    lastUsed: "2 days ago",
    monthlyLimit: 4500,
    monthlySpend: 2850,
    transactions: 14,
  },
  {
    id: "card-4",
    provider: "efs",
    cardNumber: "****3456",
    status: "PENDING",
    assignedTo: "New Driver Assignment",
    assignmentType: "DRIVER",
    createdDate: "2024-03-10",
    lastUsed: "Never",
    monthlyLimit: 5000,
    monthlySpend: 0,
    transactions: 0,
  },
  {
    id: "card-5",
    provider: "wex",
    cardNumber: "****7890",
    status: "INACTIVE",
    assignedTo: "Vehicle VTY-4502 (Archived)",
    assignmentType: "VEHICLE",
    vehicle: "VTY-4502",
    createdDate: "2023-12-01",
    lastUsed: "45 days ago",
    monthlyLimit: 5500,
    monthlySpend: 0,
    transactions: 0,
  },
];

const RECENT_TRANSACTIONS: Transaction[] = [
  {
    id: "txn-1",
    cardId: "card-1",
    provider: "wex",
    date: "Today 2:30 PM",
    location: "Shell - Exit 42, CA",
    gallons: 45.2,
    costPerGallon: 3.45,
    totalCost: 155.94,
    mileage: 145230,
    fraudRisk: "LOW",
    status: "APPROVED",
  },
  {
    id: "txn-2",
    cardId: "card-2",
    provider: "comdata",
    date: "Today 11:15 AM",
    location: "Pilot Flying J - NV",
    gallons: 52.0,
    costPerGallon: 3.52,
    totalCost: 183.04,
    mileage: 142850,
    fraudRisk: "LOW",
    status: "APPROVED",
  },
  {
    id: "txn-3",
    cardId: "card-3",
    provider: "fuelman",
    date: "2 days ago",
    location: "Love's Travel Stops - TX",
    gallons: 48.5,
    costPerGallon: 3.38,
    totalCost: 164.03,
    mileage: 238540,
    fraudRisk: "MEDIUM",
    status: "FLAGGED",
  },
  {
    id: "txn-4",
    cardId: "card-1",
    provider: "wex",
    date: "3 days ago",
    location: "Chevron - Seattle, WA",
    gallons: 44.0,
    costPerGallon: 3.28,
    totalCost: 144.32,
    mileage: 145050,
    fraudRisk: "LOW",
    status: "APPROVED",
  },
  {
    id: "txn-5",
    cardId: "card-2",
    provider: "comdata",
    date: "3 days ago",
    location: "Murphy USA - NM",
    gallons: 50.0,
    costPerGallon: 3.42,
    totalCost: 171.00,
    mileage: 142750,
    fraudRisk: "HIGH",
    status: "PENDING",
  },
];

const FUEL_ANALYTICS: FuelAnalytics[] = [
  {
    month: "March 2026",
    totalGallons: 2450,
    totalCost: 8392.50,
    avgPricePerGallon: 3.43,
    avgMPG: 6.8,
    estimatedWaste: 250,
    transactionCount: 54,
    uniqueLocations: 28,
  },
  {
    month: "February 2026",
    totalGallons: 2380,
    totalCost: 8154.20,
    avgPricePerGallon: 3.42,
    avgMPG: 6.9,
    estimatedWaste: 180,
    transactionCount: 51,
    uniqueLocations: 26,
  },
  {
    month: "January 2026",
    totalGallons: 2520,
    totalCost: 8820.00,
    avgPricePerGallon: 3.50,
    avgMPG: 6.6,
    estimatedWaste: 320,
    transactionCount: 57,
    uniqueLocations: 30,
  },
];

const PURCHASE_POLICIES: PurchasePolicy[] = [
  {
    id: "policy-1",
    name: "Standard Driver Policy",
    dailyLimit: 200,
    monthlyLimit: 5000,
    requiresApproval: false,
    activationDate: "2024-01-01",
  },
  {
    id: "policy-2",
    name: "Lead Driver Policy",
    dailyLimit: 300,
    monthlyLimit: 7500,
    requiresApproval: false,
    activationDate: "2024-01-01",
  },
  {
    id: "policy-3",
    name: "Restricted Access",
    dailyLimit: 100,
    monthlyLimit: 2500,
    requiresApproval: true,
    activationDate: "2024-02-15",
  },
];

const STATION_NETWORK: StationNetwork[] = [
  {
    id: "station-1",
    name: "Pilot Flying J",
    location: "Exit 42, CA",
    distance: 8.2,
    address: "1234 Highway 95, Barstow, CA 92311",
    pricePerGallon: 3.45,
    amenities: ["Dining", "Showers", "Parking"],
    partnered: true,
    rating: 4.5,
    lastPriceUpdate: "Today 10:00 AM",
  },
  {
    id: "station-2",
    name: "Shell",
    location: "City Center, CA",
    distance: 2.1,
    address: "5678 Main St, Los Angeles, CA 90001",
    pricePerGallon: 3.52,
    amenities: ["Convenience Store"],
    partnered: true,
    rating: 4.2,
    lastPriceUpdate: "Today 9:30 AM",
  },
  {
    id: "station-3",
    name: "Love's Travel Stops",
    location: "Highway 87, TX",
    distance: 45.5,
    address: "9012 I-45 North, Dallas, TX 75001",
    pricePerGallon: 3.38,
    amenities: ["Dining", "Laundry", "Showers"],
    partnered: true,
    rating: 4.6,
    lastPriceUpdate: "Today 11:00 AM",
  },
  {
    id: "station-4",
    name: "Chevron",
    location: "Downtown Seattle, WA",
    distance: 3.4,
    address: "3456 Pike St, Seattle, WA 98101",
    pricePerGallon: 3.28,
    amenities: ["Convenience Store", "Rewards Program"],
    partnered: false,
    rating: 3.9,
    lastPriceUpdate: "Today 8:45 AM",
  },
];

const MONTHLY_REPORTS: MonthlyReport[] = [
  {
    month: "March 2026",
    totalCost: 8392.50,
    totalGallons: 2450,
    totalMiles: 16660,
    avgMPG: 6.8,
    highCostDays: 3,
    fraudAlerts: 2,
    complianceScore: 94,
    driverCount: 12,
    vehicleCount: 8,
  },
  {
    month: "February 2026",
    totalCost: 8154.20,
    totalGallons: 2380,
    totalMiles: 16422,
    avgMPG: 6.9,
    highCostDays: 2,
    fraudAlerts: 1,
    complianceScore: 96,
    driverCount: 12,
    vehicleCount: 8,
  },
  {
    month: "January 2026",
    totalCost: 8820.00,
    totalGallons: 2520,
    totalMiles: 16632,
    avgMPG: 6.6,
    highCostDays: 5,
    fraudAlerts: 3,
    complianceScore: 91,
    driverCount: 13,
    vehicleCount: 9,
  },
];

const cardStatusVariant = (
  status: CardStatus
): "success" | "warning" | "danger" | "info" | "default" => {
  const map: Record<CardStatus, "success" | "warning" | "danger" | "info" | "default"> = {
    ACTIVE: "success",
    INACTIVE: "default",
    SUSPENDED: "danger",
    PENDING: "info",
  };
  return map[status];
};

const fraudRiskVariant = (
  risk: FraudLevel
): "success" | "warning" | "danger" | "info" | "default" => {
  const map: Record<FraudLevel, "success" | "warning" | "danger" | "info" | "default"> = {
    LOW: "success",
    MEDIUM: "warning",
    HIGH: "danger",
    CRITICAL: "danger",
  };
  return map[risk];
};

const transactionStatusVariant = (
  status: string
): "success" | "warning" | "danger" | "info" | "default" => {
  const map: Record<string, "success" | "warning" | "danger" | "info" | "default"> = {
    APPROVED: "success",
    PENDING: "info",
    FLAGGED: "warning",
    DECLINED: "danger",
  };
  return map[status] ?? "default";
};

export default function FuelIntegrationsPage() {
  const [view, setView] = useState<"cards" | "transactions" | "analytics" | "stations" | "reports">(
    "cards"
  );
  const [expandedCard, setExpandedCard] = useState<string | null>("card-1");

  const activeCards = useMemo(
    () => FUEL_CARDS.filter((c) => c.status === "ACTIVE"),
    []
  );
  const totalMonthlySpend = useMemo(
    () => FUEL_CARDS.reduce((sum, c) => sum + c.monthlySpend, 0),
    []
  );
  const totalMonthlyLimit = useMemo(
    () => FUEL_CARDS.reduce((sum, c) => sum + c.monthlyLimit, 0),
    []
  );
  const totalTransactions = useMemo(
    () => RECENT_TRANSACTIONS.length,
    []
  );
  const flaggedTransactions = useMemo(
    () => RECENT_TRANSACTIONS.filter((t) => t.status === "FLAGGED" || t.fraudRisk === "HIGH" || t.fraudRisk === "CRITICAL").length,
    []
  );

  const currentMonth = FUEL_ANALYTICS[0];
  const previousMonth = FUEL_ANALYTICS[1];
  const costChange = (((currentMonth.totalCost - previousMonth.totalCost) / previousMonth.totalCost) * 100).toFixed(1);

  return (
    <>
      <Header
        title="Fuel Integrations"
        subtitle="Manage fuel cards, monitor purchases, and analyze fuel costs"
        actions={
          <div className={cn("flex gap-2")}>
            <Button variant="primary" size="sm">
              <Plus size={14} className={cn("mr-1")} />
              Issue Card
            </Button>
          </div>
        }
      />

      <div className={cn("p-6")}>
        {/* Top Stats */}
        <div className={cn("grid grid-cols-1 md:grid-cols-4 gap-4 mb-6")}>
          <StatCard
            label="Active Cards"
            value={activeCards.length}
            change={{ value: 1, label: "pending" }}
            icon={<Fuel size={16} />}
            accentColor="var(--wl-success-500)"
            index={0}
          />
          <StatCard
            label="Monthly Spend"
            value={`$${Math.floor(totalMonthlySpend / 1000)}K`}
            change={{
              value: parseFloat(costChange),
              label: "vs last month",
            }}
            icon={<DollarSign size={16} />}
            accentColor="var(--wl-primary-500)"
            index={1}
          />
          <StatCard
            label="Transactions"
            value={totalTransactions}
            change={{ value: 6, label: "this week" }}
            icon={<Clock size={16} />}
            accentColor="var(--wl-info-500)"
            index={2}
          />
          <StatCard
            label="Fraud Alerts"
            value={flaggedTransactions}
            change={{ value: 1, label: "pending review" }}
            icon={<AlertTriangle size={16} />}
            accentColor="var(--wl-warning-500)"
            index={3}
          />
        </div>

        {/* View Toggle */}
        <div className={cn("flex gap-2 mb-6 bg-wl-bg-overlay rounded-md p-1 w-fit flex-wrap")}>
          {(["cards", "transactions", "analytics", "stations", "reports"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "px-3 py-1 rounded-sm border-none text-xs font-semibold cursor-pointer capitalize",
                view === v
                  ? "bg-wl-primary-500 text-wl-text-inverse"
                  : "bg-transparent text-wl-text-tertiary"
              )}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Cards View */}
        {view === "cards" && (
          <div className={cn("space-y-3")}>
            <div className={cn("flex items-center justify-between mb-4")}>
              <h3 className={cn("text-sm font-semibold text-wl-text-primary")}>
                Fuel Cards ({FUEL_CARDS.length})
              </h3>
              <span className={cn("text-xs text-wl-text-tertiary")}>
                {activeCards.length} active
              </span>
            </div>

            {/* Card Assignment Matrix */}
            <Card className={cn("mb-6 bg-gradient-to-r from-wl-bg-elevated to-wl-bg-surface")}>
              <div className={cn("p-4")}>
                <p className={cn("text-xs font-semibold text-wl-text-primary mb-4")}>
                  Card Assignment Overview
                </p>
                <div className={cn("grid grid-cols-3 gap-4")}>
                  <div className={cn("text-center")}>
                    <p className={cn("text-2xl font-bold text-wl-primary-400")}>
                      {FUEL_CARDS.filter((c) => c.assignmentType === "DRIVER").length}
                    </p>
                    <p className={cn("text-xs text-wl-text-tertiary mt-1")}>Driver Assigned</p>
                  </div>
                  <div className={cn("text-center")}>
                    <p className={cn("text-2xl font-bold text-wl-success-400")}>
                      {FUEL_CARDS.filter((c) => c.assignmentType === "VEHICLE").length}
                    </p>
                    <p className={cn("text-xs text-wl-text-tertiary mt-1")}>Vehicle Assigned</p>
                  </div>
                  <div className={cn("text-center")}>
                    <p className={cn("text-2xl font-bold text-wl-warning-400")}>
                      {FUEL_CARDS.filter((c) => c.status === "PENDING").length}
                    </p>
                    <p className={cn("text-xs text-wl-text-tertiary mt-1")}>Pending Setup</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Card List */}
            {FUEL_CARDS.map((card, idx) => {
              const provider = FUEL_PROVIDERS.find((p) => p.slug === card.provider);
              const isExpanded = expandedCard === card.id;
              const spendPercentage = (card.monthlySpend / card.monthlyLimit) * 100;

              return (
                <Card
                  key={card.id}
                  className={cn(
                    "cursor-pointer transition-all wl-animate-in",
                    isExpanded && "ring-1 ring-wl-primary-400"
                  )}
                  style={{ animationDelay: `${idx * 40}ms` }}
                  onClick={() => setExpandedCard(isExpanded ? null : card.id)}
                >
                  <div className={cn("p-4")}>
                    <div className={cn("flex items-start justify-between mb-3")}>
                      <div className={cn("flex items-center gap-3 flex-1 min-w-0")}>
                        <span className={cn("text-2xl shrink-0")}>{provider?.icon}</span>
                        <div className={cn("min-w-0")}>
                          <p className={cn("text-sm font-semibold text-wl-text-primary")}>
                            {card.cardNumber}
                          </p>
                          <p className={cn("text-xs text-wl-text-tertiary mt-1")}>
                            {card.assignedTo}
                          </p>
                        </div>
                      </div>
                      <Badge variant={cardStatusVariant(card.status)} dot>
                        {card.status}
                      </Badge>
                    </div>

                    {/* Spend Progress Bar */}
                    <div className={cn("mb-3")}>
                      <div className={cn("flex items-center justify-between mb-1")}>
                        <span className={cn("text-xs text-wl-text-tertiary")}>
                          Monthly Spend
                        </span>
                        <span className={cn("text-xs font-semibold text-wl-text-primary")}>
                          ${card.monthlySpend} / ${card.monthlyLimit}
                        </span>
                      </div>
                      <div className={cn("w-full h-2 rounded-full bg-wl-bg-surface overflow-hidden")}>
                        <div
                          className={cn(
                            "h-full transition-all",
                            spendPercentage > 80
                              ? "bg-wl-danger-400"
                              : spendPercentage > 60
                                ? "bg-wl-warning-400"
                                : "bg-wl-success-400"
                          )}
                          style={{ width: `${Math.min(spendPercentage, 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className={cn("flex items-center justify-between text-xs text-wl-text-tertiary")}>
                      <span>Last used: {card.lastUsed}</span>
                      <span>{card.transactions} transactions</span>
                    </div>

                    {isExpanded && (
                      <div className={cn("border-t border-wl-border-subtle pt-3 mt-3 space-y-3")}>
                        <div className={cn("grid grid-cols-3 gap-2 text-xs")}>
                          <div className={cn("bg-wl-bg-surface rounded p-2")}>
                            <p className={cn("text-wl-text-tertiary mb-1")}>Provider</p>
                            <p className={cn("font-bold text-wl-text-primary")}>
                              {provider?.name}
                            </p>
                          </div>
                          <div className={cn("bg-wl-bg-surface rounded p-2")}>
                            <p className={cn("text-wl-text-tertiary mb-1")}>Issued</p>
                            <p className={cn("font-bold text-wl-text-primary")}>
                              {card.createdDate}
                            </p>
                          </div>
                          <div className={cn("bg-wl-bg-surface rounded p-2")}>
                            <p className={cn("text-wl-text-tertiary mb-1")}>Usage</p>
                            <p
                              className={cn(
                                "font-bold",
                                spendPercentage > 80
                                  ? "text-wl-danger-400"
                                  : spendPercentage > 60
                                    ? "text-wl-warning-400"
                                    : "text-wl-success-400"
                              )}
                            >
                              {spendPercentage.toFixed(0)}%
                            </p>
                          </div>
                        </div>

                        <div className={cn("flex gap-2")}>
                          {card.status === "PENDING" ? (
                            <Button variant="primary" size="sm">
                              Activate
                            </Button>
                          ) : (
                            <Button variant="secondary" size="sm">
                              Manage
                            </Button>
                          )}
                          <Button variant="ghost" size="sm">
                            <Eye size={14} className={cn("mr-1")} />
                            View Transactions
                          </Button>
                          {card.status !== "ACTIVE" && (
                            <Button variant="ghost" size="sm">
                              <Trash2 size={14} className={cn("text-wl-danger-400")} />
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Transactions View */}
        {view === "transactions" && (
          <div className={cn("space-y-3")}>
            <div className={cn("flex items-center justify-between mb-4")}>
              <h3 className={cn("text-sm font-semibold text-wl-text-primary")}>
                Recent Transactions ({RECENT_TRANSACTIONS.length})
              </h3>
              {flaggedTransactions > 0 && (
                <Badge variant="warning">
                  <AlertTriangle size={12} className={cn("mr-1")} />
                  {flaggedTransactions} flagged
                </Badge>
              )}
            </div>

            {RECENT_TRANSACTIONS.map((txn, idx) => {
              const provider = FUEL_PROVIDERS.find((p) => p.slug === txn.provider);
              const mpg = txn.mileage
                ? "Calculating..."
                : "N/A";

              return (
                <Card
                  key={txn.id}
                  className={cn(
                    "wl-animate-in",
                    (txn.fraudRisk === "HIGH" || txn.fraudRisk === "CRITICAL") &&
                    "border-wl-danger-400 border-opacity-30"
                  )}
                  style={{ animationDelay: `${idx * 40}ms` }}
                >
                  <div className={cn("p-4")}>
                    <div className={cn("flex items-start justify-between mb-3")}>
                      <div className={cn("flex-1 min-w-0")}>
                        <p className={cn("text-sm font-semibold text-wl-text-primary")}>
                          {txn.location}
                        </p>
                        <p className={cn("text-xs text-wl-text-tertiary mt-1")}>
                          {txn.date}
                        </p>
                      </div>
                      <div className={cn("text-right shrink-0")}>
                        <p className={cn("text-lg font-bold text-wl-primary-400")}>
                          ${txn.totalCost.toFixed(2)}
                        </p>
                        <Badge variant={transactionStatusVariant(txn.status)} dot size="sm">
                          {txn.status}
                        </Badge>
                      </div>
                    </div>

                    <div className={cn("bg-wl-bg-surface rounded p-3 mb-3")}>
                      <div className={cn("grid grid-cols-4 gap-3 text-xs")}>
                        <div>
                          <p className={cn("text-wl-text-tertiary mb-1")}>Gallons</p>
                          <p className={cn("font-bold text-wl-text-primary")}>
                            {txn.gallons.toFixed(1)}
                          </p>
                        </div>
                        <div>
                          <p className={cn("text-wl-text-tertiary mb-1")}>Price/Gal</p>
                          <p className={cn("font-bold text-wl-text-primary")}>
                            ${txn.costPerGallon.toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className={cn("text-wl-text-tertiary mb-1")}>Provider</p>
                          <p className={cn("font-bold text-wl-text-primary")}>
                            {provider?.name}
                          </p>
                        </div>
                        <div>
                          <p className={cn("text-wl-text-tertiary mb-1")}>Fraud Risk</p>
                          <p
                            className={cn(
                              "font-bold",
                              txn.fraudRisk === "LOW"
                                ? "text-wl-success-400"
                                : txn.fraudRisk === "MEDIUM"
                                  ? "text-wl-warning-400"
                                  : "text-wl-danger-400"
                            )}
                          >
                            {txn.fraudRisk}
                          </p>
                        </div>
                      </div>
                    </div>

                    {txn.fraudRisk !== "LOW" && (
                      <div
                        className={cn(
                          "mb-3 p-2 rounded border",
                          txn.fraudRisk === "MEDIUM"
                            ? "bg-[rgba(245,158,11,0.1)] border-wl-warning-400 border-opacity-30"
                            : "bg-[rgba(239,68,68,0.1)] border-wl-danger-400 border-opacity-30"
                        )}
                      >
                        <p
                          className={cn(
                            "text-xs font-semibold",
                            txn.fraudRisk === "MEDIUM"
                              ? "text-wl-warning-400"
                              : "text-wl-danger-400"
                          )}
                        >
                          {txn.fraudRisk === "MEDIUM"
                            ? "⚠️ Unusual purchase pattern detected"
                            : "🚨 High-risk transaction - Manual review recommended"}
                        </p>
                      </div>
                    )}

                    <div className={cn("flex gap-2")}>
                      <Button variant="secondary" size="sm">
                        View Details
                      </Button>
                      {txn.fraudRisk !== "LOW" && txn.status !== "APPROVED" && (
                        <Button variant="ghost" size="sm">
                          Approve
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Analytics View */}
        {view === "analytics" && (
          <div className={cn("space-y-4")}>
            <h3 className={cn("text-sm font-semibold text-wl-text-primary mb-4")}>
              Fuel Cost Analytics
            </h3>

            {FUEL_ANALYTICS.map((analytics, idx) => {
              const isCurrentMonth = idx === 0;
              const previous = FUEL_ANALYTICS[idx + 1];
              const gallonChange = previous
                ? (((analytics.totalGallons - previous.totalGallons) /
                    previous.totalGallons) *
                  100).toFixed(1)
                : 0;
              const mpgChange = previous
                ? (analytics.avgMPG - previous.avgMPG).toFixed(2)
                : 0;

              return (
                <Card
                  key={`analytics-${analytics.month}`}
                  className={cn(
                    "wl-animate-in",
                    isCurrentMonth && "ring-1 ring-wl-primary-400"
                  )}
                  style={{ animationDelay: `${idx * 40}ms` }}
                >
                  <div className={cn("p-4")}>
                    <div className={cn("flex items-center justify-between mb-4")}>
                      <p className={cn("text-sm font-semibold text-wl-text-primary")}>
                        {analytics.month}
                        {isCurrentMonth && (
                          <span className={cn("ml-2 text-xs px-2 py-0.5 rounded bg-wl-primary-500 text-wl-text-inverse")}>
                            Current
                          </span>
                        )}
                      </p>
                    </div>

                    <div className={cn("grid grid-cols-2 md:grid-cols-5 gap-3 mb-4")}>
                      <div className={cn("bg-wl-bg-surface rounded p-2")}>
                        <p className={cn("text-xs text-wl-text-tertiary mb-1")}>Total Cost</p>
                        <p className={cn("text-lg font-bold text-wl-text-primary")}>
                          ${analytics.totalCost.toLocaleString("en-US", {
                            maximumFractionDigits: 0,
                          })}
                        </p>
                      </div>
                      <div className={cn("bg-wl-bg-surface rounded p-2")}>
                        <p className={cn("text-xs text-wl-text-tertiary mb-1")}>Gallons</p>
                        <p className={cn("text-lg font-bold text-wl-text-primary")}>
                          {analytics.totalGallons.toLocaleString()}
                        </p>
                        {previous && (
                          <p
                            className={cn(
                              "text-xs font-semibold mt-1",
                              parseFloat(gallonChange) > 0
                                ? "text-wl-danger-400"
                                : "text-wl-success-400"
                            )}
                          >
                            {parseFloat(gallonChange) > 0 ? "+" : ""}{gallonChange}%
                          </p>
                        )}
                      </div>
                      <div className={cn("bg-wl-bg-surface rounded p-2")}>
                        <p className={cn("text-xs text-wl-text-tertiary mb-1")}>Avg Price/Gal</p>
                        <p className={cn("text-lg font-bold text-wl-text-primary")}>
                          ${analytics.avgPricePerGallon.toFixed(2)}
                        </p>
                      </div>
                      <div className={cn("bg-wl-bg-surface rounded p-2")}>
                        <p className={cn("text-xs text-wl-text-tertiary mb-1")}>Avg MPG</p>
                        <p className={cn("text-lg font-bold text-wl-text-primary")}>
                          {analytics.avgMPG.toFixed(1)}
                        </p>
                        {previous && (
                          <p
                            className={cn(
                              "text-xs font-semibold mt-1",
                              parseFloat(mpgChange) > 0
                                ? "text-wl-success-400"
                                : "text-wl-danger-400"
                            )}
                          >
                            {parseFloat(mpgChange) > 0 ? "+" : ""}{mpgChange}
                          </p>
                        )}
                      </div>
                      <div className={cn("bg-wl-bg-surface rounded p-2")}>
                        <p className={cn("text-xs text-wl-text-tertiary mb-1")}>Estimated Waste</p>
                        <p className={cn("text-lg font-bold text-wl-warning-400")}>
                          {analytics.estimatedWaste} gal
                        </p>
                      </div>
                    </div>

                    <div className={cn("grid grid-cols-3 gap-3 text-xs text-wl-text-tertiary")}>
                      <span>
                        Transactions:{" "}
                        <span className={cn("font-semibold text-wl-text-primary")}>
                          {analytics.transactionCount}
                        </span>
                      </span>
                      <span>
                        Locations:{" "}
                        <span className={cn("font-semibold text-wl-text-primary")}>
                          {analytics.uniqueLocations}
                        </span>
                      </span>
                      <span className={cn("text-right")}>
                        <Button variant="ghost" size="sm" className={cn("text-xs")}>
                          Download Report
                        </Button>
                      </span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Stations View */}
        {view === "stations" && (
          <div className={cn("space-y-3")}>
            <h3 className={cn("text-sm font-semibold text-wl-text-primary mb-4")}>
              Nearby Station Network ({STATION_NETWORK.length})
            </h3>

            {STATION_NETWORK.map((station, idx) => (
              <Card key={station.id} className={cn("wl-animate-in")} style={{ animationDelay: `${idx * 40}ms` }}>
                <div className={cn("p-4")}>
                  <div className={cn("flex items-start justify-between mb-3")}>
                    <div className={cn("flex items-center gap-3 flex-1 min-w-0")}>
                      <MapPin size={16} className={cn("text-wl-primary-400 shrink-0")} />
                      <div className={cn("min-w-0")}>
                        <p className={cn("text-sm font-semibold text-wl-text-primary")}>
                          {station.name}
                        </p>
                        <p className={cn("text-xs text-wl-text-tertiary mt-1")}>
                          {station.distance} mi away • {station.location}
                        </p>
                      </div>
                    </div>
                    <div className={cn("text-right shrink-0")}>
                      <p className={cn("text-lg font-bold text-wl-primary-400")}>
                        ${station.pricePerGallon.toFixed(2)}
                      </p>
                      <p className={cn("text-xs text-wl-text-tertiary")}>per gallon</p>
                    </div>
                  </div>

                  <div className={cn("flex items-center gap-2 mb-3")}>
                    <div className={cn("flex items-center gap-1")}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <span
                          key={i}
                          className={cn(
                            "text-sm",
                            i < Math.floor(station.rating) ? "⭐" : "☆"
                          )}
                        />
                      ))}
                    </div>
                    <span className={cn("text-xs text-wl-text-tertiary")}>
                      {station.rating.toFixed(1)}
                    </span>
                    {station.partnered && (
                      <Badge variant="success" size="sm">
                        Partner
                      </Badge>
                    )}
                  </div>

                  {station.amenities.length > 0 && (
                    <div className={cn("mb-3")}>
                      <p className={cn("text-xs text-wl-text-tertiary mb-1")}>Amenities:</p>
                      <div className={cn("flex flex-wrap gap-1")}>
                        {station.amenities.map((amenity) => (
                          <span
                            key={amenity}
                            className={cn(
                              "text-xs px-2 py-0.5 rounded bg-wl-bg-surface text-wl-text-tertiary"
                            )}
                          >
                            {amenity}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <p className={cn("text-xs text-wl-text-tertiary mb-3")}>
                    Last updated: {station.lastPriceUpdate}
                  </p>

                  <Button variant="secondary" size="sm">
                    View on Map
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Reports View */}
        {view === "reports" && (
          <div className={cn("space-y-3")}>
            <div className={cn("flex items-center justify-between mb-4")}>
              <h3 className={cn("text-sm font-semibold text-wl-text-primary")}>
                Monthly Reports
              </h3>
              <Button variant="secondary" size="sm">
                <Download size={14} className={cn("mr-1")} />
                Export
              </Button>
            </div>

            {MONTHLY_REPORTS.map((report, idx) => (
              <Card
                key={`report-${report.month}`}
                className={cn("wl-animate-in")}
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                <div className={cn("p-4")}>
                  <div className={cn("flex items-center justify-between mb-4")}>
                    <p className={cn("text-sm font-semibold text-wl-text-primary")}>
                      {report.month}
                    </p>
                    <Button variant="ghost" size="sm">
                      <Download size={14} />
                    </Button>
                  </div>

                  <div className={cn("grid grid-cols-2 md:grid-cols-5 gap-3 mb-4")}>
                    {[
                      { label: "Total Cost", value: `$${report.totalCost.toLocaleString("en-US", { maximumFractionDigits: 0 })}`, color: "text-wl-primary-400" },
                      { label: "Gallons", value: report.totalGallons.toLocaleString(), color: "text-wl-text-primary" },
                      { label: "Avg MPG", value: report.avgMPG.toFixed(1), color: "text-wl-success-400" },
                      { label: "Compliance", value: `${report.complianceScore}%`, color: "text-wl-info-400" },
                      { label: "Fraud Alerts", value: report.fraudAlerts, color: report.fraudAlerts > 0 ? "text-wl-danger-400" : "text-wl-text-primary" },
                    ].map((stat) => (
                      <div key={stat.label} className={cn("bg-wl-bg-surface rounded p-2")}>
                        <p className={cn("text-xs text-wl-text-tertiary mb-1")}>
                          {stat.label}
                        </p>
                        <p className={cn(`text-lg font-bold ${stat.color}`)}>
                          {stat.value}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className={cn("text-xs text-wl-text-tertiary")}>
                    {report.driverCount} drivers • {report.vehicleCount} vehicles
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
