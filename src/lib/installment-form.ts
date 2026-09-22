import type {
  InstallmentField,
  InstallmentRequest
} from "./installment-contract.ts";

export type ParsedInstallmentForm =
  | { ok: true; value: InstallmentRequest & { transactionId: string } }
  | {
    ok: false;
    state: {
      status: "validation";
      fieldErrors: Partial<Record<InstallmentField, string>>;
    };
  };

const RATE_PATTERN = /^(?:0|[1-9]\d{0,2})(?:\.\d{1,4})?$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const UTC_TIMESTAMP = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})\.\d{6}Z$/;

function singleValue(formData: FormData, name: InstallmentField): string | undefined {
  const values = formData.getAll(name);
  return values.length === 1 && typeof values[0] === "string" ? values[0].trim() : undefined;
}

function validDate(value: string | undefined): boolean {
  if (!value || !DATE_PATTERN.test(value)) return false;
  const [, yearText, monthText, dayText] = DATE_PATTERN.exec(value) as RegExpExecArray;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  return year >= 1 && year <= 9999 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

function validTimestamp(value: string | undefined): boolean {
  if (!value) return false;
  const match = UTC_TIMESTAMP.exec(value);
  if (!match) return false;
  const parsed = new Date(`${match[1]}.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 19) === match[1];
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return leap ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function parseInstallmentForm(formData: FormData): ParsedInstallmentForm {
  const errors: Partial<Record<InstallmentField, string>> = {};
  const transactionId = singleValue(formData, "transactionId");
  const expectedUpdatedAt = singleValue(formData, "expectedUpdatedAt");
  const tenorValue = singleValue(formData, "tenorMonths");
  const monthlyRatePercent = singleValue(formData, "monthlyRatePercent");
  const firstDueDate = singleValue(formData, "firstDueDate");

  if (!transactionId || !/^[1-9]\d*$/.test(transactionId)) {
    errors.transactionId = "Select a valid transaction.";
  }
  if (!validTimestamp(expectedUpdatedAt)) {
    errors.expectedUpdatedAt = "Refresh this transaction before saving.";
  }

  const tenorMonths = tenorValue && /^[1-9]\d*$/.test(tenorValue) ? Number(tenorValue) : Number.NaN;
  if (!Number.isSafeInteger(tenorMonths) || tenorMonths < 1 || tenorMonths > 120) {
    errors.tenorMonths = "Enter a tenor from 1 to 120 months.";
  }
  if (!monthlyRatePercent || !RATE_PATTERN.test(monthlyRatePercent)) {
    errors.monthlyRatePercent = "Enter a flat monthly rate from 0 to 100% with up to four decimals.";
  } else {
    const [whole, fraction = ""] = monthlyRatePercent.split(".");
    const rateUnits = BigInt(whole) * 10_000n + BigInt(fraction.padEnd(4, "0"));
    if (rateUnits > 1_000_000n) {
      errors.monthlyRatePercent = "Enter a flat monthly rate from 0 to 100% with up to four decimals.";
    }
  }
  if (!validDate(firstDueDate)) {
    errors.firstDueDate = "Enter a valid first due date.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, state: { status: "validation", fieldErrors: errors } };
  }
  return {
    ok: true,
    value: {
      transactionId: transactionId as string,
      expectedUpdatedAt: expectedUpdatedAt as string,
      tenorMonths,
      monthlyRatePercent: monthlyRatePercent as string,
      firstDueDate: firstDueDate as string
    }
  };
}
