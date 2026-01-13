import { toast } from "sonner";
import { useThemeStore } from "@/lib/theme-store";
import type { Theme } from "@/lib/themes";

export function useThemeImport() {
  const { importTheme, setActiveTheme } = useThemeStore();

  const importThemeFromFile = (file: File) => {
    return new Promise<boolean>((resolve) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const result = importTheme(content);
          
          if (result.success) {
            toast.success("Theme imported successfully!");
            resolve(true);
          } else {
            toast.error(`Failed to import theme: ${result.error}`);
            resolve(false);
          }
        } catch (error) {
          toast.error("Failed to read theme file");
          resolve(false);
        }
      };
      
      reader.onerror = () => {
        toast.error("Failed to read theme file");
        resolve(false);
      };
      
      reader.readAsText(file);
    });
  };

  const importThemeFromJson = (jsonString: string) => {
    const result = importTheme(jsonString);
    
    if (result.success) {
      toast.success("Theme imported successfully!");
      return true;
    } else {
      toast.error(`Failed to import theme: ${result.error}`);
      return false;
    }
  };

  const importAndApplyTheme = (file: File) => {
    return new Promise<boolean>((resolve) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const result = importTheme(content);
          
          if (result.success) {
            const theme: Theme = JSON.parse(content);
            setActiveTheme(theme.id);
            toast.success(`Theme "${theme.displayName || theme.name}" imported and applied!`);
            resolve(true);
          } else {
            toast.error(`Failed to import theme: ${result.error}`);
            resolve(false);
          }
        } catch (error) {
          toast.error("Failed to read theme file");
          resolve(false);
        }
      };
      
      reader.onerror = () => {
        toast.error("Failed to read theme file");
        resolve(false);
      };
      
      reader.readAsText(file);
    });
  };

  return {
    importThemeFromFile,
    importThemeFromJson,
    importAndApplyTheme,
  };
}