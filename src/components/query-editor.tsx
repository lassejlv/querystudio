import { useState, useEffect, useRef, useCallback, memo } from "react";
import { motion } from "framer-motion";
import {
  Play,
  Loader2,
  Bug,
  GripHorizontal,
  History,
  Check,
  X,
  Trash2,
  TableIcon,
  Braces,
} from "lucide-react";
import Editor, { OnMount } from "@monaco-editor/react";
import { RedisConsole } from "@/components/redis-console";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useConnectionStore, useAIQueryStore, useQueryHistoryStore } from "@/lib/store";
import { REDIS_COMMANDS } from "@/lib/redis-commands";
import { useLayoutStore } from "@/lib/layout-store";
import { useShallow } from "zustand/react/shallow";
import { useStatusBarStore } from "@/components/status-bar";
import { useExecuteQuery, useAllTableColumns } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import type { QueryResult } from "@/lib/types";
import type { editor } from "monaco-editor";

const MIN_EDITOR_HEIGHT = 100;
const MAX_EDITOR_HEIGHT = 600;
const DEFAULT_EDITOR_HEIGHT = 200;
const EDITOR_HEIGHT_KEY = "querystudio_editor_height";

import type { TabContentProps } from "@/lib/tab-sdk";

interface QueryEditorProps extends TabContentProps {}

export const QueryEditor = memo(function QueryEditor({
  tabId,
  paneId,
  connectionId: _connectionId,
}: QueryEditorProps) {
  const connection = useConnectionStore((s) => s.getActiveConnection());
  const activeConnectionId = useConnectionStore((s) => s.activeConnectionId);
  const connectionId = activeConnectionId ?? null;
  const tables = useConnectionStore((s) => s.tables);
  const isRedis = connection?.db_type === "redis";
  const isMongodb = connection?.db_type === "mongodb";

  // Fetch columns for all tables (for autocomplete)
  const { data: allColumns } = useAllTableColumns(connectionId, tables);

  // Layout store - use shallow comparison to only get the specific tab data we need
  const tabData = useLayoutStore(
    useShallow((s) => {
      const panes = s.panes[connectionId ?? ""] || {};
      const pane = panes[paneId];
      if (!pane || pane.type !== "leaf") return null;
      const tab = pane.tabs.find((t) => t.id === tabId);
      if (!tab) return null;
      return {
        queryContent: tab.queryContent ?? "",
        queryResults: tab.queryResults,
      };
    }),
  );
  const updateTab = useLayoutStore((s) => s.updateTab);

  // Get initial state from tab data
  const initialState = {
    query: tabData?.queryContent ?? "",
    results: tabData?.queryResults,
  };

  // Query history (still per-connection for history feature)
  const addQueryToHistory = useQueryHistoryStore((s) => s.addQuery);
  const getHistory = useQueryHistoryStore((s) => s.getHistory);
  const clearHistory = useQueryHistoryStore((s) => s.clearHistory);

  const [query, setQuery] = useState(initialState.query);
  const [results, setResults] = useState<QueryResult[]>(initialState.results?.results ?? []);
  const [error, setError] = useState<string | null>(initialState.results?.error ?? null);
  const [executionTime, setExecutionTime] = useState<number | null>(
    initialState.results?.executionTime ?? null,
  );
  const [viewMode, setViewMode] = useState<"table" | "json">("table");
  const [editorHeight, setEditorHeight] = useState(() => {
    const saved = localStorage.getItem(EDITOR_HEIGHT_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_EDITOR_HEIGHT;
  });
  const [isResizing, setIsResizing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import("monaco-editor") | null>(null);
  const completionProviderRef = useRef<{ dispose: () => void } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const executeHandlerRef = useRef<() => void>(() => {});

  // AI Query store for communication with AI chat
  const pendingSql = useAIQueryStore((s) => s.pendingSql);
  const clearPendingSql = useAIQueryStore((s) => s.clearPendingSql);
  const requestDebug = useAIQueryStore((s) => s.requestDebug);
  const setAiPanelOpen = useAIQueryStore((s) => s.setAiPanelOpen);

  // Status bar store for cursor position and query results
  const setQueryResult = useStatusBarStore((s) => s.setQueryResult);
  const setCursorPosition = useStatusBarStore((s) => s.setCursorPosition);

  // Clear cursor position when component unmounts (switching away from query tab)
  useEffect(() => {
    return () => {
      setCursorPosition(null);
    };
  }, [setCursorPosition]);

  const executeQueryMutation = useExecuteQuery(connectionId);

  // Load query content and results from tab when tab changes
  // Note: tabData is used here but we only want to run this on tab switch,
  // not on every content change to prevent circular updates.
  useEffect(() => {
    if (connectionId && paneId && tabData) {
      const savedQuery = tabData.queryContent;
      setQuery(savedQuery);
      if (editorRef.current) {
        editorRef.current.setValue(savedQuery);
      }
      // Restore results from layout store
      if (tabData.queryResults) {
        setResults(tabData.queryResults.results ?? []);
        setError(tabData.queryResults.error ?? null);
        setExecutionTime(tabData.queryResults.executionTime ?? null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionId, tabId, paneId]);

  // Save query content to tab when it changes (debounced to reduce store updates)
  useEffect(() => {
    if (!connectionId || !paneId) return;

    const timeoutId = setTimeout(() => {
      updateTab(connectionId, paneId, tabId, { queryContent: query });
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [query, connectionId, paneId, tabId, updateTab]);

  // Keyboard shortcut for history (Cmd+Shift+H / Ctrl+Shift+H)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "h") {
        e.preventDefault();
        setHistoryOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Handle pending SQL from AI chat - update query state even if editor not mounted
  useEffect(() => {
    if (pendingSql) {
      const currentValue = query;
      const separator = currentValue.trim() ? "\n\n" : "";
      const newValue = currentValue + separator + pendingSql;
      setQuery(newValue);

      // Also update editor if mounted
      if (editorRef.current) {
        const editor = editorRef.current;
        const model = editor.getModel();
        if (model) {
          model.setValue(newValue);
          const lineCount = model.getLineCount();
          const lastLineLength = model.getLineLength(lineCount);
          editor.setPosition({
            lineNumber: lineCount,
            column: lastLineLength + 1,
          });
          editor.focus();
        }
      }
      clearPendingSql();
    }
  }, [pendingSql, clearPendingSql, query]);

  // Resize handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newHeight = e.clientY - containerRect.top;
      const clampedHeight = Math.min(MAX_EDITOR_HEIGHT, Math.max(MIN_EDITOR_HEIGHT, newHeight));
      setEditorHeight(clampedHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      // Save height to localStorage when done resizing
      localStorage.setItem(EDITOR_HEIGHT_KEY, editorHeight.toString());
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, editorHeight]);

  // Update table/column completions when tables change
  useEffect(() => {
    if (!monacoRef.current || !tables.length) return;
    // Monaco will use the provider registered in handleEditorMount
    // which reads from tables state
  }, [tables]);

  // Split query into individual statements
  const splitQueries = (input: string): string[] => {
    if (isRedis) {
      // For Redis, split by newlines (each line is a command)
      return input
        .split("\n")
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith("#") && !s.startsWith("//"));
    }
    return input
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  };

  const handleExecute = async () => {
    if (!query.trim() || !connectionId) return;

    setError(null);
    setResults([]);
    setExecutionTime(null);

    const statements = splitQueries(query);

    if (statements.length === 0) {
      setError(isRedis ? "No valid Redis commands found" : "No valid SQL statements found");
      return;
    }

    const allResults: QueryResult[] = [];
    const startTime = performance.now();

    try {
      for (const statement of statements) {
        const data = await executeQueryMutation.mutateAsync(statement);
        allResults.push(data);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const totalRows = allResults.reduce((sum, r) => sum + r.row_count, 0);
      setExecutionTime(totalTime);
      setResults(allResults);
      // Update status bar
      setQueryResult(totalTime, totalRows, true);
      // Save results to layout store for persistence
      updateTab(connectionId, paneId, tabId, {
        queryResults: {
          results: allResults,
          error: null,
          executionTime: totalTime,
        },
      });
      // Add to query history
      addQueryToHistory(connectionId, {
        query: query.trim(),
        success: true,
        rowCount: totalRows,
      });
    } catch (err) {
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      setExecutionTime(totalTime);
      const errorMessage = String(err);
      setError(errorMessage);
      // Update status bar with error
      setQueryResult(totalTime, 0, false);
      // Show partial results if any succeeded
      if (allResults.length > 0) {
        setResults(allResults);
      }
      // Save error state to layout store
      updateTab(connectionId, paneId, tabId, {
        queryResults: {
          results: allResults,
          error: errorMessage,
          executionTime: totalTime,
        },
      });
      // Add failed query to history
      addQueryToHistory(connectionId, {
        query: query.trim(),
        success: false,
        error: errorMessage,
      });
    }
  };

  // Keep execute handler ref updated to avoid stale closure in Monaco command
  executeHandlerRef.current = handleExecute;

  const handleDebugWithAssistant = () => {
    if (query && error) {
      requestDebug(query, error);
      setAiPanelOpen(true);
    }
  };

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Track cursor position for status bar
    const updateCursorPosition = () => {
      const position = editor.getPosition();
      if (position) {
        setCursorPosition({
          line: position.lineNumber,
          column: position.column,
        });
      }
    };

    // Set initial cursor position
    updateCursorPosition();

    // Listen for cursor position changes
    editor.onDidChangeCursorPosition(updateCursorPosition);

    // Add Cmd+Enter / Ctrl+Enter keybinding (uses ref to avoid stale closure)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      executeHandlerRef.current();
    });

    // Dispose of previous completion provider if it exists
    if (completionProviderRef.current) {
      completionProviderRef.current.dispose();
    }

    // Configure language completions based on database type
    const language = isRedis ? "plaintext" : "sql";
    completionProviderRef.current = monaco.languages.registerCompletionItemProvider(language, {
      triggerCharacters: isRedis ? [' '] : [],
      provideCompletionItems: (model: editor.ITextModel, position: any) => {
        const wordUntilPosition = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: wordUntilPosition.startColumn,
          endColumn: wordUntilPosition.endColumn,
        };

        const keywords = isRedis
          ? REDIS_COMMANDS.map((cmd) => ({
              label: cmd.name,
              kind: monaco.languages.CompletionItemKind.Function,
              insertText: cmd.args ? `${cmd.name} ${cmd.args}` : cmd.name,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              detail: `${cmd.name} - ${cmd.complexity}`,
              documentation: {
                value: `**${cmd.name}**\n\n${cmd.summary}\n\n**Complexity:** ${cmd.complexity}\n\n**Arguments:** ${cmd.args || 'None'}`,
                isTrusted: true,
              },
              range,
              sortText: cmd.name,
            }))
          : [
              "SELECT",
              "FROM",
              "WHERE",
              "AND",
              "OR",
              "INSERT",
              "INTO",
              "VALUES",
              "UPDATE",
              "SET",
              "DELETE",
              "CREATE",
              "TABLE",
              "DROP",
              "ALTER",
              "JOIN",
              "LEFT",
              "RIGHT",
              "INNER",
              "OUTER",
              "ON",
              "GROUP",
              "BY",
              "ORDER",
              "ASC",
              "DESC",
              "LIMIT",
              "OFFSET",
              "HAVING",
              "DISTINCT",
              "COUNT",
              "SUM",
              "AVG",
              "MIN",
              "MAX",
              "AS",
              "NULL",
              "NOT",
              "IN",
              "LIKE",
              "BETWEEN",
              "EXISTS",
              "CASE",
              "WHEN",
              "THEN",
              "ELSE",
              "END",
              "PRIMARY",
              "KEY",
              "FOREIGN",
              "REFERENCES",
              "UNIQUE",
              "INDEX",
              "BEGIN",
              "COMMIT",
              "ROLLBACK",
              "TRANSACTION",
            ].map((keyword) => ({
              label: keyword,
              kind: monaco.languages.CompletionItemKind.Keyword,
              insertText: keyword,
              range,
            }));

        // Add table names from connection
        const tableItems = tables.map((table) => ({
          label: table.name,
          kind: monaco.languages.CompletionItemKind.Class,
          insertText: table.schema === "public" ? table.name : `${table.schema}.${table.name}`,
          detail: `${table.schema}.${table.name} (${table.row_count} rows)`,
        }));

        // Add schema.table format for non-public schemas
        const schemaTableItems = tables
          .filter((t) => t.schema !== "public")
          .map((table) => ({
            label: `${table.schema}.${table.name}`,
            kind: monaco.languages.CompletionItemKind.Class,
            insertText: `${table.schema}.${table.name}`,
            detail: `${table.row_count} rows`,
          }));

        // Add column names from all tables (deduplicated)
        const columnItems: {
          label: string;
          kind: typeof monaco.languages.CompletionItemKind.Field;
          insertText: string;
          detail: string;
        }[] = [];
        const seenPrefixedColumns = new Set<string>();
        const seenColumns = new Set<string>();

        if (allColumns) {
          for (const [tableKey, columns] of Object.entries(allColumns)) {
            for (const col of columns) {
              // Add column with table prefix (table.column) - deduplicated
              const prefixedLabel = `${col.tableName}.${col.name}`;
              if (!seenPrefixedColumns.has(prefixedLabel)) {
                seenPrefixedColumns.add(prefixedLabel);
                columnItems.push({
                  label: prefixedLabel,
                  kind: monaco.languages.CompletionItemKind.Field,
                  insertText: prefixedLabel,
                  detail: `${col.dataType} (${tableKey})`,
                });
              }

              // Add column without prefix (only once per unique column name)
              if (!seenColumns.has(col.name)) {
                seenColumns.add(col.name);
                columnItems.push({
                  label: col.name,
                  kind: monaco.languages.CompletionItemKind.Field,
                  insertText: col.name,
                  detail: `${col.dataType}`,
                });
              }
            }
          }
        }

        return {
          suggestions: [...keywords, ...tableItems, ...schemaTableItems, ...columnItems],
        };
      },
    });
  };

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return "NULL";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  if (!connectionId) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <p>Connect to a database to run queries</p>
      </div>
    );
  }

  if (isMongodb) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
        <p className="text-lg font-medium">Query Editor Not Available</p>
        <p className="mt-2 text-sm">
          MongoDB uses its own query language. Use the Documents tab to browse collections.
        </p>
      </div>
    );
  }

  if (isRedis) {
    return <RedisConsole tabId={tabId} paneId={paneId} connectionId={connectionId} />;
  }

  return (
    <div className="flex h-full flex-col" ref={containerRef}>
      <div className="border-b border-border">
        <div style={{ height: editorHeight }} className="w-full">
          <Editor
            height="100%"
            defaultLanguage={isRedis ? "plaintext" : "sql"}
            language={isRedis ? "plaintext" : "sql"}
            value={query}
            onChange={(value) => setQuery(value || "")}
            onMount={handleEditorMount}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              fontFamily: "JetBrains Mono, Menlo, Monaco, Consolas, monospace",
              lineNumbers: "on",
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              wordWrap: "on",
              padding: { top: 12, bottom: 12 },
              renderLineHighlight: "line",
              cursorBlinking: "smooth",
              smoothScrolling: true,
              contextmenu: true,
              folding: true,
              bracketPairColorization: { enabled: true },
              suggest: {
                showKeywords: true,
              },
            }}
          />
        </div>
        {/* Resize handle */}
        <div
          onMouseDown={handleMouseDown}
          className={cn(
            "flex h-3 cursor-row-resize items-center justify-center border-t border-border bg-card hover:bg-secondary transition-colors",
            isResizing && "bg-muted",
          )}
        >
          <GripHorizontal className="h-3 w-3 text-muted-foreground" />
        </div>
        <div className="flex items-center justify-between px-4 py-2 border-t border-border">
          <p className="text-xs text-muted-foreground">
            {isRedis
              ? "Enter Redis commands (one per line). Press Cmd+Enter to execute."
              : "Press Cmd+Enter (Ctrl+Enter) to execute"}
          </p>
          <div className="flex items-center gap-2">
            <Popover open={historyOpen} onOpenChange={setHistoryOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" title="Cmd+Shift+H">
                  <History className="mr-2 h-4 w-4" />
                  History
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-96 p-0" align="end">
                <div className="flex items-center justify-between border-b border-border px-3 py-2">
                  <h4 className="font-medium text-sm">Query History</h4>
                  {connectionId && getHistory(connectionId).length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        clearHistory(connectionId);
                      }}
                      className="h-7 px-2 text-muted-foreground hover:text-foreground"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <ScrollArea className="h-64">
                  {connectionId && getHistory(connectionId).length > 0 ? (
                    <div className="divide-y divide-border">
                      {getHistory(connectionId)
                        .slice(0, 50)
                        .map((entry, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              setQuery(entry.query);
                              if (editorRef.current) {
                                editorRef.current.setValue(entry.query);
                              }
                              setHistoryOpen(false);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-secondary transition-colors"
                          >
                            <div className="flex items-start gap-2">
                              {entry.success ? (
                                <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                              ) : (
                                <X className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-mono text-foreground truncate">
                                  {entry.query}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {new Date(entry.executedAt).toLocaleString()}
                                  {entry.success && entry.rowCount !== undefined && (
                                    <span className="ml-2">{entry.rowCount} rows</span>
                                  )}
                                </p>
                              </div>
                            </div>
                          </button>
                        ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                      No query history yet
                    </div>
                  )}
                </ScrollArea>
              </PopoverContent>
            </Popover>
            <Button
              onClick={handleExecute}
              disabled={executeQueryMutation.isPending || !query.trim()}
              size="sm"
            >
              {executeQueryMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Execute
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {error && (
          <div className="m-4 rounded-md border border-red-900 bg-red-950/50 p-4">
            <div className="flex items-start justify-between gap-4">
              <p className="text-sm text-red-400 flex-1">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDebugWithAssistant}
                className="shrink-0 border-red-800 text-red-400 hover:bg-red-950 hover:text-red-300"
              >
                <Bug className="mr-2 h-4 w-4" />
                Debug with AI
              </Button>
            </div>
          </div>
        )}

        {results.length > 0 && (
          <ScrollArea className="h-full">
            <motion.div
              key={results.length}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="min-w-max p-4 space-y-4"
            >
              <div className="flex items-center justify-between">
                {executionTime !== null && (
                  <div className="text-xs text-muted-foreground">
                    Executed in{" "}
                    {executionTime < 1000
                      ? `${executionTime.toFixed(1)}ms`
                      : `${(executionTime / 1000).toFixed(2)}s`}
                  </div>
                )}
                <div className="flex items-center gap-1 ml-auto">
                  <Button
                    variant={viewMode === "table" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("table")}
                    className="h-7 px-2"
                  >
                    <TableIcon className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant={viewMode === "json" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("json")}
                    className="h-7 px-2"
                  >
                    <Braces className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {viewMode === "json" ? (
                <pre className="text-xs font-mono text-foreground bg-card rounded-md p-4 overflow-auto">
                  {JSON.stringify(
                    results.map((result) => ({
                      columns: result.columns,
                      rows: result.rows.map((row) =>
                        Object.fromEntries(result.columns.map((col, i) => [col, row[i]])),
                      ),
                      row_count: result.row_count,
                    })),
                    null,
                    2,
                  )}
                </pre>
              ) : (
                <div className="space-y-6">
                  {results.map((result, resultIdx) => (
                    <div key={resultIdx}>
                      {results.length > 1 && (
                        <div className="mb-2 text-xs font-medium text-muted-foreground uppercase">
                          Query {resultIdx + 1}
                        </div>
                      )}
                      <div className="mb-2 text-sm text-muted-foreground">
                        {result.row_count} row
                        {result.row_count !== 1 ? "s" : ""} returned
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border hover:bg-transparent">
                            {result.columns.map((col: string) => (
                              <TableHead
                                key={col}
                                className="whitespace-nowrap border-r border-border last:border-r-0"
                              >
                                {col}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {result.rows.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={result.columns.length || 1}
                                className="h-24 text-center text-muted-foreground"
                              >
                                No results
                              </TableCell>
                            </TableRow>
                          ) : (
                            result.rows.map((row: unknown[], i: number) => (
                              <TableRow key={i} className="border-border hover:bg-card/50">
                                {row.map((cell: unknown, j: number) => {
                                  const isNull = cell === null;
                                  return (
                                    <TableCell
                                      key={j}
                                      className={cn(
                                        "max-w-xs truncate border-r border-border font-mono text-xs last:border-r-0",
                                        isNull && "text-muted-foreground italic",
                                      )}
                                      title={formatValue(cell)}
                                    >
                                      {formatValue(cell)}
                                    </TableCell>
                                  );
                                })}
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        )}

        {!error && results.length === 0 && (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <p>Execute a query to see results</p>
          </div>
        )}
      </div>
    </div>
  );
});
