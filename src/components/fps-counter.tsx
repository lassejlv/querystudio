import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { cn } from "@/lib/utils";

interface ProcessStats {
  cpu_usage: number;
  memory_usage: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function FpsCounter() {
  const [fps, setFps] = useState(0);
  const [stats, setStats] = useState<ProcessStats | null>(null);

  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let animationFrameId: number;

    const loop = (time: number) => {
      frameCount++;
      const elapsed = time - lastTime;

      if (elapsed >= 1000) {
        setFps(Math.round((frameCount * 1000) / elapsed));
        frameCount = 0;
        lastTime = time;
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const stats = await invoke<ProcessStats>("get_process_stats");
        setStats(stats);
      } catch (e) {
        console.error("Failed to fetch process stats", e);
      }
    };

    // Initial fetch
    fetchStats();

    const interval = setInterval(fetchStats, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className={cn(
        "pointer-events-none fixed right-2 top-2 z-50 flex flex-col items-end gap-1 rounded bg-black/50 p-2 text-xs font-mono text-white backdrop-blur-sm"
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn(fps < 30 ? "text-red-400" : fps < 55 ? "text-yellow-400" : "text-green-400")}>
          {fps}
        </span>
        <span className="text-muted-foreground">FPS</span>
      </div>
      
      {stats && (
        <>
          <div className="flex items-center gap-2">
            <span className="text-blue-400">
              {stats.cpu_usage.toFixed(1)}%
            </span>
            <span className="text-muted-foreground">CPU</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-purple-400">
              {formatBytes(stats.memory_usage)}
            </span>
            <span className="text-muted-foreground">MEM</span>
          </div>
        </>
      )}
    </div>
  );
}
