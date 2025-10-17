import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const LeftDrawer = SheetPrimitive.Root;

const LeftDrawerTrigger = SheetPrimitive.Trigger;

const LeftDrawerClose = SheetPrimitive.Close;

const LeftDrawerPortal = SheetPrimitive.Portal;

const LeftDrawerOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
    ref={ref}
  />
));
LeftDrawerOverlay.displayName = SheetPrimitive.Overlay.displayName;

const leftDrawerVariants = cva(
  "fixed z-50 gap-4 bg-background p-6 shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
  {
    variants: {
      side: {
        right:
          "inset-y-0 right-0 h-full w-full sm:w-3/4 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right ",
      },
    },
    defaultVariants: {
      side: "right",
    },
  }
);

interface LeftDrawerContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof leftDrawerVariants> {}

const LeftDrawerContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  LeftDrawerContentProps
>(({ side = "right", className, children, ...props }, ref) => (
  <LeftDrawerPortal>
    <LeftDrawerOverlay />
    <SheetPrimitive.Content
      ref={ref}
      className={cn(leftDrawerVariants({ side }), className)}
      {...props}
    >
      {children}
      <SheetPrimitive.Close className="absolute right-4 top-4 rounded-md opacity-70 ring-offset-background transition-opacity data-[state=open]:bg-secondary hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </SheetPrimitive.Close>
    </SheetPrimitive.Content>
  </LeftDrawerPortal>
));
LeftDrawerContent.displayName = SheetPrimitive.Content.displayName;

const LeftDrawerHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col space-y-2 text-left", className)}
    {...props}
  />
);
LeftDrawerHeader.displayName = "LeftDrawerHeader";

const LeftDrawerFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
);
LeftDrawerFooter.displayName = "LeftDrawerFooter";

const LeftDrawerTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold text-foreground", className)}
    {...props}
  />
));
LeftDrawerTitle.displayName = SheetPrimitive.Title.displayName;

const LeftDrawerDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
LeftDrawerDescription.displayName = SheetPrimitive.Description.displayName;

export {
  LeftDrawer,
  LeftDrawerClose,
  LeftDrawerContent,
  LeftDrawerDescription,
  LeftDrawerFooter,
  LeftDrawerHeader,
  LeftDrawerOverlay,
  LeftDrawerPortal,
  LeftDrawerTitle,
  LeftDrawerTrigger,
};
