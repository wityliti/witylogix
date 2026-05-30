import type { TimelineStep } from '../types'

interface StatusTimelineProps {
  currentStatus: string
  /** Timeline array returned directly from the API — already ordered and labeled. */
  timeline: TimelineStep[]
}

const GREEN = '#008060'
const BLUE = '#005bd3'
const GREY = '#e5e7eb'
const DARK = '#1f2937'
const MUTED = '#9ca3af'

export function StatusTimeline({ timeline }: StatusTimelineProps) {
  if (!timeline || timeline.length === 0) {
    return null
  }

  return (
    <div>
      <h3
        style={{
          fontSize: '13px',
          fontWeight: '700',
          color: DARK,
          margin: '0 0 20px 0',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        Delivery Progress
      </h3>

      <div style={{ position: 'relative', paddingLeft: '32px' }}>
        {timeline.map((step, index) => {
          const isLast = index === timeline.length - 1
          const dotColor = step.completed ? GREEN : GREY
          const dotBorder = step.current ? `3px solid ${BLUE}` : '2px solid white'
          const dotShadow = step.current ? `0 0 0 3px ${BLUE}33` : '0 1px 3px rgba(0,0,0,0.1)'

          return (
            <div
              key={step.status}
              style={{
                position: 'relative',
                marginBottom: isLast ? 0 : '28px',
              }}
            >
              {/* Dot */}
              <div
                style={{
                  position: 'absolute',
                  left: '-32px',
                  top: '1px',
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  backgroundColor: dotColor,
                  border: dotBorder,
                  boxShadow: dotShadow,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  color: step.completed ? 'white' : MUTED,
                  fontWeight: '700',
                  transition: 'all 0.2s ease',
                }}
              >
                {step.completed ? '✓' : ''}
              </div>

              {/* Connector line */}
              {!isLast && (
                <div
                  style={{
                    position: 'absolute',
                    left: '-22px',
                    top: '23px',
                    width: '2px',
                    height: '28px',
                    backgroundColor: step.completed ? GREEN : GREY,
                    transition: 'background-color 0.3s ease',
                  }}
                />
              )}

              {/* Label */}
              <p
                style={{
                  fontSize: '14px',
                  fontWeight: step.current ? '700' : step.completed ? '600' : '500',
                  color: step.current ? BLUE : step.completed ? DARK : MUTED,
                  margin: 0,
                  lineHeight: '1.35',
                }}
              >
                {step.label}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
