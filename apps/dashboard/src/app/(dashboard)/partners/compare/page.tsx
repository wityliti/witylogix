"use client";

import { useState, useCallback, useMemo } from "react";
import { ArrowLeft, Star, CheckCircle, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useApiList } from '@/hooks/use-api';

interface Courier {
  id: string;
  name: string;
  priceRange: { min: number; max: number };
  deliverySpeed: string;
  coverageAreas: number;
  successRate: number;
  rating: number;
  totalRatings: number;
  features: {
    realTimeTracking: boolean;
    proofOfDelivery: boolean;
    insurance: boolean;
  };
}

const MOCK_COURIERS: Courier[] = [
  {
    id: "onfleet",
    name: "Onfleet",
    priceRange: { min: 2.5, max: 8.5 },
    deliverySpeed: "2-4 hours",
    coverageAreas: 45,
    successRate: 98.5,
    rating: 4.8,
    totalRatings: 2341,
    features: {
      realTimeTracking: true,
      proofOfDelivery: true,
      insurance: true,
    },
  },
  {
    id: "stuart",
    name: "Stuart",
    priceRange: { min: 3.0, max: 9.0 },
    deliverySpeed: "2-3 hours",
    coverageAreas: 38,
    successRate: 97.2,
    rating: 4.6,
    totalRatings: 1256,
    features: {
      realTimeTracking: true,
      proofOfDelivery: true,
      insurance: false,
    },
  },
  {
    id: "uber-direct",
    name: "Uber Direct",
    priceRange: { min: 2.0, max: 7.5 },
    deliverySpeed: "1-2 hours",
    coverageAreas: 52,
    successRate: 99.1,
    rating: 4.9,
    totalRatings: 3567,
    features: {
      realTimeTracking: true,
      proofOfDelivery: true,
      insurance: true,
    },
  },
  {
    id: "dhl",
    name: "DHL Express",
    priceRange: { min: 8.0, max: 25.0 },
    deliverySpeed: "Next Day",
    coverageAreas: 195,
    successRate: 99.8,
    rating: 4.7,
    totalRatings: 890,
    features: {
      realTimeTracking: true,
      proofOfDelivery: true,
      insurance: true,
    },
  },
  {
    id: "fedex",
    name: "FedEx",
    priceRange: { min: 9.0, max: 28.0 },
    deliverySpeed: "Next Day",
    coverageAreas: 220,
    successRate: 99.6,
    rating: 4.5,
    totalRatings: 745,
    features: {
      realTimeTracking: false,
      proofOfDelivery: true,
      insurance: true,
    },
  },
  {
    id: "road-runner",
    name: "Road Runner",
    priceRange: { min: 3.5, max: 10.0 },
    deliverySpeed: "3-5 hours",
    coverageAreas: 28,
    successRate: 96.8,
    rating: 4.4,
    totalRatings: 612,
    features: {
      realTimeTracking: true,
      proofOfDelivery: false,
      insurance: false,
    },
  },
];

export default function ComparePage() {
  const router = useRouter();
  const [selectedCouriers, setSelectedCouriers] = useState<string[]>([]);

  const handleToggleCourier = useCallback((courierId: string) => {
    setSelectedCouriers((prev) => {
      if (prev.includes(courierId)) {
        return prev.filter((id) => id !== courierId);
      } else if (prev.length < 4) {
        return [...prev, courierId];
      }
      return prev;
    });
  }, []);

  const comparisonCouriers = useMemo(() => {
    return MOCK_COURIERS.filter((c) => selectedCouriers.includes(c.id));
  }, [selectedCouriers]);

  const canAddMore = selectedCouriers.length < 4;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="md"
          onClick={() => router.back()}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-white">
          Compare Couriers
        </h1>
        <p className="text-gray-300">
          Select up to 4 couriers to compare side-by-side
        </p>
      </div>

      {/* Courier Selection Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {MOCK_COURIERS.map((courier) => {
          const isSelected = selectedCouriers.includes(courier.id);
          const isDisabled = !isSelected && !canAddMore;

          return (
            <Card
              key={courier.id}
              hover
              onClick={() => !isDisabled && handleToggleCourier(courier.id)}
              className={cn(
                "cursor-pointer transition-all",
                isSelected && "ring-2 ring-blue-400 bg-blue-500/10"
              )}
            >
              <CardContent className="pt-0">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-white">
                      {courier.name}
                    </h3>
                    <div className="flex items-center gap-1 mt-1">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={cn(
                            "w-3 h-3",
                            i < Math.floor(courier.rating)
                              ? "fill-amber-400 text-amber-400"
                              : "text-[#1e1e2e]"
                          )}
                        />
                      ))}
                      <span className="text-xs text-gray-300 ml-1">
                        {courier.rating.toFixed(1)}
                      </span>
                    </div>
                  </div>

                  {isSelected ? (
                    <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="w-4 h-4 text-black" />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full border-2 border-[#1e1e2e] flex-shrink-0" />
                  )}
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-300">Price Range:</span>
                    <span className="text-white font-medium">
                      ${courier.priceRange.min} - ${courier.priceRange.max}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Speed:</span>
                    <span className="text-white font-medium">
                      {courier.deliverySpeed}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Coverage:</span>
                    <span className="text-white font-medium">
                      {courier.coverageAreas} areas
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Success Rate:</span>
                    <span className="text-white font-medium">
                      {courier.successRate}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Comparison Table */}
      {comparisonCouriers.length > 0 && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Detailed Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#1e1e2e]">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-300">
                      Feature
                    </th>
                    {comparisonCouriers.map((courier) => (
                      <th
                        key={courier.id}
                        className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-300"
                      >
                        <div className="flex items-center justify-center gap-2">
                          {courier.name}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleCourier(courier.id);
                            }}
                            className="hover:text-red-400 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-wl-border-subtle">
                  {/* Price Range */}
                  <tr>
                    <td className="px-4 py-3 font-semibold text-white">
                      Price Range
                    </td>
                    {comparisonCouriers.map((courier) => (
                      <td
                        key={courier.id}
                        className="px-4 py-3 text-center text-white"
                      >
                        <span className="inline-flex items-center px-2 py-1 rounded bg-blue-500/20 text-blue-400 text-xs font-semibold">
                          ${courier.priceRange.min} - ${courier.priceRange.max}
                        </span>
                      </td>
                    ))}
                  </tr>

                  {/* Delivery Speed */}
                  <tr>
                    <td className="px-4 py-3 font-semibold text-white">
                      Delivery Speed
                    </td>
                    {comparisonCouriers.map((courier) => (
                      <td
                        key={courier.id}
                        className="px-4 py-3 text-center text-white"
                      >
                        {courier.deliverySpeed}
                      </td>
                    ))}
                  </tr>

                  {/* Coverage Areas */}
                  <tr>
                    <td className="px-4 py-3 font-semibold text-white">
                      Coverage Areas
                    </td>
                    {comparisonCouriers.map((courier) => (
                      <td
                        key={courier.id}
                        className="px-4 py-3 text-center text-white"
                      >
                        {courier.coverageAreas}
                      </td>
                    ))}
                  </tr>

                  {/* Success Rate */}
                  <tr>
                    <td className="px-4 py-3 font-semibold text-white">
                      Success Rate
                    </td>
                    {comparisonCouriers.map((courier) => (
                      <td
                        key={courier.id}
                        className="px-4 py-3 text-center text-white"
                      >
                        <span className="inline-flex items-center px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 text-xs font-semibold">
                          {courier.successRate}%
                        </span>
                      </td>
                    ))}
                  </tr>

                  {/* Rating */}
                  <tr>
                    <td className="px-4 py-3 font-semibold text-white">
                      Rating
                    </td>
                    {comparisonCouriers.map((courier) => (
                      <td
                        key={courier.id}
                        className="px-4 py-3 text-center text-white"
                      >
                        <div className="flex items-center justify-center gap-2">
                          <div className="flex items-center gap-1">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={cn(
                                  "w-3 h-3",
                                  i < Math.floor(courier.rating)
                                    ? "fill-amber-400 text-amber-400"
                                    : "text-[#1e1e2e]"
                                )}
                              />
                            ))}
                          </div>
                          <span className="text-xs">
                            {courier.rating.toFixed(1)}
                          </span>
                        </div>
                      </td>
                    ))}
                  </tr>

                  {/* Real-time Tracking */}
                  <tr>
                    <td className="px-4 py-3 font-semibold text-white">
                      Real-time Tracking
                    </td>
                    {comparisonCouriers.map((courier) => (
                      <td
                        key={courier.id}
                        className="px-4 py-3 text-center text-white"
                      >
                        {courier.features.realTimeTracking ? (
                          <span className="inline-flex items-center px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 text-xs font-semibold gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Yes
                          </span>
                        ) : (
                          <span className="text-gray-300 text-sm">
                            No
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* Proof of Delivery */}
                  <tr>
                    <td className="px-4 py-3 font-semibold text-white">
                      Proof of Delivery
                    </td>
                    {comparisonCouriers.map((courier) => (
                      <td
                        key={courier.id}
                        className="px-4 py-3 text-center text-white"
                      >
                        {courier.features.proofOfDelivery ? (
                          <span className="inline-flex items-center px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 text-xs font-semibold gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Yes
                          </span>
                        ) : (
                          <span className="text-gray-300 text-sm">
                            No
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* Insurance */}
                  <tr>
                    <td className="px-4 py-3 font-semibold text-white">
                      Insurance
                    </td>
                    {comparisonCouriers.map((courier) => (
                      <td
                        key={courier.id}
                        className="px-4 py-3 text-center text-white"
                      >
                        {courier.features.insurance ? (
                          <span className="inline-flex items-center px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 text-xs font-semibold gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Yes
                          </span>
                        ) : (
                          <span className="text-gray-300 text-sm">
                            No
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {comparisonCouriers.length === 0 && (
        <Card className="py-12 text-center">
          <div className="flex flex-col items-center gap-2">
            <p className="text-gray-300">
              Select couriers above to compare them
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
