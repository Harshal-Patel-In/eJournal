import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-md border border-transparent text-xs font-semibold whitespace-nowrap transition-[transform,box-shadow,background-color,border-color,color] duration-75 ease-out outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 active:translate-y-[1px] active:scale-[0.985] active:shadow-none disabled:pointer-events-none disabled:opacity-50 cursor-pointer [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-b from-indigo-600 to-indigo-700 text-white border border-white/20 shadow-[0_1px_3px_0_rgba(79,70,229,0.35),inset_0_1px_0_0_rgba(255,255,255,0.28)] hover:from-indigo-700 hover:to-indigo-800 hover:shadow-[0_2px_6px_0_rgba(79,70,229,0.45),inset_0_1px_0_0_rgba(255,255,255,0.35)]",
        outline:
          "glass-btn-elevated",
        secondary:
          "glass-btn-secondary",
        ghost:
          "bg-transparent text-foreground hover:bg-muted/70 hover:text-foreground shadow-none border-transparent active:translate-y-[0.5px]",
        destructive:
          "bg-gradient-to-b from-rose-600 to-rose-700 text-white border border-white/20 shadow-[0_1px_3px_0_rgba(225,29,72,0.35),inset_0_1px_0_0_rgba(255,255,255,0.25)] hover:from-rose-700 hover:to-rose-800",
        link: "text-primary underline-offset-4 hover:underline !shadow-none !border-none !p-0 !h-auto !transform-none",
      },
      color: {
        default: "",
        blue: "",
        indigo: "",
        cyan: "",
        emerald: "",
        amber: "",
        rose: "",
        violet: "",
        neutral: "border-border text-foreground/80 hover:text-foreground hover:bg-muted/50",
      },
      size: {
        default: "h-8 gap-1.5 px-3",
        xs: "h-6 gap-1 px-2 text-[11px] [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3",
        lg: "h-9 gap-2 px-4 text-sm [&_svg:not([class*='size-'])]:size-4",
        icon: "size-8",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-9 [&_svg:not([class*='size-'])]:size-4",
      },
    },
    compoundVariants: [
      // Solid colored overrides
      {
        variant: "default",
        color: "rose",
        className: "bg-gradient-to-b from-rose-600 to-rose-700 text-white border-white/20 shadow-[0_1px_3px_0_rgba(225,29,72,0.35),inset_0_1px_0_0_rgba(255,255,255,0.25)] hover:from-rose-700 hover:to-rose-800",
      },
      {
        variant: "default",
        color: "emerald",
        className: "glass-btn-emerald-solid",
      },
      {
        variant: "default",
        color: "amber",
        className: "bg-gradient-to-b from-amber-600 to-amber-700 text-white border-white/20 shadow-[0_1px_3px_0_rgba(217,119,6,0.35),inset_0_1px_0_0_rgba(255,255,255,0.25)] hover:from-amber-700 hover:to-amber-800",
      },
      {
        variant: "default",
        color: "indigo",
        className: "bg-primary text-primary-foreground border-primary hover:bg-primary/90",
      },
      {
        variant: "default",
        color: "blue",
        className: "bg-primary text-primary-foreground border-primary hover:bg-primary/90",
      },
      // Ghost colored overrides
      {
        variant: "ghost",
        color: "rose",
        className: "text-rose-600 dark:text-rose-400 hover:bg-rose-500/10",
      },
      {
        variant: "ghost",
        color: "amber",
        className: "text-amber-600 dark:text-amber-400 hover:bg-amber-500/10",
      },
      {
        variant: "ghost",
        color: "emerald",
        className: "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10",
      },
      {
        variant: "ghost",
        color: "indigo",
        className: "text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10",
      },
      {
        variant: "ghost",
        color: "neutral",
        className: "text-muted-foreground hover:text-foreground hover:bg-muted/50",
      },
      // Outline colored overrides
      {
        variant: "outline",
        color: "default",
        className: "text-foreground",
      },
      {
        variant: "outline",
        color: "neutral",
        className: "border-border text-foreground/90 hover:text-foreground hover:bg-muted/60",
      },
      {
        variant: "outline",
        color: "emerald",
        className: "glass-btn-emerald-outline",
      },
      {
        variant: "outline",
        color: "amber",
        className: "glass-btn-amber-outline",
      },
      {
        variant: "outline",
        color: "rose",
        className: "glass-btn-rose-outline",
      },
      {
        variant: "outline",
        color: "indigo",
        className: "glass-btn-accent-outline",
      },
      {
        variant: "outline",
        color: "blue",
        className: "glass-btn-accent-outline",
      },
      {
        variant: "outline",
        color: "cyan",
        className: "glass-btn-cyan-outline",
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
