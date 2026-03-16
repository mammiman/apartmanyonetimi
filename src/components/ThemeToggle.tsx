import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ThemeToggleProps {
  compact?: boolean;
}

export function ThemeToggle({ compact = false }: ThemeToggleProps) {
  const { setTheme, resolvedTheme, theme } = useTheme();

  const icon = resolvedTheme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />;
  const label = theme === "system" ? "Tema: Sistem" : theme === "dark" ? "Tema: Koyu" : "Tema: Açık";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size={compact ? "icon" : "sm"} className={compact ? "h-9 w-9" : "gap-2"}>
          {icon}
          {!compact && <span>{label}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")} className="gap-2">
          <Sun className="h-4 w-4" />
          Açık
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")} className="gap-2">
          <Moon className="h-4 w-4" />
          Koyu
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")} className="gap-2">
          <Monitor className="h-4 w-4" />
          Sistem
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
