'use client'

import { useState } from 'react'

export interface ShippingRate {
  id: string
  name: string
  description: string
  basePrice: number
  pricePerKg: number
  deliveryDays: number
  guaranteedDelivery: boolean
  features: string[]
}

interface RateCalculatorProps {
  rates: ShippingRate[]
  onRateSelect: (rateId: string, finalPrice: number) => void
  currency?: string
  theme?: 'light' | 'dark'
}

export function RateCalculator({
  rates,
  onRateSelect,
  currency = 'USD',
  theme = 'light',
}: RateCalculatorProps) {
  const [weight, setWeight] = useState<number | ''>('')
  const [width, setWidth] = useState<number | ''>('')
  const [height, setHeight] = useState<number | ''>('')
  const [depth, setDepth] = useState<number | ''>('')
  const [selectedRate, setSelectedRate] = useState<string | null>(null)

  const isDarkTheme = theme === 'dark'
  const bgColor = isDarkTheme ? 'var(--wl-widget-bg-dark, #1a1a1a)' : 'var(--wl-widget-bg, #ffffff)'
  const textColor = isDarkTheme ? 'var(--wl-widget-text-dark, #ffffff)' : 'var(--wl-widget-text, #1f2937)'
  const borderColor = isDarkTheme ? 'var(--wl-widget-border-dark, #333333)' : 'var(--wl-widget-border, #e5e7eb)'
  const inputBgColor = isDarkTheme ? '#2d2d2d' : '#f9fafb'
  const primaryColor = 'var(--wl-widget-primary, #6C63FF)'
  const secondaryColor = isDarkTheme ? '#2d2d2d' : '#f3f4f6'
  const successColor = 'var(--wl-widget-success, #008060)'

  const currencySymbol = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    CAD: 'C$',
  }[currency] || '$'

  const hasValidDimensions =
    (weight !== '' && weight > 0) || (width !== '' && height !== '' && depth !== '' && width > 0 && height > 0 && depth > 0)

  const calculatePrice = (rate: ShippingRate): number => {
    let price = rate.basePrice

    if (weight !== '' && weight > 0) {
      price += weight * rate.pricePerKg
    }

    return Math.round(price * 100) / 100
  }

  const getDeliveryEstimate = (rate: ShippingRate): string => {
    const deliveryDate = new Date()
    deliveryDate.setDate(deliveryDate.getDate() + rate.deliveryDays)

    return deliveryDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const handleRateSelect = (rateId: string) => {
    const rate = rates.find((r) => r.id === rateId)
    if (rate) {
      setSelectedRate(rateId)
      const finalPrice = calculatePrice(rate)
      onRateSelect(rateId, finalPrice)
    }
  }

  return (
    <div
      style={{
        backgroundColor: bgColor,
        borderRadius: '12px',
        padding: '24px',
        border: `1px solid ${borderColor}`,
        maxWidth: '600px',
        margin: '0 auto',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h2
          style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: '600',
            color: textColor,
            marginBottom: '8px',
          }}
        >
          Calculate Shipping Rate
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: '14px',
            color: isDarkTheme ? '#999999' : '#6b7280',
          }}
        >
          Enter package details to see rates
        </p>
      </div>

      {/* Input Section */}
      <div
        style={{
          backgroundColor: secondaryColor,
          borderRadius: '10px',
          padding: '20px',
          marginBottom: '24px',
          border: `1px solid ${borderColor}`,
        }}
      >
        <h3
          style={{
            margin: '0 0 16px 0',
            fontSize: '14px',
            fontWeight: '600',
            color: textColor,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          Package Details
        </h3>

        {/* Weight Input */}
        <div style={{ marginBottom: '16px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '500',
              color: textColor,
              marginBottom: '8px',
            }}
          >
            Weight (kg)
          </label>
          <input
            type="number"
            value={weight}
            onChange={(e) => setWeight(e.target.value ? parseFloat(e.target.value) : '')}
            placeholder="Enter weight"
            min="0"
            step="0.1"
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '8px',
              border: `1px solid ${borderColor}`,
              backgroundColor: inputBgColor,
              color: textColor,
              fontSize: '14px',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
              transition: 'border-color 0.2s ease',
            }}
            onFocus={(e) => {
              ;(e.target as HTMLInputElement).style.borderColor = primaryColor
            }}
            onBlur={(e) => {
              ;(e.target as HTMLInputElement).style.borderColor = borderColor
            }}
          />
        </div>

        {/* Dimensions */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '12px',
            marginBottom: '16px',
          }}
        >
          {[
            { label: 'Width (cm)', value: width, setter: setWidth },
            { label: 'Height (cm)', value: height, setter: setHeight },
            { label: 'Depth (cm)', value: depth, setter: setDepth },
          ].map(({ label, value, setter }) => (
            <div key={label}>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: textColor,
                  marginBottom: '8px',
                }}
              >
                {label}
              </label>
              <input
                type="number"
                value={value}
                onChange={(e) => setter(e.target.value ? parseFloat(e.target.value) : '')}
                placeholder="0"
                min="0"
                step="1"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: `1px solid ${borderColor}`,
                  backgroundColor: inputBgColor,
                  color: textColor,
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s ease',
                }}
                onFocus={(e) => {
                  ;(e.target as HTMLInputElement).style.borderColor = primaryColor
                }}
                onBlur={(e) => {
                  ;(e.target as HTMLInputElement).style.borderColor = borderColor
                }}
              />
            </div>
          ))}
        </div>

        <p
          style={{
            margin: 0,
            fontSize: '12px',
            color: isDarkTheme ? '#999999' : '#6b7280',
            fontStyle: 'italic',
          }}
        >
          📏 At least one measurement is required
        </p>
      </div>

      {/* Rates Display */}
      {!hasValidDimensions ? (
        <div
          style={{
            padding: '20px',
            textAlign: 'center',
            backgroundColor: secondaryColor,
            borderRadius: '8px',
            color: isDarkTheme ? '#999999' : '#6b7280',
            fontSize: '14px',
          }}
        >
          Enter package details to calculate rates
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {rates.map((rate) => {
            const price = calculatePrice(rate)
            const delivery = getDeliveryEstimate(rate)
            const isSelected = selectedRate === rate.id

            return (
              <button
                key={rate.id}
                onClick={() => handleRateSelect(rate.id)}
                style={{
                  background: 'none',
                  border: isSelected ? `2px solid ${primaryColor}` : `1px solid ${borderColor}`,
                  borderRadius: '10px',
                  padding: '16px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  backgroundColor: isSelected ? `${primaryColor}10` : bgColor,
                  textAlign: 'left',
                  boxShadow: isSelected ? `0 0 0 3px ${primaryColor}30` : 'none',
                }}
                onMouseEnter={(e) => {
                  ;(e.target as HTMLElement).style.backgroundColor = secondaryColor
                  ;(e.target as HTMLElement).style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={(e) => {
                  ;(e.target as HTMLElement).style.backgroundColor = isSelected ? `${primaryColor}10` : bgColor
                  ;(e.target as HTMLElement).style.transform = 'translateY(0)'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '12px',
                  }}
                >
                  <div>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: '16px',
                        fontWeight: '600',
                        color: isSelected ? primaryColor : textColor,
                      }}
                    >
                      {rate.name}
                    </h3>
                    <p
                      style={{
                        margin: '4px 0 0 0',
                        fontSize: '13px',
                        color: isDarkTheme ? '#999999' : '#6b7280',
                      }}
                    >
                      {rate.description}
                    </p>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div
                      style={{
                        fontSize: '20px',
                        fontWeight: '700',
                        color: isSelected ? primaryColor : textColor,
                      }}
                    >
                      {currencySymbol}
                      {price.toFixed(2)}
                    </div>
                    <p
                      style={{
                        margin: '4px 0 0 0',
                        fontSize: '12px',
                        color: isDarkTheme ? '#999999' : '#6b7280',
                      }}
                    >
                      {rate.guaranteedDelivery && '✓ Guaranteed '}
                      By {delivery}
                    </p>
                  </div>
                </div>

                {/* Delivery days */}
                <div
                  style={{
                    padding: '8px 12px',
                    backgroundColor: secondaryColor,
                    borderRadius: '6px',
                    fontSize: '13px',
                    color: textColor,
                    marginBottom: '12px',
                    fontWeight: '500',
                  }}
                >
                  📦 {rate.deliveryDays} business days
                </div>

                {/* Features */}
                {rate.features.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {rate.features.map((feature) => (
                      <span
                        key={feature}
                        style={{
                          fontSize: '12px',
                          backgroundColor: isDarkTheme ? '#444444' : '#e5e7eb',
                          color: textColor,
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontWeight: '500',
                        }}
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                )}

                {/* Selected indicator */}
                {isSelected && (
                  <div
                    style={{
                      marginTop: '12px',
                      paddingTop: '12px',
                      borderTop: `1px solid ${borderColor}`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: successColor,
                      fontSize: '14px',
                      fontWeight: '600',
                    }}
                  >
                    <span style={{ fontSize: '18px' }}>✓</span>
                    <span>Selected</span>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Summary */}
      {selectedRate && hasValidDimensions && (
        <div
          style={{
            marginTop: '20px',
            padding: '16px',
            backgroundColor: `${successColor}15`,
            border: `1px solid ${successColor}30`,
            borderRadius: '8px',
            fontSize: '13px',
            color: textColor,
          }}
        >
          <strong style={{ color: successColor, display: 'block', marginBottom: '8px' }}>Order Summary</strong>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span>Shipping Method:</span>
            <strong>{rates.find((r) => r.id === selectedRate)?.name}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span>Estimated Delivery:</span>
            <strong>{getDeliveryEstimate(rates.find((r) => r.id === selectedRate)!)}</strong>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              paddingTop: '8px',
              borderTop: `1px solid ${successColor}30`,
            }}
          >
            <span style={{ fontWeight: '600' }}>Total Cost:</span>
            <strong style={{ fontSize: '16px', color: primaryColor }}>
              {currencySymbol}
              {calculatePrice(rates.find((r) => r.id === selectedRate)!).toFixed(2)}
            </strong>
          </div>
        </div>
      )}
    </div>
  )
}
