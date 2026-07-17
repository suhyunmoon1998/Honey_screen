export function formatPhoneInput(value: string) {
  const allDigits = value.replace(/\D/g, "");
  const digits = (
    allDigits.length === 11 && allDigits.startsWith("1")
      ? allDigits.slice(1)
      : allDigits
  ).slice(0, 10);

  if (digits.length === 0) {
    return "";
  }

  if (digits.length < 4) {
    return `(${digits}`;
  }

  if (digits.length < 7) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  }

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}
