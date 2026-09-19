import { motion, type HTMLMotionProps } from 'framer-motion'

type Props = HTMLMotionProps<'button'> & { variant?: 'primary' | 'ghost'; full?: boolean }

export function MotionButton({ variant = 'primary', full = false, className = '', disabled, children, ...rest }: Props) {
  const base = variant === 'primary' ? 'btn' : 'btn-ghost'
  return (
    <motion.button
      type="button"
      whileHover={disabled ? undefined : { scale: 1.02, y: -1 }}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 520, damping: 28 }}
      className={`${base}${full ? ' w-full' : ''} ${className}`}
      disabled={disabled}
      {...rest}
    >
      {children}
    </motion.button>
  )
}
