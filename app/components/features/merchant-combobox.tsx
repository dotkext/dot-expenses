import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronsUpDown,
  Loader2,
  Pencil,
  Plus,
  Store,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { useI18n } from "@/components/i18n-provider";
import { AccountSelect } from "@/components/features/account-select";
import { CategorySelect } from "@/components/features/category-select";
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { apiDelete, apiGet, apiPatch, apiPost, ApiError } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import type { MerchantDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

type Editor =
  | { mode: "create" }
  | { mode: "edit"; merchant: MerchantDTO };

type MerchantForm = {
  name: string;
  defaultCategoryId: string | null;
  defaultAccountId: string | null;
};

const EMPTY_FORM: MerchantForm = {
  name: "",
  defaultCategoryId: null,
  defaultAccountId: null,
};

/**
 * Store/merchant picker with create-as-you-type plus inline management:
 * add a store, rename it, change its learned defaults, or delete it without
 * leaving the transaction form.
 */
export function MerchantCombobox({
  value,
  onSelect,
  disabled,
}: {
  value: string | null;
  onSelect: (merchant: { name: string; defaultCategoryId: string | null; defaultAccountId: string | null } | null) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [form, setForm] = useState<MerchantForm>(EMPTY_FORM);
  const [confirmDelete, setConfirmDelete] = useState<MerchantDTO | null>(null);

  const { data: merchants, isLoading } = useQuery({
    queryKey: qk.merchants(),
    queryFn: () => apiGet<MerchantDTO[]>("/api/merchants"),
    enabled: open || editor != null,
  });

  const exactMatch = useMemo(
    () =>
      search.trim() !== "" &&
      (merchants ?? []).some((m) => m.name.toLowerCase() === search.trim().toLowerCase()),
    [search, merchants],
  );

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["merchants"], refetchType: "all" });
  }

  const createMutation = useMutation({
    mutationFn: () => apiPost<MerchantDTO>("/api/merchants", form),
    onSuccess: async (merchant) => {
      setEditor(null);
      toast.success(t("merchant.created"));
      await refresh();
      onSelect({
        name: merchant.name,
        defaultCategoryId: merchant.defaultCategoryId,
        defaultAccountId: merchant.defaultAccountId,
      });
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : t("common.failed")),
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (editor?.mode !== "edit") throw new Error("No store selected");
      return apiPatch(`/api/merchants/${editor.merchant.id}`, form);
    },
    onSuccess: async () => {
      const previous = editor?.mode === "edit" ? editor.merchant : null;
      setEditor(null);
      toast.success(t("merchant.updated"));
      await refresh();
      // Keep the parent form's selected store in sync after a rename. Defaults
      // are passed as null so editing a store doesn't overwrite the category or
      // account the user already picked for this transaction.
      if (previous && value?.toLowerCase() === previous.name.toLowerCase()) {
        onSelect({
          name: form.name.trim(),
          defaultCategoryId: null,
          defaultAccountId: null,
        });
      }
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : t("common.failed")),
  });

  const deleteMutation = useMutation({
    mutationFn: (merchant: MerchantDTO) => apiDelete(`/api/merchants/${merchant.id}`),
    onSuccess: async (_result, merchant) => {
      setConfirmDelete(null);
      toast.success(t("merchant.deleted"));
      await refresh();
      if (value?.toLowerCase() === merchant.name.toLowerCase()) onSelect(null);
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : t("common.failed")),
  });

  function openCreate() {
    setOpen(false);
    setForm({ ...EMPTY_FORM, name: search.trim() });
    setEditor({ mode: "create" });
  }

  function openEdit(merchant: MerchantDTO) {
    setOpen(false);
    setForm({
      name: merchant.name,
      defaultCategoryId: merchant.defaultCategoryId,
      defaultAccountId: merchant.defaultAccountId,
    });
    setEditor({ mode: "edit", merchant });
  }

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            data-slot="merchant-trigger"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between font-normal"
          >
            {value ? (
              <span className="flex min-w-0 items-center gap-2 truncate">
                <Store className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                {value}
              </span>
            ) : (
              <span className="flex items-center gap-2 text-muted-foreground">
                <Store className="size-4" aria-hidden />
                {t("merchant.placeholder")}
              </span>
            )}
            <ChevronsUpDown className="ml-1 size-4 shrink-0 opacity-50" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(24rem,calc(100vw-2rem))] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={t("merchant.search")}
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              {isLoading ? (
                <div className="grid gap-2 p-2">
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-2/3" />
                </div>
              ) : (
                <>
                  <CommandEmpty>{t("merchant.empty")}</CommandEmpty>
                  {(merchants ?? []).length > 0 && (
                    <CommandGroup heading={t("merchant.stores")}>
                      {(merchants ?? [])
                        .filter((m) =>
                          search.trim() === ""
                            ? true
                            : m.name.toLowerCase().includes(search.trim().toLowerCase()),
                        )
                        .slice(0, 12)
                        .map((m) => (
                          <CommandItem
                            key={m.id}
                            value={m.id}
                            onSelect={() => {
                              onSelect({
                                name: m.name,
                                defaultCategoryId: m.defaultCategoryId,
                                defaultAccountId: m.defaultAccountId,
                              });
                              setOpen(false);
                            }}
                            className="group gap-2 pr-1"
                          >
                            <Check
                              className={cn(
                                "size-4 shrink-0",
                                value?.toLowerCase() === m.name.toLowerCase()
                                  ? "opacity-100"
                                  : "opacity-0",
                              )}
                              aria-hidden
                            />
                            <span className="min-w-0 flex-1 truncate">{m.name}</span>
                            {m.defaultCategoryName && (
                              <span className="max-w-28 shrink-0 truncate text-xs text-muted-foreground">
                                {m.defaultCategoryName}
                              </span>
                            )}
                            <span
                              className="ml-1 flex shrink-0 items-center gap-0.5"
                              onPointerDown={(event) => event.stopPropagation()}
                            >
                              <button
                                type="button"
                                aria-label={t("merchant.editAria", { name: m.name })}
                                className="grid size-6 place-items-center rounded-md text-muted-foreground opacity-60 transition hover:bg-foreground/10 hover:text-foreground hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  openEdit(m);
                                }}
                              >
                                <Pencil className="size-3.5" aria-hidden />
                              </button>
                              <button
                                type="button"
                                aria-label={t("merchant.deleteAria", { name: m.name })}
                                className="grid size-6 place-items-center rounded-md text-muted-foreground opacity-60 transition hover:bg-destructive/10 hover:text-destructive hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  setOpen(false);
                                  setConfirmDelete(m);
                                }}
                              >
                                <Trash2 className="size-3.5" aria-hidden />
                              </button>
                            </span>
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  )}
                  {search.trim() !== "" && !exactMatch && (
                    <CommandGroup>
                      <CommandItem
                        value={`__create__${search}`}
                        onSelect={() => {
                          onSelect({
                            name: search.trim(),
                            defaultCategoryId: null,
                            defaultAccountId: null,
                          });
                          setOpen(false);
                        }}
                      >
                        <span className="mr-2 grid size-4 place-items-center">+</span>
                        {t("merchant.create", { name: search.trim() })}
                      </CommandItem>
                    </CommandGroup>
                  )}
                </>
              )}
            </CommandList>
            <div className="border-t p-1">
              <button
                type="button"
                onClick={openCreate}
                disabled={disabled}
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
              >
                <Plus className="size-4" aria-hidden />
                {t("merchant.new")}
              </button>
            </div>
          </Command>
        </PopoverContent>
      </Popover>
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 text-muted-foreground"
          onClick={() => onSelect(null)}
          aria-label={t("merchant.clear")}
        >
          <X className="size-4" />
        </Button>
      )}

      <Dialog open={editor != null} onOpenChange={(next) => !next && setEditor(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editor?.mode === "edit" ? t("merchant.editTitle") : t("merchant.newTitle")}
            </DialogTitle>
            <DialogDescription>{t("merchant.dialogDescription")}</DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (!form.name.trim() || saving) return;
              if (editor?.mode === "edit") updateMutation.mutate();
              else createMutation.mutate();
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="merchant-store-name">{t("common.name")}</Label>
              <Input
                id="merchant-store-name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                maxLength={120}
                autoFocus
                required
              />
            </div>
            <div className="grid gap-2">
              <Label>{t("merchant.defaultCategory")}</Label>
              <CategorySelect
                value={form.defaultCategoryId}
                onChange={(id) => setForm({ ...form, defaultCategoryId: id })}
              />
            </div>
            <div className="grid gap-2">
              <Label>{t("merchant.defaultAccount")}</Label>
              <AccountSelect
                value={form.defaultAccountId}
                onChange={(id) => setForm({ ...form, defaultAccountId: id })}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setEditor(null)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={!form.name.trim() || saving}>
                {saving && <Loader2 className="animate-spin" aria-hidden />}
                {editor?.mode === "edit" ? t("common.save") : t("common.create")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirmDelete != null}
        onOpenChange={(next) => !next && setConfirmDelete(null)}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("merchant.deleteTitle", { name: confirmDelete?.name ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t("merchant.deleteBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (confirmDelete) deleteMutation.mutate(confirmDelete);
              }}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Trash2 className="size-4" aria-hidden />
              )}
              {t("merchant.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
