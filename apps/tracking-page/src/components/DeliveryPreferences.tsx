import React, { useState } from "react";

interface PreferencesState {
  safePlace: string;
  instructions: string;
  photoEnabled: boolean;
  contactPreference: "call" | "text" | "email";
  timePreference: "morning" | "afternoon" | "evening";
  leaveWithNeighbor: boolean;
  neighborName: string;
}

interface DeliveryPreferencesProps {
  onSave?: (preferences: PreferencesState) => void;
  initialState?: Partial<PreferencesState>;
}

const DeliveryPreferences: React.FC<DeliveryPreferencesProps> = ({
  onSave,
  initialState = {},
}) => {
  const [preferences, setPreferences] = useState<PreferencesState>({
    safePlace: "front door",
    instructions: "",
    photoEnabled: false,
    contactPreference: "text",
    timePreference: "afternoon",
    leaveWithNeighbor: false,
    neighborName: "",
    ...initialState,
  });

  const [saved, setSaved] = useState(false);

  const handleSafePlace = (value: string) => {
    setPreferences((prev) => ({ ...prev, safePlace: value }));
    setSaved(false);
  };

  const handleInstructions = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPreferences((prev) => ({ ...prev, instructions: e.target.value }));
    setSaved(false);
  };

  const handlePhotoToggle = () => {
    setPreferences((prev) => ({ ...prev, photoEnabled: !prev.photoEnabled }));
    setSaved(false);
  };

  const handleContactPreference = (value: "call" | "text" | "email") => {
    setPreferences((prev) => ({ ...prev, contactPreference: value }));
    setSaved(false);
  };

  const handleTimePreference = (value: "morning" | "afternoon" | "evening") => {
    setPreferences((prev) => ({ ...prev, timePreference: value }));
    setSaved(false);
  };

  const handleNeighborToggle = () => {
    setPreferences((prev) => ({
      ...prev,
      leaveWithNeighbor: !prev.leaveWithNeighbor,
      neighborName: !prev.leaveWithNeighbor ? prev.neighborName : "",
    }));
    setSaved(false);
  };

  const handleNeighborName = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPreferences((prev) => ({ ...prev, neighborName: e.target.value }));
    setSaved(false);
  };

  const handleSave = () => {
    onSave?.(preferences);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const safePlaces = [
    { value: "front door", label: "🚪 Front Door", icon: "🚪" },
    { value: "back door", label: "🔓 Back Door", icon: "🔓" },
    { value: "garage", label: "🏚️ Garage", icon: "🏚️" },
    { value: "neighbor", label: "👥 Neighbor", icon: "👥" },
    { value: "locker", label: "📦 Locker/Box", icon: "📦" },
  ];

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>Delivery Preferences</h2>
        <p style={styles.subtitle}>
          Customize how you'd like to receive your package
        </p>

        {/* Safe Place Selection */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Where to leave package?</h3>
          <p style={styles.sectionDescription}>
            Select your preferred safe place
          </p>
          <div style={styles.safePlacesGrid}>
            {safePlaces.map((place) => (
              <button
                key={place.value}
                onClick={() => handleSafePlace(place.value)}
                style={{
                  ...styles.safePlaceOption,
                  ...(preferences.safePlace === place.value
                    ? styles.safePlaceOptionActive
                    : styles.safePlaceOptionInactive),
                }}
              >
                <span style={styles.safePlaceIcon}>{place.icon}</span>
                <span style={styles.safePlaceLabel}>
                  {place.label.split(" ").slice(1).join(" ")}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Delivery Instructions */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Delivery Instructions</h3>
          <p style={styles.sectionDescription}>
            Add special instructions for the driver
          </p>
          <textarea
            value={preferences.instructions}
            onChange={handleInstructions}
            placeholder="e.g., Ring doorbell twice, leave on porch"
            maxLength={200}
            style={styles.textarea}
          />
          <p style={styles.charCount}>{preferences.instructions.length}/200</p>
        </div>

        {/* Photo Option */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Photo of Delivery Location</h3>
          <p style={styles.sectionDescription}>Ask driver to take a photo</p>
          <div style={styles.toggleContainer}>
            <button
              onClick={handlePhotoToggle}
              style={{
                ...styles.toggleButton,
                ...(preferences.photoEnabled ? styles.toggleButtonActive : {}),
              }}
            >
              <span style={styles.toggleSwitch} />
            </button>
            <span style={styles.toggleLabel}>
              {preferences.photoEnabled
                ? "✅ Driver will take photo"
                : "❌ No photo needed"}
            </span>
          </div>
        </div>

        {/* Contact Preference */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>How should we contact you?</h3>
          <p style={styles.sectionDescription}>Before delivery</p>
          <div style={styles.optionGrid}>
            {(["call", "text", "email"] as const).map((option) => (
              <button
                key={option}
                onClick={() => handleContactPreference(option)}
                style={{
                  ...styles.contactOption,
                  ...(preferences.contactPreference === option
                    ? styles.contactOptionActive
                    : styles.contactOptionInactive),
                }}
              >
                {option === "call" && "📞 Call"}
                {option === "text" && "💬 Text"}
                {option === "email" && "📧 Email"}
              </button>
            ))}
          </div>
        </div>

        {/* Time Preference */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Preferred Delivery Time</h3>
          <p style={styles.sectionDescription}>When is the best time?</p>
          <div style={styles.optionGrid}>
            {(["morning", "afternoon", "evening"] as const).map((time) => (
              <button
                key={time}
                onClick={() => handleTimePreference(time)}
                style={{
                  ...styles.timeOption,
                  ...(preferences.timePreference === time
                    ? styles.timeOptionActive
                    : styles.timeOptionInactive),
                }}
              >
                {time === "morning" && "🌅 Morning (6AM-12PM)"}
                {time === "afternoon" && "☀️ Afternoon (12PM-6PM)"}
                {time === "evening" && "🌙 Evening (6PM-9PM)"}
              </button>
            ))}
          </div>
        </div>

        {/* Leave with Neighbor */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Leave with Neighbor?</h3>
          <p style={styles.sectionDescription}>
            Authorize delivery to trusted neighbor
          </p>
          <div style={styles.toggleContainer}>
            <button
              onClick={handleNeighborToggle}
              style={{
                ...styles.toggleButton,
                ...(preferences.leaveWithNeighbor
                  ? styles.toggleButtonActive
                  : {}),
              }}
            >
              <span style={styles.toggleSwitch} />
            </button>
            <span style={styles.toggleLabel}>
              {preferences.leaveWithNeighbor ? "✅ Enabled" : "❌ Disabled"}
            </span>
          </div>

          {preferences.leaveWithNeighbor && (
            <input
              type="text"
              value={preferences.neighborName}
              onChange={handleNeighborName}
              placeholder="Neighbor's name (optional)"
              style={styles.neighborInput}
            />
          )}
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          style={{
            ...styles.saveButton,
            ...(saved ? styles.saveButtonSuccess : {}),
          }}
        >
          {saved ? "✅ Preferences Saved" : "Save Preferences"}
        </button>
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: "24px",
  } as React.CSSProperties,
  card: {
    background: "white",
    borderRadius: "12px",
    padding: "32px",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
  } as React.CSSProperties,
  title: {
    fontSize: "24px",
    fontWeight: "700",
    color: "#1a1a1a",
    margin: "0 0 8px 0",
  } as React.CSSProperties,
  subtitle: {
    fontSize: "14px",
    color: "#666",
    margin: "0 0 32px 0",
  } as React.CSSProperties,
  section: {
    marginBottom: "32px",
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: "16px",
    fontWeight: "700",
    color: "#1a1a1a",
    margin: "0 0 4px 0",
  } as React.CSSProperties,
  sectionDescription: {
    fontSize: "12px",
    color: "#999",
    margin: "0 0 12px 0",
  } as React.CSSProperties,
  safePlacesGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
    gap: "12px",
  } as React.CSSProperties,
  safePlaceOption: {
    padding: "16px 12px",
    border: "2px solid #e5e7eb",
    borderRadius: "8px",
    background: "white",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    transition: "all 0.2s",
  } as React.CSSProperties,
  safePlaceOptionActive: {
    borderColor: "#005bd3",
    background: "#eff6ff",
    color: "#005bd3",
  } as React.CSSProperties,
  safePlaceOptionInactive: {
    color: "#666",
  } as React.CSSProperties,
  safePlaceIcon: {
    fontSize: "24px",
  } as React.CSSProperties,
  safePlaceLabel: {
    fontSize: "12px",
    fontWeight: "500",
    textAlign: "center",
  } as React.CSSProperties,
  textarea: {
    width: "100%",
    minHeight: "100px",
    padding: "12px",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    fontSize: "13px",
    fontFamily: "inherit",
    resize: "none",
    outline: "none",
    boxSizing: "border-box",
  } as React.CSSProperties,
  charCount: {
    fontSize: "11px",
    color: "#999",
    margin: "6px 0 0 0",
    textAlign: "right",
  } as React.CSSProperties,
  toggleContainer: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  } as React.CSSProperties,
  toggleButton: {
    width: "48px",
    height: "24px",
    borderRadius: "12px",
    border: "none",
    background: "#d1d5db",
    cursor: "pointer",
    padding: "2px",
    display: "flex",
    alignItems: "center",
    transition: "background 0.2s",
    position: "relative",
  } as React.CSSProperties,
  toggleButtonActive: {
    background: "#10b981",
  } as React.CSSProperties,
  toggleSwitch: {
    width: "20px",
    height: "20px",
    borderRadius: "50%",
    background: "white",
    transition: "transform 0.2s",
    display: "block",
  } as React.CSSProperties,
  toggleLabel: {
    fontSize: "14px",
    color: "#666",
  } as React.CSSProperties,
  optionGrid: {
    display: "grid",
    gap: "12px",
  } as React.CSSProperties,
  contactOption: {
    padding: "12px 16px",
    border: "2px solid #e5e7eb",
    borderRadius: "8px",
    background: "white",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "500",
    transition: "all 0.2s",
  } as React.CSSProperties,
  contactOptionActive: {
    borderColor: "#005bd3",
    background: "#eff6ff",
    color: "#005bd3",
  } as React.CSSProperties,
  contactOptionInactive: {
    color: "#666",
  } as React.CSSProperties,
  timeOption: {
    padding: "12px 16px",
    border: "2px solid #e5e7eb",
    borderRadius: "8px",
    background: "white",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "500",
    textAlign: "left",
    transition: "all 0.2s",
  } as React.CSSProperties,
  timeOptionActive: {
    borderColor: "#005bd3",
    background: "#eff6ff",
    color: "#005bd3",
  } as React.CSSProperties,
  timeOptionInactive: {
    color: "#666",
  } as React.CSSProperties,
  neighborInput: {
    marginTop: "12px",
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #e5e7eb",
    borderRadius: "6px",
    fontSize: "13px",
    outline: "none",
    boxSizing: "border-box",
  } as React.CSSProperties,
  saveButton: {
    width: "100%",
    padding: "12px 24px",
    background: "#005bd3",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontSize: "15px",
    fontWeight: "700",
    cursor: "pointer",
    transition: "all 0.2s",
    marginTop: "24px",
  } as React.CSSProperties,
  saveButtonSuccess: {
    background: "#10b981",
  } as React.CSSProperties,
};

export default DeliveryPreferences;
