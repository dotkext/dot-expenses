import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GripVertical, Plus, RotateCcw, X } from "lucide-react";
import { GridLayout, useContainerWidth } from "react-grid-layout";
import "react-grid-layout/css/styles.css";

import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { apiDelete, apiGet, apiPatch } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import type { DashboardSummary, WidgetLayoutItem } from "@/lib/types";
import { cn } from "@/lib/utils";

import { WIDGETS, widgetDef } from "./registry";

const ROW_HEIGHT = 56;
/** Widgets that replaced the old wide "summary" (Overview) widget. */
const STAT_WIDGET_IDS = ["income", "expenses", "net", "savings"] as const;

/** Merge saved layout with registry defaults for new/missing widgets. */
function normalizeLayout(saved: WidgetLayoutItem[]): WidgetLayoutItem[] {
  const known = new Set(WIDGETS.map((w) => w.id));

  // Migrate the old full-width Overview widget into four standalone stats,
  // keeping its row so existing dashboards keep their arrangement.
  const expanded: WidgetLayoutItem[] = saved.flatMap((item) => {
    if (item.i !== "summary") return [item];
    const h = Math.max(2, item.h);
    return STAT_WIDGET_IDS.map((id, index) => ({
      ...widgetDef(id)!.default,
      i: id,
      x: index * 3,
      y: item.y,
      w: 3,
      h,
    }));
  });

  const merged: WidgetLayoutItem[] = expanded
    .filter((item) => known.has(item.i))
    .map((item) => {
      const def = widgetDef(item.i)!;
      return {
        i: item.i,
        x: Math.min(Math.max(0, item.x), 11),
        y: Math.max(0, item.y),
        w: Math.min(Math.max(1, item.w), 12),
        h: Math.max(1, item.h),
        minW: def.default.minW,
        minH: def.default.minH,
      };
    });

  // Widgets added to the app after the layout was saved are appended below.
  for (const def of WIDGETS) {
    if (!merged.some((item) => item.i === def.id)) {
      const maxY = merged.reduce((max, item) => Math.max(max, item.y + item.h), 0);
      merged.push({ ...def.default, i: def.id, y: maxY });
    }
  }

  // Drop duplicates (first occurrence wins)
  const seen = new Set<string>();
  return merged.filter((item) => (seen.has(item.i) ? false : seen.add(item.i)));
}

function defaultLayout(): WidgetLayoutItem[] {
  return WIDGETS.map((def) => ({ ...def.default, i: def.id }));
}

function WidgetFrame({
  id,
  title,
  editing,
  onRemove,
  children,
}: {
  id: string;
  title: string;
  editing: boolean;
  onRemove?: () => void;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-xl border bg-card shadow-sm",
        editing && "ring-1 ring-primary/30",
      )}
    >
      <header className="flex h-9 shrink-0 items-center gap-1.5 border-b bg-card px-3">
        {editing && <GripVertical className="size-3.5 cursor-grab text-muted-foreground" aria-hidden />}
        <span className="truncate text-xs font-semibold text-muted-foreground">{title}</span>
        {editing && onRemove && (
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto size-6 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
            aria-label={t("widgets.removeAria", { title })}
          >
            <X className="size-3.5" />
          </Button>
        )}
      </header>
      <div className="min-h-0 flex-1 p-3" data-widget={id}>
        {children}
      </div>
    </div>
  );
}

export function DashboardGrid({
  summary,
  initialLayout,
  initialMonth,
}: {
  summary: DashboardSummary | undefined;
  initialLayout: WidgetLayoutItem[];
  initialMonth: string;
}) {
  const { t } = useI18n();
  const { containerRef, width } = useContainerWidth({ initialWidth: 1200 });
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [layout, setLayout] = useState<WidgetLayoutItem[]>(() => normalizeLayout(initialLayout));
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Own client-mount gate: the SSR pass and the client's hydration render
  // must agree (skeleton), then the measured grid takes over.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const layoutQuery = useQuery({
    queryKey: qk.dashboardLayout,
    queryFn: async () => {
      const res = await apiGet<{ layout: WidgetLayoutItem[] }>("/api/dashboard/layout");
      return normalizeLayout(res.layout);
    },
    initialData: normalizeLayout(initialLayout),
    staleTime: Infinity,
  });

  useEffect(() => {
    if (layoutQuery.data && !editing) {
      setLayout(normalizeLayout(layoutQuery.data));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutQuery.dataUpdatedAt]);

  const saveLayout = useMutation({
    mutationFn: (next: WidgetLayoutItem[]) =>
      apiPatch("/api/dashboard/layout", { layout: next.map(({ i, x, y, w, h }) => ({ i, x, y, w, h })) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.dashboardLayout });
    },
  });

  const onLayoutChange = useCallback(
    (next: readonly WidgetLayoutItem[]) => {
      const items: WidgetLayoutItem[] = next.map((item) => ({
        i: item.i,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        minW: item.minW,
        minH: item.minH,
      }));
      setLayout(items);
      if (editing) {
        clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => saveLayout.mutate(items), 600);
      }
    },
    [editing, saveLayout],
  );

  const visible = useMemo(() => layout.filter((item) => widgetDef(item.i)), [layout]);
  const hiddenDefs = useMemo(
    () => WIDGETS.filter((def) => !layout.some((item) => item.i === def.id)),
    [layout],
  );

  function addWidget(id: string) {
    const def = widgetDef(id);
    if (!def) return;
    const maxY = layout.reduce((max, item) => Math.max(max, item.y + item.h), 0);
    const next = [...layout, { ...def.default, i: def.id, y: maxY }];
    setLayout(next);
    saveLayout.mutate(next);
  }

  function removeWidget(id: string) {
    const next = layout.filter((item) => item.i !== id);
    setLayout(next);
    saveLayout.mutate(next);
  }

  async function resetLayout() {
    const res = await apiDelete<{ layout: WidgetLayoutItem[] }>("/api/dashboard/layout");
    const next = normalizeLayout(res.layout.length ? res.layout : defaultLayout());
    setLayout(next);
    void queryClient.invalidateQueries({ queryKey: qk.dashboardLayout });
  }

  const isSummaryPending = !summary;

  const contentFor = (id: string) => {
    const def = widgetDef(id);
    if (!def) return null;
    if (isSummaryPending) {
      return <Skeleton className="h-full w-full" />;
    }
    const Component = def.component;
    return <Component summary={summary!} />;
  };

  return (
    <div className="grid gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1" />
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Plus className="size-4" aria-hidden />
              {t("widgets.add")}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 p-1">
            {hiddenDefs.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">{t("widgets.allOnDashboard")}</p>
            ) : (
              hiddenDefs.map((def) => (
                <button
                  key={def.id}
                  type="button"
                  className="flex w-full flex-col items-start gap-0.5 rounded-md px-3 py-2 text-left hover:bg-accent"
                  onClick={() => addWidget(def.id)}
                >
                  <span className="text-sm font-medium">{t(def.titleKey)}</span>
                  <span className="text-xs text-muted-foreground">{t(def.descriptionKey)}</span>
                </button>
              ))
            )}
          </PopoverContent>
        </Popover>
        <Button
          variant={editing ? "default" : "outline"}
          size="sm"
          onClick={() => {
            if (editing) saveLayout.mutate(layout);
            setEditing((prev) => !prev);
          }}
        >
          {editing ? t("widgets.done") : t("widgets.editLayout")}
        </Button>
        {editing && (
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" onClick={resetLayout}>
            <RotateCcw className="size-4" aria-hidden />
            {t("common.reset")}
          </Button>
        )}
      </div>

      {editing && (
        <p className="-mt-2 text-xs text-muted-foreground">{t("widgets.dragHelp")}</p>
      )}

      {/* Desktop grid */}
      <div ref={containerRef} className="hidden md:block">
        {mounted ? (
          <GridLayout
            width={width}
            layout={layout}
            gridConfig={{ cols: 12, rowHeight: ROW_HEIGHT, margin: [12, 12] }}
            dragConfig={{ enabled: editing, handle: ".widget-drag-handle" }}
            resizeConfig={{ enabled: editing }}
            onLayoutChange={onLayoutChange}
          >
            {visible.map((item) => {
              const def = widgetDef(item.i)!;
              return (
                <div key={item.i} className="h-full">
                  <div className="widget-drag-handle h-full">
                    <WidgetFrame
                      id={item.i}
                      title={t(def.titleKey)}
                      editing={editing}
                      onRemove={editing ? () => removeWidget(item.i) : undefined}
                    >
                      {contentFor(item.i)}
                    </WidgetFrame>
                  </div>
                </div>
              );
            })}
          </GridLayout>
        ) : (
          <DashboardSkeleton initialMonth={initialMonth} />
        )}
      </div>

      {/* Mobile stacked view */}
      <div className="grid gap-3 md:hidden">
        {visible.map((item) => {
          const def = widgetDef(item.i)!;
          return (
            <div key={item.i} className="min-h-44">
              <WidgetFrame id={item.i} title={t(def.titleKey)} editing={false}>
                {contentFor(item.i)}
              </WidgetFrame>
            </div>
          );
        })}
      </div>

      <Separator className="hidden" />
    </div>
  );
}

// (Layout items are structurally identical to WidgetLayoutItem.)

function DashboardSkeleton({ initialMonth }: { initialMonth: string }) {
  const { t, fmtMonth } = useI18n();
  return (
    <div
      className="grid gap-3"
      aria-busy="true"
      aria-label={t("widgets.loading", { month: fmtMonth(initialMonth) })}
    >
      <Skeleton className="h-24 w-full" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}
