import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRevalidator } from "react-router";
import { Copy, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useI18n } from "@/components/i18n-provider";
import {
  TransactionForm,
  type TransactionFormValues,
} from "@/components/features/transaction-form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiDelete, apiPatch, apiPost, ApiError } from "@/lib/api";
import type { TransactionDTO } from "@/lib/types";

/** Row action menu: edit (dialog), duplicate, delete (confirm). */
export function TransactionRowMenu({ transaction }: { transaction: TransactionDTO }) {
  const { t, fmtDate, fmtMoney } = useI18n();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [values, setValues] = useState<TransactionFormValues>(() => toFormValues(transaction));

  const queryClient = useQueryClient();
  const revalidator = useRevalidator();

  async function refresh() {
    await Promise.all([queryClient.invalidateQueries(), revalidator.revalidate()]);
  }

  useEffect(() => {
    if (editing) setValues(toFormValues(transaction));
  }, [editing, transaction]);

  const editMutation = useMutation({
    mutationFn: (input: Parameters<typeof apiPatch>[1]) =>
      apiPatch(`/api/transactions/${transaction.id}`, input),
    onSuccess: async () => {
      setEditing(false);
      toast.success(t("tx.updated"));
      await refresh();
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : t("tx.updateFailed")),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiDelete(`/api/transactions/${transaction.id}`),
    onSuccess: async () => {
      setDeleting(false);
      toast.success(t("tx.deleted"));
      await refresh();
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : t("tx.deleteFailed")),
  });

  const duplicateMutation = useMutation({
    mutationFn: () => apiPost(`/api/transactions/${transaction.id}/duplicate`),
    onSuccess: async () => {
      toast.success(t("tx.duplicated"));
      await refresh();
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : t("tx.duplicateFailed")),
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={t("tx.rowActions")}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setEditing(true)}>
            <Pencil className="size-4" aria-hidden /> {t("common.edit")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => duplicateMutation.mutate()}
            disabled={duplicateMutation.isPending}
          >
            <Copy className="size-4" aria-hidden /> {t("tx.duplicate")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setDeleting(true)}>
            <Trash2 className="size-4" aria-hidden /> {t("common.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("tx.editTitle")}</DialogTitle>
            <DialogDescription>
              {fmtDate(transaction.date)} ·{" "}
              {transaction.merchantName ?? transaction.categoryName ?? t("tx.fallback")}
            </DialogDescription>
          </DialogHeader>
          <TransactionForm
            values={values}
            onValuesChange={setValues}
            onSubmit={(input) => editMutation.mutate(input)}
            onCancel={() => setEditing(false)}
            pending={editMutation.isPending}
            error={editMutation.error instanceof ApiError ? editMutation.error.message : null}
            submitLabel={t("common.saveChanges")}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("tx.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("tx.deleteBody", {
                amount: `${transaction.type === "expense" ? "−" : "+"}${fmtMoney(
                  transaction.amount,
                  transaction.currency,
                )}`,
                date: fmtDate(transaction.date),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => deleteMutation.mutate()}>
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function toFormValues(transaction: TransactionDTO): TransactionFormValues {
  return {
    type: transaction.type,
    amount: String(transaction.amount),
    currency: transaction.currency,
    accountId: transaction.accountId,
    categoryId: transaction.categoryId,
    merchant: transaction.merchantName,
    date: transaction.date,
    notes: transaction.notes,
  };
}
