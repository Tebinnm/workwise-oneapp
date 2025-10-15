import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontSize: {
        display: [
          "clamp(2rem, 4vw, 3rem)",
          { lineHeight: "1.2", fontWeight: "600" },
        ],
        xlarge: [
          "clamp(1.5rem, 2.5vw, 1.875rem)",
          { lineHeight: "1.3", fontWeight: "500" },
        ],
        large: [
          "clamp(1.125rem, 1.75vw, 1.375rem)",
          { lineHeight: "1.4", fontWeight: "500" },
        ],
        medium: [
          "clamp(0.8125rem, 1.25vw, 0.9375rem)",
          { lineHeight: "1.5", fontWeight: "400" },
        ],
        small: [
          "clamp(0.6875rem, 0.9vw, 0.8125rem)",
          { lineHeight: "1.5", fontWeight: "400" },
        ],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          glow: "hsl(var(--primary-glow))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
          text: "hsl(var(--sidebar-text))",
          "text-muted": "hsl(var(--sidebar-text-muted))",
          "text-secondary": "hsl(var(--sidebar-text-secondary))",
        },
        status: {
          active: "hsl(var(--status-active))",
          "active-foreground": "hsl(var(--status-active-foreground))",
          completed: "hsl(var(--status-completed))",
          "completed-foreground": "hsl(var(--status-completed-foreground))",
          "on-hold": "hsl(var(--status-on-hold))",
          "on-hold-foreground": "hsl(var(--status-on-hold-foreground))",
          cancelled: "hsl(var(--status-cancelled))",
          "cancelled-foreground": "hsl(var(--status-cancelled-foreground))",
          default: "hsl(var(--status-default))",
          "default-foreground": "hsl(var(--status-default-foreground))",
        },
        task: {
          todo: "hsl(var(--task-todo))",
          "in-progress": "hsl(var(--task-in-progress))",
          blocked: "hsl(var(--task-blocked))",
          done: "hsl(var(--task-done))",
          cancelled: "hsl(var(--task-cancelled))",
        },
        expense: {
          materials: "hsl(var(--expense-materials))",
          "materials-foreground": "hsl(var(--expense-materials-foreground))",
          equipment: "hsl(var(--expense-equipment))",
          "equipment-foreground": "hsl(var(--expense-equipment-foreground))",
          labor: "hsl(var(--expense-labor))",
          "labor-foreground": "hsl(var(--expense-labor-foreground))",
          transportation: "hsl(var(--expense-transportation))",
          "transportation-foreground":
            "hsl(var(--expense-transportation-foreground))",
          permits: "hsl(var(--expense-permits))",
          "permits-foreground": "hsl(var(--expense-permits-foreground))",
          utilities: "hsl(var(--expense-utilities))",
          "utilities-foreground": "hsl(var(--expense-utilities-foreground))",
          other: "hsl(var(--expense-other))",
          "other-foreground": "hsl(var(--expense-other-foreground))",
        },
        invoice: {
          draft: "hsl(var(--invoice-draft))",
          "draft-foreground": "hsl(var(--invoice-draft-foreground))",
          pending: "hsl(var(--invoice-pending))",
          "pending-foreground": "hsl(var(--invoice-pending-foreground))",
          paid: "hsl(var(--invoice-paid))",
          "paid-foreground": "hsl(var(--invoice-paid-foreground))",
          "partially-paid": "hsl(var(--invoice-partially-paid))",
          "partially-paid-foreground":
            "hsl(var(--invoice-partially-paid-foreground))",
          overdue: "hsl(var(--invoice-overdue))",
          "overdue-foreground": "hsl(var(--invoice-overdue-foreground))",
          cancelled: "hsl(var(--invoice-cancelled))",
          "cancelled-foreground": "hsl(var(--invoice-cancelled-foreground))",
          default: "hsl(var(--invoice-default))",
          "default-foreground": "hsl(var(--invoice-default-foreground))",
        },
        role: {
          admin: "hsl(var(--role-admin))",
          "admin-foreground": "hsl(var(--role-admin-foreground))",
          supervisor: "hsl(var(--role-supervisor))",
          "supervisor-foreground": "hsl(var(--role-supervisor-foreground))",
          worker: "hsl(var(--role-worker))",
          "worker-foreground": "hsl(var(--role-worker-foreground))",
          client: "hsl(var(--role-client))",
          "client-foreground": "hsl(var(--role-client-foreground))",
        },
      },
      backgroundImage: {
        "gradient-primary": "var(--gradient-primary)",
        "gradient-mesh": "var(--gradient-mesh)",
      },
      boxShadow: {
        elevated: "var(--shadow-elevated)",
        glow: "var(--shadow-glow)",
      },
      transitionTimingFunction: {
        smooth: "var(--transition-smooth)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        "bounce-subtle": {
          "0%, 100%": {
            transform: "translateY(0)",
          },
          "50%": {
            transform: "translateY(-6px)",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "bounce-subtle": "bounce-subtle 2s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
