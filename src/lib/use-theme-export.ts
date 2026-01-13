import { toast } from "sonner";
import { useThemeStore } from "@/lib/theme-store";

export function useThemeExport() {
  const { exportTheme, getActiveTheme, getAllThemes, getTheme } = useThemeStore();

  const exportCurrentTheme = () => {
    const activeTheme = getActiveTheme();
    const themeJson = exportTheme(activeTheme.id);
    
    if (themeJson) {
      downloadThemeFile(themeJson, `${activeTheme.name}.json`);
      toast.success(`Theme "${activeTheme.displayName || activeTheme.name}" exported!`);
    } else {
      toast.error("Failed to export theme");
    }
  };

  const exportThemeById = (themeId: string) => {
    const themeJson = exportTheme(themeId);
    
    if (themeJson) {
      const theme = getTheme(themeId);
      if (theme) {
        downloadThemeFile(themeJson, `${theme.name}.json`);
        toast.success(`Theme "${theme.displayName || theme.name}" exported!`);
      }
    } else {
      toast.error("Failed to export theme");
    }
  };

  const exportAllThemes = () => {
    const themes = getAllThemes();
    const themesData = {
      exportedAt: new Date().toISOString(),
      themes: themes,
    };
    
    const themesJson = JSON.stringify(themesData, null, 2);
    downloadThemeFile(themesJson, "all-themes.json");
    toast.success("All themes exported!");
  };

  const downloadThemeFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
  };

  return {
    exportCurrentTheme,
    exportThemeById,
    exportAllThemes,
  };
}