import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFinanceAccess } from "@/lib/invoices/server/access";
import { getRecipeEditor } from "@/lib/food-cost/server/queries";
import { NoFinanceAccess } from "../../_components/finance-bits";
import { RecipeEditor } from "./recipe-editor";

export const metadata: Metadata = { title: "Scheda tecnica" };

export default async function RecipePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tipo?: string }> }) {
  const { id } = await params;
  const isNew = id === "nuova";
  if (!isNew && !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const access = await getFinanceAccess("read");
  if (!access.ok) return <NoFinanceAccess message={access.error} />;
  const { db, ctx, canWrite } = access;
  const data = await getRecipeEditor(db, ctx.restaurantId, isNew ? null : id);
  if (!isNew && !data.recipe) notFound();
  const sp = await searchParams;
  return <RecipeEditor data={data} canWrite={canWrite} initialKind={sp.tipo === "base" ? "base" : "dish"} />;
}
