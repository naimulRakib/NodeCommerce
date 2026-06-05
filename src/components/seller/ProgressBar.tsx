'use client';

interface ProgressBarProps {
  currentStep: number;
  totalSteps?: number;
}

export default function ProgressBar({
  currentStep,
  totalSteps = 3,
}: ProgressBarProps) {
  const steps = ['Credentials', 'Store Info', 'Location'];

  return (
    <div className="mb-8">
      {/* Progress Bar */}
      <div className="flex items-center gap-2 mb-6">
        {steps.map((step, index) => (
          <div key={index} className="flex items-center flex-1">
            {/* Circle */}
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm ${
                index + 1 <= currentStep
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              {index + 1}
            </div>
            {/* Line */}
            {index < steps.length - 1 && (
              <div
                className={`flex-1 h-1 mx-2 ${
                  index + 1 < currentStep ? 'bg-orange-500' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step Labels */}
      <div className="flex justify-between text-xs text-gray-600">
        {steps.map((step, index) => (
          <div key={index} className="text-center">
            {step}
          </div>
        ))}
      </div>
    </div>
  );
}
