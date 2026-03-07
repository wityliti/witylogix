/**
 * ShippingProfileCard — Card component for displaying shipping profile information.
 *
 * Displays shipping profile details including delivery method, rate type,
 * base rate, linked locations, active status, and action buttons.
 */

interface ShippingProfile {
  id: string;
  name: string;
  deliveryMethod: string;
  rateType: string;
  baseRate: number;
  currency: string;
  linkedLocations: number;
  isActive: boolean;
}

interface ShippingProfileCardProps {
  profile: ShippingProfile;
  onEdit?: (id: string) => void;
  onDuplicate?: (id: string) => void;
}

const DELIVERY_METHOD_CONFIG: Record<
  string,
  { label: string; bgColor: string; textColor: string }
> = {
  STANDARD: {
    label: "Standard",
    bgColor: "#e8f0fe",
    textColor: "#1a3a6e",
  },
  EXPRESS: {
    label: "Express",
    bgColor: "#e0f0ff",
    textColor: "#003b73",
  },
  OVERNIGHT: {
    label: "Overnight",
    bgColor: "#ede8ff",
    textColor: "#3d2e66",
  },
  GROUND: {
    label: "Ground",
    bgColor: "#e6f7ef",
    textColor: "#004d33",
  },
};

const RATE_TYPE_CONFIG: Record<
  string,
  { label: string; bgColor: string; textColor: string }
> = {
  FIXED: {
    label: "Fixed Rate",
    bgColor: "#fef3c7",
    textColor: "#92400e",
  },
  PERCENTAGE: {
    label: "Percentage",
    bgColor: "#ccf1e2",
    textColor: "#005c35",
  },
  WEIGHT_BASED: {
    label: "Weight Based",
    bgColor: "#f5f0ff",
    textColor: "#4b2d8e",
  },
};

export function ShippingProfileCard({
  profile,
  onEdit,
  onDuplicate,
}: ShippingProfileCardProps) {
  const deliveryMethodConfig = DELIVERY_METHOD_CONFIG[profile.deliveryMethod] ?? {
    label: profile.deliveryMethod,
    bgColor: "#f1f2f3",
    textColor: "#6d7175",
  };

  const rateTypeConfig = RATE_TYPE_CONFIG[profile.rateType] ?? {
    label: profile.rateType,
    bgColor: "#f1f2f3",
    textColor: "#6d7175",
  };

  const formatRate = (rate: number, currency: string): string => {
    return `${currency} ${rate.toFixed(2)}`;
  };

  return (
    <div
      style={{
        backgroundColor: "#ffffff",
        border: "1px solid #d9dcde",
        borderRadius: "8px",
        padding: "16px",
        marginBottom: "12px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "12px",
        }}
      >
        <div style={{ flex: 1 }}>
          <h3
            style={{
              margin: "0 0 8px 0",
              fontSize: "16px",
              fontWeight: 600,
              color: "#202223",
            }}
          >
            {profile.name}
          </h3>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <span
              style={{
                display: "inline-block",
                padding: "2px 8px",
                fontSize: "11px",
                fontWeight: 600,
                lineHeight: 1.4,
                borderRadius: 20,
                backgroundColor: deliveryMethodConfig.bgColor,
                color: deliveryMethodConfig.textColor,
                whiteSpace: "nowrap",
              }}
            >
              {deliveryMethodConfig.label}
            </span>
            <span
              style={{
                display: "inline-block",
                padding: "2px 8px",
                fontSize: "11px",
                fontWeight: 600,
                lineHeight: 1.4,
                borderRadius: 20,
                backgroundColor: rateTypeConfig.bgColor,
                color: rateTypeConfig.textColor,
                whiteSpace: "nowrap",
              }}
            >
              {rateTypeConfig.label}
            </span>
          </div>
        </div>
        <div>
          <span
            style={{
              display: "inline-block",
              padding: "2px 8px",
              fontSize: "11px",
              fontWeight: 600,
              borderRadius: 20,
              backgroundColor: profile.isActive ? "#e6f7ef" : "#f1f2f3",
              color: profile.isActive ? "#004d33" : "#6d7175",
              whiteSpace: "nowrap",
            }}
          >
            {profile.isActive ? "Active" : "Inactive"}
          </span>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "12px",
          marginBottom: "12px",
        }}
      >
        <div style={{ fontSize: "13px", color: "#6d7175" }}>
          <div style={{ color: "#9c9da0", marginBottom: "2px" }}>Base Rate</div>
          <div style={{ fontWeight: 500, color: "#202223", fontSize: "14px" }}>
            {formatRate(profile.baseRate, profile.currency)}
          </div>
        </div>
        <div style={{ fontSize: "13px", color: "#6d7175" }}>
          <div style={{ color: "#9c9da0", marginBottom: "2px" }}>
            Linked Locations
          </div>
          <div style={{ fontWeight: 500, color: "#202223", fontSize: "14px" }}>
            {profile.linkedLocations}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: "8px",
          justifyContent: "flex-end",
        }}
      >
        {onDuplicate && (
          <button
            onClick={() => onDuplicate(profile.id)}
            style={{
              padding: "6px 12px",
              fontSize: "13px",
              fontWeight: 500,
              color: "#6d7175",
              backgroundColor: "transparent",
              border: "1px solid #d9dcde",
              borderRadius: "4px",
              cursor: "pointer",
              transition: "background-color 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#f1f2f3";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            Duplicate
          </button>
        )}
        {onEdit && (
          <button
            onClick={() => onEdit(profile.id)}
            style={{
              padding: "6px 12px",
              fontSize: "13px",
              fontWeight: 500,
              color: "#0061ff",
              backgroundColor: "transparent",
              border: "1px solid #0061ff",
              borderRadius: "4px",
              cursor: "pointer",
              transition: "background-color 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#f0f6ff";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            Edit
          </button>
        )}
      </div>
    </div>
  );
}
