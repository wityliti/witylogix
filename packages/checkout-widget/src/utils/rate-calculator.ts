/**
 * Rate Calculator
 * Calculates delivery rates based on zone, order value, and weight
 */

import type { ZoneRate } from '../types';

/**
 * Calculate delivery cost for an order
 */
export const calculateDeliveryCost = (
  zoneRate: ZoneRate,
  orderValue: number,
  distanceKm: number = 0,
  weightKg: number = 0
): number => {
  // Check if order qualifies for free delivery
  if (orderValue >= zoneRate.freeDeliveryThreshold) {
    return 0;
  }

  let cost = zoneRate.baseRate;

  // Add distance fee
  if (distanceKm > 0) {
    cost += distanceKm * zoneRate.distanceFeePerKm;
  }

  // Add weight surcharge
  if (weightKg > 0) {
    cost += weightKg * zoneRate.weightSurchargePerKg;
  }

  return Math.round(cost * 100) / 100; // Round to 2 decimals
};

/**
 * Calculate total order cost including delivery
 */
export const calculateTotalCost = (
  subtotal: number,
  zoneRate: ZoneRate,
  distanceKm: number = 0,
  weightKg: number = 0
): number => {
  const deliveryCost = calculateDeliveryCost(zoneRate, subtotal, distanceKm, weightKg);
  return Math.round((subtotal + deliveryCost) * 100) / 100;
};

/**
 * Get free delivery threshold message
 */
export const getFreeDeliveryMessage = (
  zoneRate: ZoneRate,
  currentOrderValue: number
): string => {
  if (currentOrderValue >= zoneRate.freeDeliveryThreshold) {
    return 'Free delivery applied!';
  }

  const remaining = zoneRate.freeDeliveryThreshold - currentOrderValue;
  return `Add ${zoneRate.currency} ${remaining.toFixed(2)} more for free delivery`;
};

/**
 * Get cost breakdown
 */
export interface CostBreakdown {
  baseRate: number;
  distanceFee: number;
  weightSurcharge: number;
  subtotal: number;
  deliveryFee: number;
  total: number;
  currency: string;
}

export const getCostBreakdown = (
  orderValue: number,
  zoneRate: ZoneRate,
  distanceKm: number = 0,
  weightKg: number = 0
): CostBreakdown => {
  const baseRate = zoneRate.baseRate;
  const distanceFee = distanceKm > 0 ? distanceKm * zoneRate.distanceFeePerKm : 0;
  const weightSurcharge = weightKg > 0 ? weightKg * zoneRate.weightSurchargePerKg : 0;

  let deliveryFee = baseRate + distanceFee + weightSurcharge;

  // Apply free delivery threshold
  if (orderValue >= zoneRate.freeDeliveryThreshold) {
    deliveryFee = 0;
  }

  const subtotal = orderValue;
  const total = subtotal + deliveryFee;

  return {
    baseRate: Math.round(baseRate * 100) / 100,
    distanceFee: Math.round(distanceFee * 100) / 100,
    weightSurcharge: Math.round(weightSurcharge * 100) / 100,
    subtotal: Math.round(subtotal * 100) / 100,
    deliveryFee: Math.round(deliveryFee * 100) / 100,
    total: Math.round(total * 100) / 100,
    currency: zoneRate.currency,
  };
};

/**
 * Format price for display
 */
export const formatPrice = (price: number, currency: string = 'USD'): string => {
  const currencySymbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    INR: '₹',
    AUD: 'A$',
    CAD: 'C$',
  };

  const symbol = currencySymbols[currency] || currency;
  return `${symbol}${price.toFixed(2)}`;
};

/**
 * Check if order qualifies for free delivery
 */
export const qualifiesForFreeDelivery = (orderValue: number, threshold: number): boolean => {
  return orderValue >= threshold;
};

/**
 * Get savings message for free delivery
 */
export const getSavingsMessage = (
  orderValue: number,
  zoneRate: ZoneRate
): string | null => {
  if (!qualifiesForFreeDelivery(orderValue, zoneRate.freeDeliveryThreshold)) {
    return null;
  }

  const normalDeliveryFee = zoneRate.baseRate;
  return `You're saving ${formatPrice(normalDeliveryFee, zoneRate.currency)} on delivery!`;
};

/**
 * Calculate distance-based rate
 */
export const calculateDistanceRate = (
  baseZoneRate: ZoneRate,
  distanceKm: number
): number => {
  return baseZoneRate.baseRate + distanceKm * baseZoneRate.distanceFeePerKm;
};

/**
 * Validate rate calculation (sanity check)
 */
export const isValidRate = (rate: number): boolean => {
  return rate >= 0 && !isNaN(rate) && isFinite(rate);
};
