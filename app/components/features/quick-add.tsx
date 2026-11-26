import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRevalidator } from "react-router";
import { toast } from "sonner";

import { useI18n } from "@/components/i18n-provider";
import {
  defaultsFor,
  TransactionForm,
  type TransactionFormValues,
} from "@/components/features/transaction-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiDelete, apiPost, ApiError } from "@/lib/api";
import type { TransactionDTO } from "@/lib/types";
import { useUiStore } from "@/stores/ui";

/**
 * Global quick-add dialog. Opened by the FAB, the "n" shortcut and the
 * command menu. Saves fast: Enter submits, toast offers Undo.
 */
export function QuickAddDialog() {
  const { t, fmtMoney } = useI18n();
  const { quickAddOpen, quickAddType, closeQuickAdd } = useUiStore();
  const queryClient = useQueryClient();
  const revalidator = useRevalidator();

  const [values, setValues] = useState<TransactionFormValues>(defaultsFor());
  const [error, setError] = useState<string | null>(null);

  // Reset every time the dialog opens
  useEffect(() => {
    if (quickAddOpen) {
      setValues(defaultsFor({ type: quickAddType, currency: baseCurrencyHint }));
      setError(null);
    }
  }, [quickAddOpen, quickAddType]);

  const mutation = useMutation({
    mutationFn: (input: Parameters<typeof apiPost>[1]) =>
      apiPost<{ transaction: TransactionDTO }>("/api/transactions", input),
    onSuccess: async ({ transaction }) => {
      closeQuickAdd();
      setValues(defaultsFor());
      toast.success(
        t("quickAdd.added", {
          type: t(transaction.type === "expense" ? "common.expense" : "common.income"),
          amount: fmtMoney(transaction.amount, transaction.currency),
        }),
        {
          action: {
            label: t("quickAdd.undo"),
            onClick: async () => {
              try {
                await apiDelete(`/api/transactions/${transaction.id}`);
                await Promise.all([
                  queryClient.invalidateQueries(),
                  revalidator.revalidate(),
                ]);
                toast(t("quickAdd.removed"));
              } catch {
                toast.error(t("quickAdd.undoFailed"));
              }
            },
          },
        },
      );
      await Promise.all([queryClient.invalidateQueries(), revalidator.revalidate()]);
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : t("common.failed"));
    },
  });

  return (
    <Dialog open={quickAddOpen} onOpenChange={(open) => (open ? null : closeQuickAdd())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("quickAdd.title")}</DialogTitle>
          <DialogDescription>{t("quickAdd.description")}</DialogDescription>
        </DialogHeader>
        <TransactionForm
          values={values}
          onValuesChange={setValues}
          onSubmit={(input) => mutation.mutate(input)}
          pending={mutation.isPending}
          error={error}
          submitLabel={t("quickAdd.submit")}
          autoFocus
        />
      </DialogContent>
    </Dialog>
  );
}

// The base currency comes from the user's context; resolved lazily to avoid a
// circular dependency with the shell (set by the shell on mount).
let baseCurrencyHint = "USD";
export function setBaseCurrencyHint(code: string) {
  baseCurrencyHint = code;
}
