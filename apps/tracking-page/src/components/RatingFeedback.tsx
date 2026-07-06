import React, { useState } from "react";

interface RatingFeedbackProps {
  driverName?: string;
  driverPhoto?: string;
  onSubmit?: (rating: number, feedback: string[], comment: string) => void;
  isDelivered?: boolean;
}

const RatingFeedback: React.FC<RatingFeedbackProps> = ({
  driverName = "John Martinez",
  driverPhoto = "👨",
  onSubmit,
  isDelivered = true,
}) => {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [selectedFeedback, setSelectedFeedback] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const feedbackChips = [
    { id: "on-time", label: "On time", icon: "⏱️" },
    { id: "friendly", label: "Friendly driver", icon: "😊" },
    { id: "intact", label: "Package intact", icon: "📦" },
    { id: "communication", label: "Good communication", icon: "💬" },
  ];

  const toggleFeedback = (id: string) => {
    setSelectedFeedback((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id],
    );
  };

  const handleSubmit = () => {
    if (rating > 0) {
      onSubmit?.(rating, selectedFeedback, comment);
      setSubmitted(true);
      setTimeout(() => {
        setRating(0);
        setSelectedFeedback([]);
        setComment("");
        setSubmitted(false);
      }, 3000);
    }
  };

  if (submitted) {
    return (
      <div style={styles.container}>
        <div style={styles.successCard}>
          <div style={styles.successIcon}>✅</div>
          <h3 style={styles.successTitle}>Thank You!</h3>
          <p style={styles.successMessage}>
            Your feedback helps us improve delivery services
          </p>
          <p style={styles.successRating}>
            You rated {driverName}{" "}
            <span style={styles.ratingStars}>{"⭐".repeat(rating)}</span>
          </p>
        </div>
      </div>
    );
  }

  if (!isDelivered) {
    return null;
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Header */}
        <h2 style={styles.title}>How was your delivery?</h2>
        <p style={styles.subtitle}>Your feedback helps us improve</p>

        {/* Driver Info */}
        <div style={styles.driverSection}>
          <div style={styles.driverPhoto}>{driverPhoto}</div>
          <div style={styles.driverInfo}>
            <p style={styles.driverName}>{driverName}</p>
            <p style={styles.driverRole}>Delivery Driver</p>
          </div>
        </div>

        {/* Rating Stars */}
        <div style={styles.ratingSection}>
          <p style={styles.ratingLabel}>Rate your delivery experience</p>
          <div style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                onClick={() => setRating(star)}
                style={styles.starButton}
              >
                <span
                  style={{
                    ...styles.star,
                    opacity: star <= (hoveredRating || rating) ? 1 : 0.2,
                    fontSize:
                      star <= (hoveredRating || rating) ? "36px" : "32px",
                    transition: "all 0.1s",
                  }}
                >
                  ⭐
                </span>
              </button>
            ))}
          </div>
          {rating > 0 && (
            <p style={styles.ratingText}>
              {rating === 1 && "Poor experience"}
              {rating === 2 && "Fair experience"}
              {rating === 3 && "Good experience"}
              {rating === 4 && "Very good experience"}
              {rating === 5 && "Excellent experience"}
            </p>
          )}
        </div>

        {/* Quick Feedback Chips */}
        <div style={styles.feedbackSection}>
          <p style={styles.feedbackLabel}>What went well?</p>
          <div style={styles.chipsContainer}>
            {feedbackChips.map((chip) => (
              <button
                key={chip.id}
                onClick={() => toggleFeedback(chip.id)}
                style={{
                  ...styles.chip,
                  ...(selectedFeedback.includes(chip.id)
                    ? styles.chipActive
                    : styles.chipInactive),
                }}
              >
                <span style={styles.chipIcon}>{chip.icon}</span>
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* Comment Section */}
        <div style={styles.commentSection}>
          <label style={styles.commentLabel}>
            <input
              type="checkbox"
              onChange={(e) => {
                if (!e.target.checked) setComment("");
              }}
              style={styles.commentCheckbox}
            />
            <span style={styles.commentLabelText}>
              Add a comment (optional)
            </span>
          </label>
          {comment !== "" && (
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share your experience..."
              maxLength={300}
              style={styles.commentTextarea}
            />
          )}
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={rating === 0}
          style={{
            ...styles.submitButton,
            ...(rating === 0 ? styles.submitButtonDisabled : {}),
          }}
        >
          {rating === 0 ? "Please rate to continue" : "Submit Feedback"}
        </button>

        {/* Privacy Note */}
        <p style={styles.privacyNote}>
          Your feedback is secure and helps improve our service
        </p>
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
    margin: "0 0 24px 0",
  } as React.CSSProperties,
  driverSection: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    padding: "16px",
    background: "#f9fafb",
    borderRadius: "8px",
    marginBottom: "24px",
  } as React.CSSProperties,
  driverPhoto: {
    fontSize: "40px",
    width: "56px",
    height: "56px",
    borderRadius: "8px",
    background: "#eff6ff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  } as React.CSSProperties,
  driverInfo: {
    flex: 1,
  } as React.CSSProperties,
  driverName: {
    fontSize: "14px",
    fontWeight: "700",
    color: "#1a1a1a",
    margin: "0 0 2px 0",
  } as React.CSSProperties,
  driverRole: {
    fontSize: "12px",
    color: "#999",
    margin: "0",
  } as React.CSSProperties,
  ratingSection: {
    textAlign: "center",
    marginBottom: "32px",
  } as React.CSSProperties,
  ratingLabel: {
    fontSize: "14px",
    fontWeight: "600",
    color: "#1a1a1a",
    margin: "0 0 12px 0",
  } as React.CSSProperties,
  starsContainer: {
    display: "flex",
    justifyContent: "center",
    gap: "8px",
    marginBottom: "12px",
  } as React.CSSProperties,
  starButton: {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "transform 0.2s",
  } as React.CSSProperties,
  star: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  } as React.CSSProperties,
  ratingText: {
    fontSize: "13px",
    color: "#666",
    margin: "0",
    fontWeight: "500",
  } as React.CSSProperties,
  feedbackSection: {
    marginBottom: "24px",
  } as React.CSSProperties,
  feedbackLabel: {
    fontSize: "14px",
    fontWeight: "600",
    color: "#1a1a1a",
    margin: "0 0 12px 0",
  } as React.CSSProperties,
  chipsContainer: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: "10px",
  } as React.CSSProperties,
  chip: {
    padding: "10px 14px",
    border: "2px solid #e5e7eb",
    borderRadius: "8px",
    background: "white",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "500",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    transition: "all 0.2s",
  } as React.CSSProperties,
  chipActive: {
    borderColor: "#005bd3",
    background: "#eff6ff",
    color: "#005bd3",
  } as React.CSSProperties,
  chipInactive: {
    color: "#666",
  } as React.CSSProperties,
  chipIcon: {
    fontSize: "16px",
  } as React.CSSProperties,
  commentSection: {
    marginBottom: "24px",
    padding: "16px",
    background: "#f9fafb",
    borderRadius: "8px",
  } as React.CSSProperties,
  commentLabel: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    cursor: "pointer",
    margin: "0",
  } as React.CSSProperties,
  commentCheckbox: {
    cursor: "pointer",
    width: "18px",
    height: "18px",
  } as React.CSSProperties,
  commentLabelText: {
    fontSize: "13px",
    fontWeight: "500",
    color: "#666",
  } as React.CSSProperties,
  commentTextarea: {
    width: "100%",
    minHeight: "80px",
    padding: "12px",
    border: "1px solid #e5e7eb",
    borderRadius: "6px",
    fontSize: "13px",
    fontFamily: "inherit",
    marginTop: "10px",
    resize: "none",
    outline: "none",
    boxSizing: "border-box",
  } as React.CSSProperties,
  submitButton: {
    width: "100%",
    padding: "12px 24px",
    background: "#005bd3",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontSize: "15px",
    fontWeight: "700",
    cursor: "pointer",
    transition: "background 0.2s",
    marginBottom: "12px",
  } as React.CSSProperties,
  submitButtonDisabled: {
    background: "#d1d5db",
    cursor: "not-allowed",
  } as React.CSSProperties,
  privacyNote: {
    fontSize: "11px",
    color: "#999",
    textAlign: "center",
    margin: "0",
  } as React.CSSProperties,
  successCard: {
    background: "white",
    borderRadius: "12px",
    padding: "48px 32px",
    textAlign: "center",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
  } as React.CSSProperties,
  successIcon: {
    fontSize: "48px",
    marginBottom: "16px",
  } as React.CSSProperties,
  successTitle: {
    fontSize: "24px",
    fontWeight: "700",
    color: "#10b981",
    margin: "0 0 8px 0",
  } as React.CSSProperties,
  successMessage: {
    fontSize: "14px",
    color: "#666",
    margin: "0 0 16px 0",
  } as React.CSSProperties,
  successRating: {
    fontSize: "14px",
    color: "#333",
    margin: "0",
    fontWeight: "500",
  } as React.CSSProperties,
  ratingStars: {
    fontSize: "16px",
    marginLeft: "8px",
  } as React.CSSProperties,
};

export default RatingFeedback;
