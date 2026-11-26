import { Minus, Square, X } from "lucide-react";
import { Window } from "@wailsio/runtime";

import { Logo } from "@/components/features/logo";
import { cn } from "@/lib/utils";

function control(action: () => Promise<void>) {
  void action();
}

export function TitleBar() {
  return (
    <div
      className="desktop-drag flex h-11 shrink-0 items-center gap-2 border-b bg-card/80 px-3 select-none"
      onDoubleClick={() => control(() => Window.ToggleMaximise())}
    >
      <Logo className="text-sm" />

      <div className="desktop-no-drag ml-auto flex items-center">
        <button
          type="button"
          aria-label="Minimize"
          className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          onClick={() => control(() => Window.Minimise())}
        >
          <Minus className="size-3.5" />
        </button>
        <button
          type="button"
          aria-label="Maximize"
          className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          onClick={() => control(() => Window.ToggleMaximise())}
        >
          <Square className="size-3" />
        </button>
        <button
          type="button"
          aria-label="Close"
          className={cn(
            "grid size-8 place-items-center rounded-md text-muted-foreground transition-colors",
            "hover:bg-destructive hover:text-white",
          )}
          onClick={() => control(() => Window.Close())}
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
