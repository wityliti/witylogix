/**
 * Delivery Notes Component
 * Text input for delivery instructions
 */

import { useState } from "@wordpress/element";

interface DeliveryNotesProps {
  value?: string;
  onChange?: (notes: string) => void;
  isRequired?: boolean;
  placeholder?: string;
  maxLength?: number;
}

const DEFAULT_MAX_LENGTH = 500;
const DEFAULT_PLACEHOLDER =
  "Add delivery instructions (e.g., gate code, special access instructions)";

/**
 * Delivery Notes Component
 */
export function DeliveryNotes({
  value = "",
  onChange,
  isRequired = false,
  placeholder = DEFAULT_PLACEHOLDER,
  maxLength = DEFAULT_MAX_LENGTH,
}: DeliveryNotesProps) {
  const [isFocused, setIsFocused] = useState(false);
  const charCount = value.length;
  const isNearLimit = charCount > maxLength * 0.75;
  const isOverLimit = charCount > maxLength;

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value.slice(0, maxLength);
    onChange?.(newValue);
  };

  return (
    <div className="witylogix-delivery-notes">
      <label className="delivery-notes-label">
        <span className="label-text">Delivery Instructions</span>
        {isRequired && <span className="label-required">*</span>}
      </label>

      <textarea
        value={value}
        onChange={handleChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        maxLength={maxLength}
        required={isRequired}
        className={`
          delivery-notes-textarea
          ${isFocused ? "delivery-notes-textarea--focused" : ""}
          ${isOverLimit ? "delivery-notes-textarea--error" : ""}
          ${isNearLimit && !isOverLimit ? "delivery-notes-textarea--warning" : ""}
        `}
        rows={4}
        aria-label="Delivery instructions"
        aria-describedby="delivery-notes-help"
      />

      <div className="delivery-notes-footer">
        <p id="delivery-notes-help" className="delivery-notes-help">
          Provide any special instructions for delivery
        </p>
        <span
          className={`
          delivery-notes-counter
          ${isOverLimit ? "delivery-notes-counter--error" : ""}
          ${isNearLimit && !isOverLimit ? "delivery-notes-counter--warning" : ""}
        `}
        >
          {charCount}/{maxLength}
        </span>
      </div>
    </div>
  );
}
