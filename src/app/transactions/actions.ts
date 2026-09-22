"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import {
  parseTransactionEditForm,
  type TransactionEditState
} from "@/lib/transaction-contract";
import {
  createInstallments as requestInstallments,
  previewInstallments as requestInstallmentPreview
} from "@/lib/installments-api";
import {
  parseInstallmentForm
} from "@/lib/installment-form";
import type {
  InstallmentActionState,
  InstallmentCreateActionState,
  InstallmentPreviewActionState
} from "@/lib/installment-contract";
import { updateTransaction } from "@/lib/transactions-api";

export async function editTransaction(
  _previousState: TransactionEditState,
  formData: FormData
): Promise<TransactionEditState> {
  const session = await verifySessionToken(
    (await cookies()).get(SESSION_COOKIE)?.value
  );
  if (!session) return { status: "unavailable" };

  const parsed = parseTransactionEditForm(formData);
  if (!parsed.ok) return parsed.state;

  const { transactionId, ...input } = parsed.value;
  const result = await updateTransaction(session.telegramUserId, transactionId, input);
  if (result.status === "success") {
    revalidatePath("/transactions");
    revalidatePath("/dashboard");
  }
  return result;
}

function metadata(formData: FormData): { generation: number; requestKey: string } {
  const generationValue = formData.get("previewGeneration");
  const requestKeyValue = formData.get("requestKey");
  const generation = typeof generationValue === "string" && /^\d+$/.test(generationValue)
    ? Number(generationValue)
    : 0;
  const requestKey = typeof requestKeyValue === "string" && requestKeyValue.length <= 2_000
    ? requestKeyValue
    : "";
  return Number.isSafeInteger(generation) ? { generation, requestKey } : { generation: 0, requestKey };
}

export async function previewInstallments(
  _previousState: InstallmentActionState,
  formData: FormData
): Promise<InstallmentPreviewActionState> {
  const session = await verifySessionToken(
    (await cookies()).get(SESSION_COOKIE)?.value
  );
  if (!session) return { status: "unavailable" };

  const parsed = parseInstallmentForm(formData);
  if (!parsed.ok) return parsed.state;
  const { transactionId, expectedUpdatedAt, tenorMonths, monthlyRatePercent, firstDueDate } = parsed.value;
  const result = await requestInstallmentPreview(session.telegramUserId, transactionId, {
    expectedUpdatedAt,
    tenorMonths,
    monthlyRatePercent,
    firstDueDate
  });
  if (result.status === "success") {
    return { status: "preview", preview: result.preview, ...metadata(formData) };
  }
  return result;
}

export async function createInstallments(
  _previousState: InstallmentActionState,
  formData: FormData
): Promise<InstallmentCreateActionState> {
  const session = await verifySessionToken(
    (await cookies()).get(SESSION_COOKIE)?.value
  );
  if (!session) return { status: "unavailable" };

  const parsed = parseInstallmentForm(formData);
  if (!parsed.ok) return parsed.state;
  const { transactionId, expectedUpdatedAt, tenorMonths, monthlyRatePercent, firstDueDate } = parsed.value;
  const result = await requestInstallments(session.telegramUserId, transactionId, {
    expectedUpdatedAt,
    tenorMonths,
    monthlyRatePercent,
    firstDueDate
  });
  if (result.status === "success") {
    revalidatePath("/transactions");
    revalidatePath("/dashboard");
    return { status: "success", plan: result.plan };
  }
  return result;
}
