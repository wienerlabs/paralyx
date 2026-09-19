export interface Step {
  label: string
  state: 'pending' | 'active' | 'done' | 'failed'
  detail?: string
}

export function Steps({ steps }: { steps: Step[] }) {
  if (steps.length === 0) return null
  return (
    <ol className="mt-4 space-y-2">
      {steps.map((step, index) => (
        <li key={index} className="flex items-start gap-3 text-sm">
          <span
            className={
              'mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] ' +
              (step.state === 'done'
                ? 'border-ink bg-ink text-white'
                : step.state === 'failed'
                  ? 'border-ink bg-white text-ink'
                  : step.state === 'active'
                    ? 'animate-pulse border-ink bg-white text-ink'
                    : 'border-line bg-white text-mute')
            }
          >
            {step.state === 'done' ? '✓' : step.state === 'failed' ? '!' : index + 1}
          </span>
          <span className={step.state === 'pending' ? 'text-mute' : 'text-ink'}>
            {step.label}
            {step.detail ? <span className="block break-all text-xs text-mute">{step.detail}</span> : null}
          </span>
        </li>
      ))}
    </ol>
  )
}

export function useSteps() {
  return {
    make: (labels: string[]): Step[] => labels.map((label) => ({ label, state: 'pending' })),
  }
}
