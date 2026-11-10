import React from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SettingsSectionProps {
  title?: string
  description?: string
  children: React.ReactNode
  className?: string
  cardClassName?: string
}

export function SettingsSection({
  title,
  description,
  children,
  className,
  cardClassName,
}: SettingsSectionProps) {
  return (
    <section className={cn('space-y-1.5', className)}>
      {title && (
        <div className="px-1.5">
          <h3 className="text-xs font-semibold text-body3 uppercase tracking-wider">{title}</h3>
          {description && <p className="text-[11px] text-body3 mt-0.5">{description}</p>}
        </div>
      )}
      <div
        className={cn(
          'bg-surface rounded-2xl border border-line shadow-cds overflow-hidden divide-y divide-line',
          cardClassName,
        )}
      >
        {children}
      </div>
    </section>
  )
}

export interface SettingsRowProps {
  icon?: React.ReactNode
  iconClassName?: string
  title: React.ReactNode
  subtitle?: React.ReactNode
  rightElement?: React.ReactNode
  showChevron?: boolean
  chevronClassName?: string
  onClick?: () => void
  disabled?: boolean
  className?: string
  tone?: 'default' | 'action' | 'danger'
  as?: 'button' | 'div'
  'aria-expanded'?: boolean
  'aria-label'?: string
}

export function SettingsRow({
  icon,
  iconClassName,
  title,
  subtitle,
  rightElement,
  showChevron = true,
  chevronClassName,
  onClick,
  disabled = false,
  className,
  tone = 'default',
  as = 'button',
  'aria-expanded': ariaExpanded,
  'aria-label': ariaLabel,
}: SettingsRowProps) {
  const isButton = as === 'button' || Boolean(onClick)
  const Component = isButton ? 'button' : 'div'

  const toneTitleClass =
    tone === 'danger'
      ? 'text-expense font-semibold'
      : tone === 'action'
        ? 'text-action font-semibold'
        : 'text-ink font-semibold'

  const iconToneClass =
    tone === 'action'
      ? 'bg-action-subtle text-action'
      : tone === 'danger'
        ? 'bg-expense-subtle text-expense'
        : 'bg-surface-2 text-body2'

  return (
    <Component
      type={isButton ? 'button' : undefined}
      onClick={disabled ? undefined : onClick}
      disabled={isButton ? disabled : undefined}
      aria-expanded={ariaExpanded}
      aria-label={ariaLabel}
      className={cn(
        'w-full flex items-center gap-3.5 px-4 py-3.5 min-h-[58px] text-left transition-colors',
        isButton && !disabled && 'hover:bg-surface-2 active:bg-surface-2/80 cursor-pointer',
        disabled && 'opacity-60 cursor-not-allowed',
        className,
      )}
    >
      {icon && (
        <div
          className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors',
            iconToneClass,
            iconClassName,
          )}
        >
          {icon}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className={cn('text-sm leading-tight truncate', toneTitleClass)}>{title}</div>
        {subtitle && (
          <div className="text-[11px] sm:text-xs text-body2 truncate mt-0.5">{subtitle}</div>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {rightElement}
        {showChevron && (
          <ChevronRight
            className={cn(
              'w-4 h-4 text-body3 shrink-0 transition-transform duration-200',
              chevronClassName,
            )}
          />
        )}
      </div>
    </Component>
  )
}
