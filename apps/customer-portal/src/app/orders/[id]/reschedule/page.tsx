'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { format, addDays } from 'date-fns';
import { ArrowLeft, Calendar, Clock, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type RescheduleStep = 'select-date' | 'select-time' | 'confirm' | 'success';

const timeSlots = [
  '08:00 - 10:00',
  '10:00 - 12:00',
  '12:00 - 14:00',
  '14:00 - 16:00',
  '16:00 - 18:00',
  '18:00 - 20:00',
];

const currentDeliveryDate = new Date();
const availableDates = Array.from({ length: 7 }, (_, i) =>
  addDays(currentDeliveryDate, i + 1)
);

export default function ReschedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [step, setStep] = useState<RescheduleStep>('select-date');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const handleNext = () => {
    if (step === 'select-date' && selectedDate) {
      setStep('select-time');
    } else if (step === 'select-time' && selectedTime) {
      setStep('confirm');
    } else if (step === 'confirm') {
      setStep('success');
    }
  };

  const handleBack = () => {
    if (step === 'select-time') {
      setStep('select-date');
    } else if (step === 'confirm') {
      setStep('select-time');
    }
  };

  const isNextDisabled =
    (step === 'select-date' && !selectedDate) ||
    (step === 'select-time' && !selectedTime);

  const stepIndex = ['select-date', 'select-time', 'confirm', 'success'].indexOf(step);

  return (
    <div className="page-container animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/orders/${id}`}
          className="btn btn-ghost p-2"
          aria-label="Back to order"
        >
          <ArrowLeft size={20} className="text-wl-text-primary" />
        </Link>
        <div className="page-header">
          <h1 className="page-title">Reschedule Delivery</h1>
          <p className="page-subtitle">
            Current delivery: {format(currentDeliveryDate, 'PPP')}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full max-w-2xl">
        <div className="flex gap-2">
          {(['select-date', 'select-time', 'confirm', 'success'] as const).map((s, i) => (
            <div
              key={s}
              className={cn(
                'flex-1 h-2 rounded-full transition-colors duration-fast',
                stepIndex >= i
                  ? 'bg-wl-primary-500'
                  : 'bg-wl-neutral-700'
              )}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl">
        {step === 'select-date' && (
          <div className="section-card stagger-1">
            <div className="flex items-center gap-2 mb-6">
              <Calendar size={24} className="text-wl-primary-500" />
              <h2 className="text-2xl font-bold text-wl-text-primary">
                Select a New Date
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {availableDates.map((date) => (
                <button
                  key={date.toISOString()}
                  onClick={() => setSelectedDate(date)}
                  className={cn(
                    'section-card text-left transition-all duration-fast',
                    selectedDate?.toDateString() === date.toDateString()
                      ? 'border-wl-primary-500 bg-wl-bg-elevated'
                      : 'hover:border-wl-primary-500/50'
                  )}
                >
                  <p className="font-medium text-wl-text-primary">
                    {format(date, 'EEE, MMM d')}
                  </p>
                  <p className="text-xs text-wl-text-tertiary mt-1">
                    {format(date, 'PPP')}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'select-time' && (
          <div className="section-card stagger-1">
            <div className="flex items-center gap-2 mb-6">
              <Clock size={24} className="text-wl-primary-500" />
              <h2 className="text-2xl font-bold text-wl-text-primary">
                Select a Time Slot
              </h2>
            </div>

            <p className="text-wl-text-secondary mb-4">
              For {selectedDate && format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </p>

            <div className="grid grid-cols-2 gap-3">
              {timeSlots.map((slot) => (
                <button
                  key={slot}
                  onClick={() => setSelectedTime(slot)}
                  className={cn(
                    'section-card text-center font-medium mono transition-all duration-fast',
                    selectedTime === slot
                      ? 'border-wl-primary-500 bg-wl-bg-elevated text-wl-primary-400'
                      : 'text-wl-text-primary hover:border-wl-primary-500/50'
                  )}
                >
                  {slot}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'confirm' && (
          <div className="section-card stagger-1">
            <h2 className="text-2xl font-bold text-wl-text-primary mb-6">
              Confirm Reschedule
            </h2>

            <div className={cn(
              'section-card bg-wl-bg-elevated space-y-4 mb-6'
            )}>
              <div className="flex justify-between items-center">
                <span className="label">Original Date</span>
                <span className="value mono">
                  {format(currentDeliveryDate, 'PPP')}
                </span>
              </div>
              <div className="border-t border-wl-border-subtle" />
              <div className="flex justify-between items-center">
                <span className="label">New Date</span>
                <span className="value text-wl-primary-400 mono">
                  {selectedDate && format(selectedDate, 'PPP')}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="label">New Time</span>
                <span className="value text-wl-primary-400 mono">
                  {selectedTime}
                </span>
              </div>
            </div>

            <textarea
              placeholder="Optional: Add a reason for rescheduling..."
              className="input w-full resize-none h-32"
            />
          </div>
        )}

        {step === 'success' && (
          <div className={cn(
            'section-card border-l-2 border-wl-success-500',
            'text-center stagger-1'
          )}>
            <div className={cn(
              'w-16 h-16 mx-auto mb-4 rounded-full',
              'bg-wl-success-500/20 flex items-center justify-center'
            )}>
              <CheckCircle size={32} className="text-wl-success-500" />
            </div>

            <h2 className="text-2xl font-bold text-wl-text-primary mb-2">
              Delivery Rescheduled!
            </h2>
            <p className="text-wl-text-secondary mb-6">
              Your delivery has been rescheduled to {selectedDate && format(selectedDate, 'EEEE, MMMM d')} at {selectedTime}
            </p>

            <p className="text-sm text-wl-text-tertiary mb-8">
              You'll receive a confirmation email shortly. You can track your delivery anytime from your orders page.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href={`/orders/${id}`}
                className="btn btn-primary"
              >
                Back to Order
              </Link>
              <Link
                href="/orders"
                className="btn btn-secondary"
              >
                View All Orders
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      {step !== 'success' && (
        <div className="flex gap-3 max-w-2xl">
          {step !== 'select-date' && (
            <button
              onClick={handleBack}
              className="btn btn-secondary"
            >
              Back
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={isNextDisabled}
            className={cn(
              'btn btn-primary flex-1',
              isNextDisabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            {step === 'confirm' ? 'Confirm Reschedule' : 'Continue'}
          </button>
        </div>
      )}
    </div>
  );
}
