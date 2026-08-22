"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import {
  parseCreatePocketForm,
  parseDefaultPocketForm,
  parsePocketBudgetForm,
  parseRenamePocketForm,
  type PocketActionState
} from "@/lib/pocket-contract";
import {
  createPocket,
  loadPockets,
  renamePocket,
  setDefaultPocket,
  updatePocketBudget
} from "@/lib/pockets-api";

async function telegramUserId(): Promise<string | null> {
  const session = await verifySessionToken(
    (await cookies()).get(SESSION_COOKIE)?.value
  );
  return session?.telegramUserId ?? null;
}

function revalidatePocketConsumers(): void {
  revalidatePath("/pockets");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}

function complete(result: PocketActionState): PocketActionState {
  if (result.status === "success") revalidatePocketConsumers();
  return result;
}

function createBudgetForm(formData: FormData): FormData {
  const budgetForm = new FormData();
  budgetForm.set("pocketId", "1");
  for (const value of formData.getAll("amount")) budgetForm.append("amount", value);
  return budgetForm;
}

export async function createPocketAction(
  _previousState: PocketActionState,
  formData: FormData
): Promise<PocketActionState> {
  const userId = await telegramUserId();
  if (!userId) return { status: "unavailable" };

  const parsed = parseCreatePocketForm(formData);
  if (!parsed.ok) return parsed.state;
  const budget = parsePocketBudgetForm(createBudgetForm(formData));
  if (!budget.ok) return budget.state;

  return complete(await createPocket(userId, { name: parsed.value.name, amount: budget.value.amount }));
}

export async function renamePocketAction(
  _previousState: PocketActionState,
  formData: FormData
): Promise<PocketActionState> {
  const userId = await telegramUserId();
  if (!userId) return { status: "unavailable" };

  const parsed = parseRenamePocketForm(formData);
  if (!parsed.ok) return parsed.state;
  return complete(await renamePocket(userId, parsed.value.pocketId, parsed.value.name));
}

export async function updatePocketBudgetAction(
  _previousState: PocketActionState,
  formData: FormData
): Promise<PocketActionState> {
  const userId = await telegramUserId();
  if (!userId) return { status: "unavailable" };

  const parsed = parsePocketBudgetForm(formData);
  if (!parsed.ok) return parsed.state;
  const loaded = await loadPockets(userId);
  if (loaded.error) return { status: "unavailable" };
  const pocket = loaded.pockets.find(({ id }) => id === parsed.value.pocketId);
  if (!pocket) return { status: "not_found" };

  return complete(await updatePocketBudget(userId, pocket.name, parsed.value.amount));
}

export async function setDefaultPocketAction(
  _previousState: PocketActionState,
  formData: FormData
): Promise<PocketActionState> {
  const userId = await telegramUserId();
  if (!userId) return { status: "unavailable" };

  const parsed = parseDefaultPocketForm(formData);
  if (!parsed.ok) return parsed.state;
  return complete(await setDefaultPocket(userId, parsed.value.pocketId));
}
