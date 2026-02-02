import { useEffect, useRef, useCallback, memo } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { useConnectionStore } from "@/lib/store";
import { useThemeStore } from "@/lib/theme-store";
import { api } from "@/lib/api";
import "@xterm/xterm/css/xterm.css";
import type { TabContentProps } from "@/lib/tab-sdk";

// Constants
const PROMPT = "\x1b[32mredis>\x1b[0m ";
const HISTORY_KEY = "redis-console-history";
const MAX_HISTORY = 1000;

// Get computed color from CSS variable and convert to hex
function getCssVarAsHex(varName: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();

  if (!value) {
    return "#1a1b26";
  }

  const temp = document.createElement("div");
  temp.style.cssText = `color: ${value}; display: none;`;
  document.body.appendChild(temp);

  const computedColor = getComputedStyle(temp).color;
  document.body.removeChild(temp);

  const match = computedColor.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (match) {
    const r = parseInt(match[1], 10);
    const g = parseInt(match[2], 10);
    const b = parseInt(match[3], 10);
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }

  return "#1a1b26";
}

function buildTerminalTheme() {
  const bg = getCssVarAsHex("--background");
  const fg = getCssVarAsHex("--foreground");
  const primary = getCssVarAsHex("--primary");
  const primaryFg = getCssVarAsHex("--primary-foreground");
  const accent = getCssVarAsHex("--accent");
  const accentFg = getCssVarAsHex("--accent-foreground");
  const muted = getCssVarAsHex("--muted-foreground");
  const destructive = getCssVarAsHex("--destructive");
  const chart1 = getCssVarAsHex("--chart-1");
  const chart2 = getCssVarAsHex("--chart-2");
  const chart3 = getCssVarAsHex("--chart-3");
  const chart4 = getCssVarAsHex("--chart-4");
  const sidebarPrimary = getCssVarAsHex("--sidebar-primary");

  return {
    background: bg,
    foreground: fg,
    cursor: primary,
    cursorAccent: primaryFg,
    selectionBackground: accent + "80",
    selectionForeground: accentFg,
    black: bg,
    red: destructive,
    green: chart2,
    yellow: chart3,
    blue: chart1,
    magenta: chart4,
    cyan: sidebarPrimary,
    white: fg,
    brightBlack: muted,
    brightRed: destructive,
    brightGreen: chart2,
    brightYellow: chart3,
    brightBlue: chart1,
    brightMagenta: chart4,
    brightCyan: sidebarPrimary,
    brightWhite: fg,
  };
}

export const RedisConsole = memo(function RedisConsole({
  tabId: _tabId,
  paneId: _paneId,
  connectionId: propsConnectionId,
}: TabContentProps) {
  const activeConnectionId = useConnectionStore((s) => s.activeConnectionId);
  const connectionId = propsConnectionId || activeConnectionId || null;
  const activeThemeId = useThemeStore((s) => s.activeTheme);

  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const isInitializedRef = useRef(false);

  // Current input line state
  const inputBufferRef = useRef<string>("");
  const commandHistoryRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const cursorPosRef = useRef<number>(0);

  // Load history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(HISTORY_KEY);
      if (saved) {
        commandHistoryRef.current = JSON.parse(saved);
      }
    } catch {
      commandHistoryRef.current = [];
    }
  }, []);

  // Save history to localStorage
  const saveHistory = useCallback(() => {
    try {
      localStorage.setItem(
        HISTORY_KEY,
        JSON.stringify(commandHistoryRef.current.slice(-MAX_HISTORY)),
      );
    } catch {
      // Ignore storage errors
    }
  }, []);

  const formatValue = useCallback((value: unknown): string => {
    if (value === null || value === undefined) return "(nil)";
    if (typeof value === "object") return JSON.stringify(value, null, 2);
    return String(value);
  }, []);

  const executeCommand = useCallback(
    async (command: string, terminal: XTerm) => {
      if (!connectionId) {
        terminal.write("\r\n\x1b[31m(error) Not connected to Redis\x1b[0m");
        return;
      }

      const trimmedCommand = command.trim();
      if (!trimmedCommand) return;

      // Handle local commands
      const upperCmd = trimmedCommand.toUpperCase();
      if (upperCmd === "CLEAR") {
        terminal.clear();
        return;
      }
      if (upperCmd === "HELP" || upperCmd === "?") {
        terminal.writeln("");
        terminal.writeln("\x1b[36mRedis Console Commands:\x1b[0m");
        terminal.writeln("  \x1b[33mhelp\x1b[0m      - Show this help");
        terminal.writeln("  \x1b[33mclear\x1b[0m     - Clear the screen");
        terminal.writeln("  \x1b[33mhistory\x1b[0m   - Show command history");
        terminal.writeln("");
        terminal.writeln("\x1b[36mKeyboard Shortcuts:\x1b[0m");
        terminal.writeln("  \x1b[33mCtrl+L\x1b[0m    - Clear screen");
        terminal.writeln("  \x1b[33mCtrl+U\x1b[0m    - Clear current line");
        terminal.writeln("  \x1b[33m↑/↓\x1b[0m      - Navigate history");
        return;
      }
      if (upperCmd === "HISTORY") {
        terminal.writeln("");
        const history = commandHistoryRef.current;
        if (history.length === 0) {
          terminal.writeln("\x1b[90mNo history\x1b[0m");
        } else {
          history.slice(-20).forEach((cmd, i) => {
            terminal.writeln(`  \x1b[90m${i + 1})\x1b[0m ${cmd}`);
          });
        }
        return;
      }

      try {
        const result = await api.executeQuery(connectionId, trimmedCommand);

        let output: string;
        if (result.rows.length === 0) {
          output = "(empty list or set)";
        } else if (result.columns.length === 1 && result.rows.length === 1) {
          // Single value
          const value = result.rows[0][0];
          output = formatValue(value);
        } else if (result.columns.length === 1) {
          // List of values
          output = result.rows.map((row, i) => `${i + 1}) ${formatValue(row[0])}`).join("\r\n");
        } else {
          // Key-value pairs or table
          output = result.rows.map((row) => row.map(formatValue).join(" | ")).join("\r\n");
        }

        terminal.write("\r\n" + output);
      } catch (error) {
        terminal.write(`\r\n\x1b[31m(error) ${String(error)}\x1b[0m`);
      }
    },
    [connectionId, formatValue],
  );

  const writePrompt = useCallback((terminal: XTerm) => {
    terminal.write("\r\n" + PROMPT);
  }, []);

  const refreshLine = useCallback((terminal: XTerm) => {
    // Clear current line and rewrite
    terminal.write("\r\x1b[K" + PROMPT + inputBufferRef.current);
    // Move cursor to correct position
    const moveBack = inputBufferRef.current.length - cursorPosRef.current;
    if (moveBack > 0) {
      terminal.write(`\x1b[${moveBack}D`);
    }
  }, []);

  // Initialize terminal
  useEffect(() => {
    if (!containerRef.current || isInitializedRef.current) return;
    isInitializedRef.current = true;

    const initialTheme = buildTerminalTheme();

    const terminal = new XTerm({
      cursorBlink: true,
      cursorStyle: "bar",
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Cascadia Code", "Courier New", monospace',
      fontWeight: "normal",
      fontWeightBold: "bold",
      lineHeight: 1.2,
      letterSpacing: 0,
      theme: initialTheme,
      allowProposedApi: true,
      drawBoldTextInBrightColors: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);

    terminal.open(containerRef.current);

    // Delay fit to ensure renderer is ready
    requestAnimationFrame(() => {
      try {
        fitAddon.fit();
      } catch (e) {
        console.warn("Initial fit failed:", e);
      }
    });

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Welcome message
    terminal.writeln("\x1b[36m╔══════════════════════════════════════════════════════╗\x1b[0m");
    terminal.writeln(
      "\x1b[36m║\x1b[0m          \x1b[1;32mRedis Console\x1b[0m - \x1b[90mv2.0\x1b[0m                 \x1b[36m║\x1b[0m",
    );
    terminal.writeln("\x1b[36m╚══════════════════════════════════════════════════════╝\x1b[0m");
    terminal.writeln("");
    terminal.writeln("\x1b[90mType 'help' for available commands\x1b[0m");
    terminal.writeln("\x1b[90mUse ↑/↓ for history, Ctrl+L to clear\x1b[0m");
    terminal.write(PROMPT);

    // Handle user input
    terminal.onData((data) => {
      const code = data.charCodeAt(0);

      if (data === "\r") {
        // Enter key
        const command = inputBufferRef.current;
        if (command.trim()) {
          commandHistoryRef.current.push(command);
          saveHistory();
          historyIndexRef.current = -1;
        }
        executeCommand(command, terminal).then(() => {
          inputBufferRef.current = "";
          cursorPosRef.current = 0;
          writePrompt(terminal);
        });
      } else if (data === "\x7f" || data === "\b") {
        // Backspace
        if (cursorPosRef.current > 0) {
          inputBufferRef.current =
            inputBufferRef.current.slice(0, cursorPosRef.current - 1) +
            inputBufferRef.current.slice(cursorPosRef.current);
          cursorPosRef.current--;
          refreshLine(terminal);
        }
      } else if (data === "\t") {
        // Tab - insert a tab character
        inputBufferRef.current =
          inputBufferRef.current.slice(0, cursorPosRef.current) +
          "\t" +
          inputBufferRef.current.slice(cursorPosRef.current);
        cursorPosRef.current += 1;
        refreshLine(terminal);
      } else if (data === "\x1b[A") {
        // Arrow up
        if (commandHistoryRef.current.length > 0) {
          if (historyIndexRef.current === -1) {
            historyIndexRef.current = commandHistoryRef.current.length - 1;
          } else if (historyIndexRef.current > 0) {
            historyIndexRef.current--;
          }
          inputBufferRef.current = commandHistoryRef.current[historyIndexRef.current];
          cursorPosRef.current = inputBufferRef.current.length;
          refreshLine(terminal);
        }
      } else if (data === "\x1b[B") {
        // Arrow down
        if (historyIndexRef.current !== -1) {
          if (historyIndexRef.current < commandHistoryRef.current.length - 1) {
            historyIndexRef.current++;
            inputBufferRef.current = commandHistoryRef.current[historyIndexRef.current];
          } else {
            historyIndexRef.current = -1;
            inputBufferRef.current = "";
          }
          cursorPosRef.current = inputBufferRef.current.length;
          refreshLine(terminal);
        }
      } else if (data === "\x1b[C") {
        // Arrow right
        if (cursorPosRef.current < inputBufferRef.current.length) {
          cursorPosRef.current++;
          terminal.write(data);
        }
      } else if (data === "\x1b[D") {
        // Arrow left
        if (cursorPosRef.current > 0) {
          cursorPosRef.current--;
          terminal.write(data);
        }
      } else if (data === "\x1b[H" || data === "\x01") {
        // Home or Ctrl+A
        if (cursorPosRef.current > 0) {
          terminal.write(`\x1b[${cursorPosRef.current}D`);
          cursorPosRef.current = 0;
        }
      } else if (data === "\x1b[F" || data === "\x05") {
        // End or Ctrl+E
        const moveRight = inputBufferRef.current.length - cursorPosRef.current;
        if (moveRight > 0) {
          terminal.write(`\x1b[${moveRight}C`);
          cursorPosRef.current = inputBufferRef.current.length;
        }
      } else if (data === "\x15") {
        // Ctrl+U - clear line
        inputBufferRef.current = "";
        cursorPosRef.current = 0;
        refreshLine(terminal);
      } else if (data === "\x0c") {
        // Ctrl+L - clear screen
        terminal.clear();
        refreshLine(terminal);
      } else if (data === "\x03") {
        // Ctrl+C - cancel current input
        terminal.write("^C");
        inputBufferRef.current = "";
        cursorPosRef.current = 0;
        writePrompt(terminal);
      } else if (code >= 32) {
        // Printable characters
        inputBufferRef.current =
          inputBufferRef.current.slice(0, cursorPosRef.current) +
          data +
          inputBufferRef.current.slice(cursorPosRef.current);
        cursorPosRef.current += data.length;
        refreshLine(terminal);
      }
    });

    // Handle window resize
    const handleResize = () => {
      if (fitAddonRef.current && terminalRef.current && isInitializedRef.current) {
        requestAnimationFrame(() => {
          try {
            fitAddonRef.current?.fit();
          } catch (e) {
            // Ignore resize errors when renderer is not ready
          }
        });
      }
    };

    window.addEventListener("resize", handleResize);

    // ResizeObserver for container
    const resizeObserver = new ResizeObserver(() => {
      if (fitAddonRef.current && terminalRef.current && isInitializedRef.current) {
        requestAnimationFrame(() => {
          try {
            fitAddonRef.current?.fit();
          } catch (e) {
            // Ignore resize errors when renderer is not ready
          }
        });
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      isInitializedRef.current = false;
    };
  }, [
    executeCommand,
    refreshLine,
    writePrompt,
    saveHistory,
  ]);

  // Update theme when it changes
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.options.theme = buildTerminalTheme();
    }
  }, [activeThemeId]);

  // Focus terminal when visible
  useEffect(() => {
    if (fitAddonRef.current && terminalRef.current && isInitializedRef.current) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          try {
            fitAddonRef.current?.fit();
          } catch (e) {
            // Ignore fit errors when renderer is not ready
          }
          terminalRef.current?.focus();
        });
      });
    }
  }, []);

  if (!connectionId) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <p>Connect to Redis to use the console</p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" style={{ padding: "8px" }} />


    </div>
  );
});
