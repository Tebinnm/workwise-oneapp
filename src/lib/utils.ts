import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format currency based on the specified currency type
 * @param amount - The amount to format
 * @param currency - The currency code ('USD' or 'AED')
 * @returns Formatted currency string
 */
export function formatCurrency(
  amount: number,
  currency: string = "USD"
): string {
  if (currency === "AED") {
    return `AED ${amount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  // Default to USD
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}
