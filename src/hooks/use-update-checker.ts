import { useEffect, useState } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { toast } from "sonner";

export function useUpdateChecker() {
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [update, setUpdate] = useState<Update | null>(null);

  const checkForUpdates = async (silent = false) => {
    try {
      setChecking(true);
      const availableUpdate = await check();
      setUpdate(availableUpdate);

      if (availableUpdate) {
        toast.info(`Update ${availableUpdate.version} available`, {
          description: "A new version is ready to install.",
          action: {
            label: "Install",
            onClick: () => installUpdate(availableUpdate),
          },
          duration: 10000,
        });
      } else if (!silent) {
        toast.success("You're up to date!");
      }
    } catch (error) {
      console.error("Failed to check for updates:", error);
      if (!silent) {
        toast.error("Failed to check for updates");
      }
    } finally {
      setChecking(false);
    }
  };

  const installUpdate = async (updateToInstall: Update) => {
    try {
      setDownloading(true);
      setProgress(0);

      let downloaded = 0;
      let contentLength = 0;

      await updateToInstall.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            contentLength = event.data.contentLength ?? 0;
            toast.loading("Downloading update...", { id: "update-download" });
            break;
          case "Progress":
            downloaded += event.data.chunkLength;
            if (contentLength > 0) {
              const percent = Math.round((downloaded / contentLength) * 100);
              setProgress(percent);
              toast.loading(`Downloading update... ${percent}%`, {
                id: "update-download",
              });
            }
            break;
          case "Finished":
            toast.success("Update installed! Restarting...", {
              id: "update-download",
            });
            break;
        }
      });

      await relaunch();
    } catch (error) {
      console.error("Failed to install update:", error);
      toast.error("Failed to install update");
    } finally {
      setDownloading(false);
    }
  };

  // Check for updates on mount (silently)
  useEffect(() => {
    // Delay check to not block app startup
    const timeout = setTimeout(() => {
      checkForUpdates(true);
    }, 3000);

    return () => clearTimeout(timeout);
  }, []);

  return {
    checking,
    downloading,
    progress,
    update,
    checkForUpdates,
    installUpdate,
  };
}
