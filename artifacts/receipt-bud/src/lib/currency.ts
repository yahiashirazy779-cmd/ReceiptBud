// Maps ISO 4217 currency codes to their display symbols
export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  EGP: "E£",
  SAR: "SR",
  AED: "د.إ",
  KWD: "KD",
  QAR: "QR",
  BHD: "BD",
  OMR: "OMR",
  TRY: "₺",
  INR: "₹",
  JPY: "¥",
  CNY: "¥",
  KRW: "₩",
  CAD: "CA$",
  AUD: "A$",
  CHF: "Fr",
  SEK: "kr",
  NOK: "kr",
  DKK: "kr",
  PLN: "zł",
  BRL: "R$",
  MXN: "MX$",
  HKD: "HK$",
  SGD: "S$",
  THB: "฿",
  ZAR: "R",
  RUB: "₽",
};

/**
 * Returns the symbol for a currency code, e.g. "USD" → "$".
 * Falls back to the code itself if unknown.
 */
export function getCurrencySymbol(code?: string | null): string {
  if (!code) return "$";
  return CURRENCY_SYMBOLS[code.toUpperCase()] ?? code;
}

/**
 * Formats an amount with its currency symbol, e.g. 12.5 + "EUR" → "€12.50"
 * Safely handles null/undefined amounts.
 */
export function formatCurrency(amount: number | null | undefined, currencyCode?: string | null): string {
  const sym = getCurrencySymbol(currencyCode);
  if (amount == null || isNaN(amount)) return `${sym}0.00`;
  return `${sym}${amount.toFixed(2)}`;
}

/** Full list of supported currencies for pickers */
export const CURRENCY_LIST: { code: string; label: string }[] = [
  { code: "USD", label: "USD ($) — US Dollar" },
  { code: "EUR", label: "EUR (€) — Euro" },
  { code: "GBP", label: "GBP (£) — British Pound" },
  { code: "EGP", label: "EGP (E£) — Egyptian Pound" },
  { code: "SAR", label: "SAR (SR) — Saudi Riyal" },
  { code: "AED", label: "AED (د.إ) — UAE Dirham" },
  { code: "KWD", label: "KWD (KD) — Kuwaiti Dinar" },
  { code: "QAR", label: "QAR (QR) — Qatari Riyal" },
  { code: "BHD", label: "BHD (BD) — Bahraini Dinar" },
  { code: "OMR", label: "OMR — Omani Rial" },
  { code: "TRY", label: "TRY (₺) — Turkish Lira" },
  { code: "INR", label: "INR (₹) — Indian Rupee" },
  { code: "JPY", label: "JPY (¥) — Japanese Yen" },
  { code: "CNY", label: "CNY (¥) — Chinese Yuan" },
  { code: "KRW", label: "KRW (₩) — South Korean Won" },
  { code: "CAD", label: "CAD (CA$) — Canadian Dollar" },
  { code: "AUD", label: "AUD (A$) — Australian Dollar" },
  { code: "CHF", label: "CHF (Fr) — Swiss Franc" },
  { code: "SEK", label: "SEK (kr) — Swedish Krona" },
  { code: "NOK", label: "NOK (kr) — Norwegian Krone" },
  { code: "DKK", label: "DKK (kr) — Danish Krone" },
  { code: "PLN", label: "PLN (zł) — Polish Zloty" },
  { code: "BRL", label: "BRL (R$) — Brazilian Real" },
  { code: "MXN", label: "MXN (MX$) — Mexican Peso" },
  { code: "HKD", label: "HKD (HK$) — Hong Kong Dollar" },
  { code: "SGD", label: "SGD (S$) — Singapore Dollar" },
  { code: "THB", label: "THB (฿) — Thai Baht" },
  { code: "ZAR", label: "ZAR (R) — South African Rand" },
  { code: "RUB", label: "RUB (₽) — Russian Ruble" },
];
