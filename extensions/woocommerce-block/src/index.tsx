/**
 * WooCommerce Delivery Scheduler Block
 * Main entry point for block registration
 */

import { registerBlockType } from "@wordpress/blocks";
import { useEffect, useState } from "@wordpress/element";
import metadata from "../../block.json";
import { DatePicker } from "./components/date-picker";
import { TimeSlots } from "./components/time-slots";
import { RateDisplay } from "./components/rate-display";
import { DeliveryNotes } from "./components/delivery-notes";
import {
  createWitylogixAPI,
  type SlotAvailability,
  type ZoneRate,
} from "./api/witylogix-api";
import "./styles/block.css";

/**
 * Block Component Props
 */
interface BlockProps {
  attributes: {
    apiUrl: string;
    merchantId: string;
    defaultView: "calendar" | "list";
    enableDeliveryNotes: boolean;
  };
}

/**
 * Main Block Component
 */
function DeliverySchedulerBlock({ attributes }: BlockProps) {
  const {
    apiUrl = "https://api.witylogix.app",
    merchantId = "",
    enableDeliveryNotes = true,
  } = attributes;

  // State management
  const [api, setApi] = useState<InstanceType<
    typeof import("./api/witylogix-api").WitylogixAPI
  > | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<SlotAvailability | null>(
    null,
  );
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [slots, setSlots] = useState<SlotAvailability[]>([]);
  const [rate, setRate] = useState<ZoneRate | null>(null);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isLoadingRate, setIsLoadingRate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shippingAddress, setShippingAddress] = useState<any | null>(null);

  /**
   * Initialize API client
   */
  useEffect(() => {
    try {
      if (apiUrl && merchantId) {
        const apiInstance = createWitylogixAPI(apiUrl, merchantId);
        setApi(apiInstance);
        setError(null);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to initialize API";
      setError(errorMessage);
      console.error("API initialization error:", err);
    }
  }, [apiUrl, merchantId]);

  /**
   * Fetch available slots when date changes
   */
  useEffect(() => {
    if (!api || !selectedDate) {
      setSlots([]);
      return;
    }

    const fetchSlots = async () => {
      setIsLoadingSlots(true);
      try {
        const zoneId = shippingAddress?.zone || undefined;
        const availableSlots = await api.fetchAvailableSlots(
          selectedDate,
          zoneId,
        );
        setSlots(availableSlots);
        setSelectedSlot(null);
        setError(null);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to fetch slots";
        setError(errorMessage);
        console.error("Slot fetch error:", err);
        setSlots([]);
      } finally {
        setIsLoadingSlots(false);
      }
    };

    fetchSlots();
  }, [api, selectedDate, shippingAddress?.zone]);

  /**
   * Fetch zone rates when shipping address changes
   */
  useEffect(() => {
    if (!api || !shippingAddress) {
      setRate(null);
      return;
    }

    const fetchRate = async () => {
      setIsLoadingRate(true);
      try {
        const zoneRate = await api.fetchZoneRates({
          street: shippingAddress.address_1 || "",
          city: shippingAddress.city || "",
          state: shippingAddress.state || "",
          zipcode: shippingAddress.postcode || "",
          country: shippingAddress.country || "US",
        });
        setRate(zoneRate);
        setError(null);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to fetch rates";
        setError(errorMessage);
        console.error("Rate fetch error:", err);
        setRate(null);
      } finally {
        setIsLoadingRate(false);
      }
    };

    fetchRate();
  }, [api, shippingAddress]);

  /**
   * Listen for shipping address changes
   */
  useEffect(() => {
    if (typeof window !== "undefined") {
      const handleAddressChange = (event: CustomEvent) => {
        setShippingAddress(event.detail);
      };

      window.addEventListener(
        "witylogix:address-changed",
        handleAddressChange as EventListener,
      );
      return () => {
        window.removeEventListener(
          "witylogix:address-changed",
          handleAddressChange as EventListener,
        );
      };
    }
  }, []);

  /**
   * Store selection in checkout data
   */
  useEffect(() => {
    if (selectedDate || selectedSlot || deliveryNotes) {
      const data = {
        date: selectedDate,
        slotId: selectedSlot?.id,
        slotLabel: selectedSlot?.label,
        timeGroup: selectedSlot?.timeGroup,
        notes: deliveryNotes,
      };

      if (typeof window !== "undefined") {
        // Store in window for access by WC hooks
        (window as any).__WITYLOGIX_DELIVERY__ = data;

        // Trigger event for form processors
        window.dispatchEvent(
          new CustomEvent("witylogix:selection-changed", { detail: data }),
        );
      }
    }
  }, [selectedDate, selectedSlot, deliveryNotes]);

  return (
    <div className="witylogix-delivery-scheduler-block">
      <div className="block-content">
        {/* Header */}
        <div className="block-header">
          <h2 className="block-title">Delivery Scheduling</h2>
          <p className="block-subtitle">
            Choose your preferred delivery date and time slot
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="block-error-alert" role="alert">
            <span className="error-icon">⚠️</span>
            <p className="error-message">{error}</p>
          </div>
        )}

        {/* Main Content Grid */}
        <div className="block-grid">
          {/* Left Column: Date & Time Selection */}
          <div className="block-column block-column--primary">
            {/* Date Picker */}
            <div className="block-section">
              <h3 className="section-title">Select Date</h3>
              <DatePicker
                onDateSelect={setSelectedDate}
                slots={slots}
                isLoading={isLoadingSlots}
              />
            </div>

            {/* Time Slots */}
            {selectedDate && (
              <div className="block-section">
                <h3 className="section-title">Select Time</h3>
                <TimeSlots
                  date={selectedDate}
                  slots={slots}
                  selectedSlotId={selectedSlot?.id}
                  onSlotSelect={setSelectedSlot}
                  isLoading={isLoadingSlots}
                />
              </div>
            )}
          </div>

          {/* Right Column: Rates & Notes */}
          <div className="block-column block-column--secondary">
            {/* Rate Display */}
            <div className="block-section">
              <h3 className="section-title">Delivery Rates</h3>
              <RateDisplay
                rate={rate}
                isLoading={isLoadingRate}
                error={!shippingAddress ? "Address required" : undefined}
              />
            </div>

            {/* Delivery Notes */}
            {enableDeliveryNotes && (
              <div className="block-section">
                <DeliveryNotes
                  value={deliveryNotes}
                  onChange={setDeliveryNotes}
                  placeholder="Gate code, building entrance, parking instructions..."
                  maxLength={500}
                />
              </div>
            )}

            {/* Selection Summary */}
            {selectedDate && (
              <div className="block-section block-section--summary">
                <h3 className="section-title">Your Selection</h3>
                <div className="summary-item">
                  <span className="summary-label">Date:</span>
                  <span className="summary-value">
                    {new Date(selectedDate).toLocaleDateString()}
                  </span>
                </div>

                {selectedSlot && (
                  <>
                    <div className="summary-item">
                      <span className="summary-label">Time:</span>
                      <span className="summary-value">
                        {selectedSlot.startTime} – {selectedSlot.endTime}
                      </span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">Period:</span>
                      <span className="summary-value">
                        {selectedSlot.timeGroup.charAt(0).toUpperCase() +
                          selectedSlot.timeGroup.slice(1)}
                      </span>
                    </div>
                  </>
                )}

                {selectedSlot?.price && selectedSlot.price > 0 && (
                  <div className="summary-item summary-item--price">
                    <span className="summary-label">Fee:</span>
                    <span className="summary-value">
                      +${(selectedSlot.price / 100).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Register the block
 */
registerBlockType(metadata.name, {
  ...metadata,
  edit: DeliverySchedulerBlock,
  save: () => null, // Dynamic block rendered server-side
});
