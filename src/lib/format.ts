export const formatPLN = (v: number | string) =>
  new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", maximumFractionDigits: 0 }).format(Number(v));

export const formatKm = (v: number) =>
  new Intl.NumberFormat("pl-PL").format(v) + " km";

export const formatMileage = (value: number, unit?: string | null) =>
  new Intl.NumberFormat("pl-PL").format(value) + (unit === "mi" ? " mi" : " km");
