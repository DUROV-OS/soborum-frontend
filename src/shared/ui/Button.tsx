import { ButtonHTMLAttributes, forwardRef } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'ai'
type Size = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-dark disabled:bg-brand/40',
  secondary:
    'bg-transparent text-brand border border-brand/40 hover:border-brand hover:bg-brand/5 disabled:opacity-40',
  ghost: 'bg-transparent text-ink hover:bg-surface-muted disabled:opacity-40',
  danger: 'bg-danger text-white hover:bg-danger/90 disabled:bg-danger/40',
  ai: 'bg-ai text-ink hover:bg-ai-accent hover:text-white disabled:bg-ai/40',
}

const sizeClasses: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-4 text-sm',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className = '', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`ui-button ui-button-${variant} inline-flex items-center justify-center gap-2 rounded-pill font-medium leading-none transition-colors disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    />
  )
})
