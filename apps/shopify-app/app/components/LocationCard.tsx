/**
 * LocationCard — Card component for displaying location information.
 *
 * Displays location details with type badge, address information,
 * active/inactive status, and action buttons.
 */

interface Location {
  id: string;
  name: string;
  type: string;
  addressLine1: string;
  city: string;
  state: string;
  isActive: boolean;
}

interface LocationCardProps {
  location: Location;
  onEdit?: (id: string) => void;
  onDeactivate?: (id: string) => void;
}

const LOCATION_TYPE_CONFIG: Record<
  string,
  { label: string; bgColor: string; textColor: string }
> = {
  WAREHOUSE: {
    label: "Warehouse",
    bgColor: "#e8f0fe",
    textColor: "#1a3a6e",
  },
  STORE: {
    label: "Store",
    bgColor: "#e6f7ef",
    textColor: "#004d33",
  },
  HUB: {
    label: "Hub",
    bgColor: "#fef3c7",
    textColor: "#92400e",
  },
  DROP_POINT: {
    label: "Drop Point",
    bgColor: "#f5f0ff",
    textColor: "#4b2d8e",
  },
};

export function LocationCard({
  location,
  onEdit,
  onDeactivate,
}: LocationCardProps) {
  const typeConfig = LOCATION_TYPE_CONFIG[location.type] ?? {
    label: location.type,
    bgColor: "#f1f2f3",
    textColor: "#6d7175",
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
            {location.name}
          </h3>
          <span
            style={{
              display: "inline-block",
              padding: "2px 8px",
              fontSize: "11px",
              fontWeight: 600,
              lineHeight: 1.4,
              borderRadius: 20,
              backgroundColor: typeConfig.bgColor,
              color: typeConfig.textColor,
              whiteSpace: "nowrap",
              marginBottom: "8px",
            }}
          >
            {typeConfig.label}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span
            style={{
              display: "inline-block",
              padding: "2px 8px",
              fontSize: "11px",
              fontWeight: 600,
              borderRadius: 20,
              backgroundColor: location.isActive ? "#e6f7ef" : "#f1f2f3",
              color: location.isActive ? "#004d33" : "#6d7175",
              whiteSpace: "nowrap",
            }}
          >
            {location.isActive ? "Active" : "Inactive"}
          </span>
        </div>
      </div>

      <div
        style={{
          marginBottom: "12px",
          fontSize: "13px",
          color: "#6d7175",
          lineHeight: 1.5,
        }}
      >
        <div>{location.addressLine1}</div>
        <div>
          {location.city}, {location.state}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: "8px",
          justifyContent: "flex-end",
        }}
      >
        {onEdit && (
          <button
            onClick={() => onEdit(location.id)}
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
        {onDeactivate && (
          <button
            onClick={() => onDeactivate(location.id)}
            style={{
              padding: "6px 12px",
              fontSize: "13px",
              fontWeight: 500,
              color: location.isActive ? "#bf0711" : "#6d7175",
              backgroundColor: "transparent",
              border: `1px solid ${location.isActive ? "#bf0711" : "#d9dcde"}`,
              borderRadius: "4px",
              cursor: location.isActive ? "pointer" : "not-allowed",
              opacity: location.isActive ? 1 : 0.5,
              transition: "background-color 0.2s ease",
            }}
            onMouseEnter={(e) => {
              if (location.isActive) {
                e.currentTarget.style.backgroundColor = "#fff0f0";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
            disabled={!location.isActive}
          >
            {location.isActive ? "Deactivate" : "Inactive"}
          </button>
        )}
      </div>
    </div>
  );
}
