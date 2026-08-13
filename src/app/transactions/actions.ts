"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import {
  parseTransactionEditForm,
  type TransactionEditState
} from "@/lib/transaction-contract";
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
