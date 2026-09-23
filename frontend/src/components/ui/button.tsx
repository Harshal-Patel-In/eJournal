import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button glass-btn inline-flex shrink-0 items-center justify-center rounded-xl border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "hover:scale-[1.02] active:scale-[0.98] transition-all duration-200",
        outline:
          "border hover:scale-[1.02] active:scale-[0.98] transition-all duration-200",
        secondary:
          "hover:scale-[1.02] active:scale-[0.98] transition-all duration-200",
        ghost:
          "bg-transparent shadow-none border-transparent hover:scale-[1.02] active:scale-[0.98] transition-all duration-200",
        destructive:
          "glass-btn-destructive hover:scale-[1.02] active:scale-[0.98] transition-all duration-200",
        link: "text-primary underline-offset-4 hover:underline !shadow-none !backdrop-filter-none",
      },
      color: {
        default: "",
        blue: "glass-btn-blue",
        indigo: "glass-btn-indigo",
        cyan: "glass-btn-cyan",
        emerald: "glass-btn-emerald",
        amber: "glass-btn-amber",
        rose: "glass-btn-destructive",
        violet: "glass-btn-violet",
        neutral: "border-border/80 text-foreground/80 hover:text-foreground hover:bg-muted/50",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    compoundVariants: [
       // Backward compatibility defaults when no explicit color is set
      {
        variant: "default",
        color: "default",
        className: "glass-btn-blue",
      },
      {
        variant: "outline",
        color: "default",
        className: "glass-btn-indigo",
      },
      {
        variant: "secondary",
        color: "default",
        className: "glass-btn-indigo",
      },
      {
        variant: "ghost",
        color: "default",
        className: "hover:glass-btn-indigo",
      },
      // Solid variant colored overrides
      {
        variant: "default",
        color: "rose",
        className: "glass-btn-destructive-solid",
      },
      {
        variant: "default",
        color: "emerald",
        className: "glass-btn-emerald-solid",
      },
      {
        variant: "default",
        color: "indigo",
        className: "glass-btn-indigo-solid",
      },
      {
        variant: "default",
        color: "blue",
        className: "glass-btn-blue-solid",
      },
      // Ghost variant colored hover overrides
      {
        variant: "ghost",
        color: "rose",
        className: "text-rose-600 dark:text-rose-400 hover:glass-btn-destructive",
      },
      {
        variant: "ghost",
        color: "amber",
        className: "text-amber-600 dark:text-amber-400 hover:glass-btn-amber",
      },
      {
        variant: "ghost",
        color: "emerald",
        className: "text-emerald-600 dark:text-emerald-400 hover:glass-btn-emerald",
      },
      {
        variant: "ghost",
        color: "neutral",
        className: "text-muted-foreground hover:text-foreground hover:bg-muted/40",
      },
      // Outline neutral variant
      {
        variant: "outline",
        color: "neutral",
        className: "border-border/80 text-foreground/80 hover:text-foreground hover:bg-muted/50 hover:border-border",
      },
    ],
    defaultVariants: {
      variant: "default",
      color: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "color">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, color, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, color, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
