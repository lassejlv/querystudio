import { useState, useEffect, memo, useMemo, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Key,
  ChevronLeft,
  ChevronRight,
  Plus,
  Copy,
  Trash2,
  RefreshCw,
  Search,
  Columns3,
  SlidersHorizontal,
  ArrowUpDown,
  X,
  Save,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
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
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { AddRowSheet } from "@/components/add-row-sheet";
import { AddRedisKeyDialog } from "@/components/add-redis-key-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { useQueryClient } from "@tanstack/react-query";
import { useConnectionStore, useAIQueryStore } from "@/lib/store";
import { quoteIdentifier, quoteTableRef } from "@/lib/utils";
import {
  useTableData,
  useTableColumns,
  useTableCount,
  useDeleteRow,
  useDeleteDocument,
  useUpdateRow,
  useUpdateDocument,
} from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { ColumnInfo } from "@/lib/types";
import type { TabContentProps } from "@/lib/tab-sdk";
import { useLayoutStore } from "@/lib/layout-store";
import { useStatusBarStore } from "@/components/status-bar";

const PAGE_SIZE = 100;

type DensityMode = "compact" | "comfortable" | "spacious";

interface TableViewerProps extends TabContentProps {}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function buildRowPreview(record: Record<string, unknown>): string {
  const limited: Record<string, unknown> = {};
  Object.entries(record)
    .slice(0, 8)
    .forEach(([key, value]) => {
      if (typeof value === "string" && value.length > 220) {
        limited[key] = `${value.slice(0, 220)}...`;
      } else {
        limited[key] = value;
      }
    });

  const content = JSON.stringify(limited, null, 2);
  if (content.length > 1800) {
    return `${content.slice(0, 1800)}\n...truncated`;
  }
  return content;
}

function getDensityCellPadding(density: DensityMode): string {
  if (density === "compact") return "py-1.5";
  if (density === "spacious") return "py-3";
  return "py-2";
}

function isBooleanType(dataType: string): boolean {
  const lower = dataType.toLowerCase();
  return lower === "boolean" || lower === "bool";
}

function isNumericType(dataType: string): boolean {
  const lower = dataType.toLowerCase();
  return (
    lower.includes("int") ||
    lower.includes("numeric") ||
    lower.includes("decimal") ||
    lower.includes("float") ||
    lower.includes("double") ||
    lower.includes("real")
  );
}

function isJsonType(dataType: string): boolean {
  const lower = dataType.toLowerCase();
  return lower === "json" || lower === "jsonb";
}

function shouldUseTextarea(dataType: string): boolean {
  const lower = dataType.toLowerCase();
  return (
    lower === "text" ||
    lower.includes("character varying") ||
    lower.includes("timestamp") ||
    lower.includes("date") ||
    lower.includes("time") ||
    isJsonType(dataType)
  );
}

function getInputType(dataType: string): string {
  const lower = dataType.toLowerCase();
  if (isNumericType(dataType)) return "number";
  if (lower.includes("date") && !lower.includes("time")) return "date";
  if (lower === "time") return "time";
  return "text";
}

export const TableViewer = memo(function TableViewer({
  tabId,
  paneId,
  connectionId: propsConnectionId,
}: TableViewerProps) {
  const connection = useConnectionStore((s) => s.getActiveConnection());
  const activeConnectionId = useConnectionStore((s) => s.activeConnectionId);
  const globalSelectedTable = useConnectionStore((s) => s.selectedTable);
  const aiPanelOpen = useAIQueryStore((s) => s.aiPanelOpen);
  const setSelectedRowsContext = useAIQueryStore((s) => s.setSelectedRowsContext);
  const clearSelectedRowsContext = useAIQueryStore((s) => s.clearSelectedRowsContext);
  const setLastDataRefreshAt = useStatusBarStore((s) => s.setLastDataRefreshAt);
  const setLastDataFetchDurationMs = useStatusBarStore((s) => s.setLastDataFetchDurationMs);
  const setHasUnsavedEdits = useStatusBarStore((s) => s.setHasUnsavedEdits);

  // Use connectionId from props or fall back to connection store
  const connectionId = propsConnectionId || activeConnectionId || "";

  // Get tableInfo from the tab's state in the layout store
  const pane = useLayoutStore((s) => s.panes[connectionId]?.[paneId]);
  const tab = pane?.type === "leaf" ? pane.tabs.find((t) => t.id === tabId) : null;
  const tableInfo = tab?.tableInfo;

  // Use tableInfo from tab if provided (for dedicated table tabs), otherwise use global selection
  const selectedTable = tableInfo || globalSelectedTable;
  const [page, setPage] = useState(0);
  const [rowSearch, setRowSearch] = useState("");
  const [density, setDensity] = useState<DensityMode>("comfortable");
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [selectedRowRaw, setSelectedRowRaw] = useState<unknown[] | null>(null);
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);
  const [editedForm, setEditedForm] = useState<Record<string, string>>({});
  const [originalForm, setOriginalForm] = useState<Record<string, string>>({});
  const [rowNullFields, setRowNullFields] = useState<Set<string>>(new Set());
  const [originalNullFields, setOriginalNullFields] = useState<Set<string>>(new Set());
  const [selectedOriginalRecord, setSelectedOriginalRecord] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [isSavingInline, setIsSavingInline] = useState(false);

  // Reset page when table changes
  useEffect(() => {
    setPage(0);
  }, [selectedTable?.schema, selectedTable?.name]);

  const [addRowOpen, setAddRowOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteRowData, setDeleteRowData] = useState<Record<string, unknown> | null>(null);
  const [addRedisKeyOpen, setAddRedisKeyOpen] = useState(false);
  const [isAddFormDirty, setIsAddFormDirty] = useState(false);
  const refreshStartRef = useRef<number | null>(null);

  const queryClient = useQueryClient();

  const {
    data: columns,
    isLoading: columnsLoading,
    isFetching: columnsFetching,
  } = useTableColumns(connectionId, selectedTable?.schema ?? null, selectedTable?.name ?? null);

  const {
    data: tableData,
    isLoading: dataLoading,
    isFetching: dataFetching,
  } = useTableData(
    connectionId,
    selectedTable?.schema ?? null,
    selectedTable?.name ?? null,
    PAGE_SIZE,
    page * PAGE_SIZE,
  );

  const { data: totalCount, isFetching: countFetching } = useTableCount(
    connectionId,
    selectedTable?.schema ?? null,
    selectedTable?.name ?? null,
  );

  const deleteRow = useDeleteRow(connectionId ?? "");
  const deleteDocument = useDeleteDocument(connectionId ?? "");
  const updateRow = useUpdateRow(connectionId ?? "");
  const updateDocument = useUpdateDocument(connectionId ?? "");
  const isMongoDB = connection?.db_type === "mongodb";

  const rowToRecord = useCallback((row: unknown[], cols: ColumnInfo[]): Record<string, unknown> => {
    const record: Record<string, unknown> = {};
    cols.forEach((col, i) => {
      record[col.name] = row[i];
    });
    return record;
  }, []);

  const allColumns = columns ?? [];
  const visibleColumns = useMemo(
    () => allColumns.filter((col) => !hiddenColumns.has(col.name)),
    [allColumns, hiddenColumns],
  );
  const visibleColumnIndexes = useMemo(() => {
    const indexByName = new Map<string, number>();
    allColumns.forEach((col, index) => {
      indexByName.set(col.name, index);
    });
    return visibleColumns
      .map((col) => indexByName.get(col.name) ?? -1)
      .filter((index) => index >= 0);
  }, [allColumns, visibleColumns]);

  useEffect(() => {
    setHiddenColumns((prev) => {
      if (!allColumns.length) return prev;
      const validNames = new Set(allColumns.map((col) => col.name));
      let changed = false;
      const next = new Set<string>();
      prev.forEach((name) => {
        if (validNames.has(name)) {
          next.add(name);
        } else {
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [allColumns]);

  const filteredRows = useMemo(() => {
    const rows = tableData?.rows ?? [];
    const query = rowSearch.trim().toLowerCase();
    if (!query) return rows;

    return rows.filter((row) =>
      visibleColumnIndexes.some((index) =>
        formatCellValue(row[index]).toLowerCase().includes(query),
      ),
    );
  }, [tableData?.rows, rowSearch, visibleColumnIndexes]);

  const selectedRecord = useMemo(() => {
    if (!selectedRowRaw || !allColumns.length) return null;
    return rowToRecord(selectedRowRaw, allColumns);
  }, [selectedRowRaw, allColumns, rowToRecord]);

  const selectedFieldEntries = useMemo(() => {
    if (!selectedRecord) return [];
    return allColumns
      .map((col) => ({
        name: col.name,
        value: selectedRecord[col.name],
        isPrimaryKey: col.is_primary_key,
      }))
      .sort((a, b) => Number(b.isPrimaryKey) - Number(a.isPrimaryKey));
  }, [allColumns, selectedRecord]);

  const hasInlineChanges = useMemo(() => {
    if (!selectedRowRaw) return false;
    for (const col of allColumns) {
      const name = col.name;
      const nowNull = rowNullFields.has(name);
      const wasNull = originalNullFields.has(name);
      if (nowNull !== wasNull) return true;
      if (!nowNull && (editedForm[name] ?? "") !== (originalForm[name] ?? "")) return true;
    }
    return false;
  }, [selectedRowRaw, allColumns, rowNullFields, originalNullFields, editedForm, originalForm]);

  const totalPages = totalCount ? Math.ceil(totalCount / PAGE_SIZE) : 0;
  const isLoading = columnsLoading || dataLoading;
  const isRefreshing = columnsFetching || dataFetching || countFetching;
  const visibleRows = filteredRows.length;
  const normalizedTotalCount = typeof totalCount === "number" ? totalCount : null;
  const hasTotalCount = normalizedTotalCount !== null;
  const rangeStart = hasTotalCount && normalizedTotalCount > 0 ? page * PAGE_SIZE + 1 : 0;
  const rangeEnd = hasTotalCount
    ? Math.min((page + 1) * PAGE_SIZE, normalizedTotalCount)
    : page * PAGE_SIZE + visibleRows;

  useEffect(() => {
    const hasDirtyForm = (addRowOpen && isAddFormDirty) || hasInlineChanges;
    setHasUnsavedEdits(hasDirtyForm);
  }, [addRowOpen, isAddFormDirty, hasInlineChanges, setHasUnsavedEdits]);

  useEffect(() => {
    if (isRefreshing && refreshStartRef.current === null) {
      refreshStartRef.current = performance.now();
      return;
    }
    if (!isRefreshing && refreshStartRef.current !== null) {
      const durationMs = performance.now() - refreshStartRef.current;
      refreshStartRef.current = null;
      setLastDataFetchDurationMs(durationMs);
      setLastDataRefreshAt(Date.now());
    }
  }, [isRefreshing, setLastDataFetchDurationMs, setLastDataRefreshAt]);

  useEffect(() => {
    return () => {
      clearSelectedRowsContext();
      setHasUnsavedEdits(false);
    };
  }, [clearSelectedRowsContext, setHasUnsavedEdits]);

  useEffect(() => {
    setSelectedRowRaw(null);
    setSelectedRowKey(null);
    setEditedForm({});
    setOriginalForm({});
    setRowNullFields(new Set());
    setOriginalNullFields(new Set());
    setSelectedOriginalRecord(null);
    clearSelectedRowsContext();
  }, [selectedTable?.schema, selectedTable?.name, page, clearSelectedRowsContext]);

  useEffect(() => {
    if (!aiPanelOpen || !selectedRecord || !selectedTable) {
      clearSelectedRowsContext();
      return;
    }
    const timeout = window.setTimeout(() => {
      setSelectedRowsContext({
        schema: selectedTable.schema,
        table: selectedTable.name,
        count: 1,
        preview: buildRowPreview(selectedRecord),
      });
    }, 120);
    return () => window.clearTimeout(timeout);
  }, [
    aiPanelOpen,
    selectedRecord,
    selectedTable,
    setSelectedRowsContext,
    clearSelectedRowsContext,
  ]);

  useEffect(() => {
    if (!selectedRowRaw) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setSelectedRowRaw(null);
      setSelectedRowKey(null);
      setEditedForm({});
      setOriginalForm({});
      setRowNullFields(new Set());
      setOriginalNullFields(new Set());
      setSelectedOriginalRecord(null);
      clearSelectedRowsContext();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedRowRaw, clearSelectedRowsContext]);

  if (!selectedTable) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="text-lg">Select a table to view its data</p>
          <p className="text-sm text-muted-foreground">Choose a table from the sidebar</p>
        </div>
      </div>
    );
  }

  const handleRefresh = () => {
    if (!connectionId || !selectedTable) return;

    setLastDataRefreshAt(Date.now());
    queryClient.invalidateQueries({
      queryKey: ["columns", connectionId, selectedTable.schema, selectedTable.name],
    });
    queryClient.invalidateQueries({
      queryKey: ["tableData", connectionId, selectedTable.schema, selectedTable.name],
    });
    queryClient.invalidateQueries({
      queryKey: ["tableCount", connectionId, selectedTable.schema, selectedTable.name],
    });
  };

  const handleCopyCell = async (value: unknown) => {
    const text = formatCellValue(value);
    try {
      await navigator.clipboard.writeText(text === "NULL" ? "" : text);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleCopySelectedRow = async () => {
    if (!selectedRecord) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(selectedRecord, null, 2));
      toast.success("Row JSON copied");
    } catch {
      toast.error("Failed to copy row");
    }
  };

  const clearSelectedRow = () => {
    setSelectedRowRaw(null);
    setSelectedRowKey(null);
    setEditedForm({});
    setOriginalForm({});
    setRowNullFields(new Set());
    setOriginalNullFields(new Set());
    setSelectedOriginalRecord(null);
    clearSelectedRowsContext();
  };

  const handleSelectRow = (row: unknown[], rowKey: string) => {
    if (selectedRowKey === rowKey) {
      clearSelectedRow();
      return;
    }
    if (!allColumns.length) return;
    const record = rowToRecord(row, allColumns);
    const form: Record<string, string> = {};
    const nulls = new Set<string>();

    allColumns.forEach((col) => {
      const value = record[col.name];
      if (value === null || value === undefined) {
        form[col.name] = "";
        if (col.is_nullable) {
          nulls.add(col.name);
        }
      } else if (typeof value === "object") {
        form[col.name] = JSON.stringify(value, null, 2);
      } else {
        form[col.name] = String(value);
      }
    });

    setSelectedRowRaw(row);
    setSelectedRowKey(rowKey);
    setEditedForm(form);
    setOriginalForm(form);
    setRowNullFields(new Set(nulls));
    setOriginalNullFields(new Set(nulls));
    setSelectedOriginalRecord(record);
  };

  const handleInlineFieldChange = (fieldName: string, value: string) => {
    setEditedForm((prev) => ({ ...prev, [fieldName]: value }));
    if (rowNullFields.has(fieldName) && value !== "") {
      setRowNullFields((prev) => {
        const next = new Set(prev);
        next.delete(fieldName);
        return next;
      });
    }
  };

  const toggleInlineNull = (fieldName: string, isNull: boolean) => {
    setRowNullFields((prev) => {
      const next = new Set(prev);
      if (isNull) {
        next.add(fieldName);
      } else {
        next.delete(fieldName);
      }
      return next;
    });
  };

  const handleDeleteRowClick = (row: unknown[]) => {
    if (!allColumns.length) return;
    const record = rowToRecord(row, allColumns);
    setDeleteRowData(record);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteRowData || !allColumns.length || !connectionId) return;

    // MongoDB uses document-based deletion
    if (isMongoDB) {
      const docId = deleteRowData["_id"];
      if (!docId) {
        toast.error("Cannot delete: document has no _id");
        setDeleteDialogOpen(false);
        return;
      }

      const filter = JSON.stringify({ _id: docId });

      try {
        await deleteDocument.mutateAsync({
          schema: selectedTable.schema,
          collection: selectedTable.name,
          filter,
        });
        toast.success("Document deleted successfully");
        setDeleteDialogOpen(false);
        setDeleteRowData(null);
        setSelectedRowRaw(null);
        setSelectedRowKey(null);
        clearSelectedRowsContext();
      } catch (error) {
        toast.error(`Delete failed: ${error}`);
      }
      return;
    }

    const pkColumns = allColumns.filter((c) => c.is_primary_key);
    if (pkColumns.length === 0) {
      toast.error("Cannot delete: table has no primary key");
      setDeleteDialogOpen(false);
      return;
    }

    const dbType = connection?.db_type ?? "postgres";
    const whereClauses = pkColumns.map((col) => {
      const value = deleteRowData[col.name];
      if (value === null || value === undefined) {
        return `${quoteIdentifier(col.name, dbType)} IS NULL`;
      }
      return `${quoteIdentifier(col.name, dbType)} = ${formatValueForSQL(
        String(value),
        col.data_type,
        col.is_nullable,
      )}`;
    });

    const query = `DELETE FROM ${quoteTableRef(selectedTable.schema, selectedTable.name, dbType)} WHERE ${whereClauses.join(" AND ")}`;

    try {
      await deleteRow.mutateAsync({
        schema: selectedTable.schema,
        table: selectedTable.name,
        query,
      });
      toast.success("Row deleted successfully");
      setDeleteDialogOpen(false);
      setDeleteRowData(null);
      setSelectedRowRaw(null);
      setSelectedRowKey(null);
      clearSelectedRowsContext();
    } catch (error) {
      toast.error(`Delete failed: ${error}`);
    }
  };

  const formatValueForSQL = (value: string, dataType: string, isNullable: boolean): string => {
    const lowerType = dataType.toLowerCase();

    if (isNumericType(dataType)) {
      return value || "0";
    }

    if (isBooleanType(dataType)) {
      return value.toLowerCase() === "true" ? "true" : "false";
    }

    if (isJsonType(dataType)) {
      try {
        JSON.parse(value);
      } catch {
        // Keep raw string value if invalid JSON; database will validate if needed.
      }
      return `'${value.replace(/'/g, "''")}'`;
    }

    if (
      lowerType.includes("timestamp") ||
      lowerType.includes("date") ||
      lowerType.includes("time")
    ) {
      if (value === "" && isNullable) {
        return "NULL";
      }
      return `'${value.replace(/'/g, "''")}'`;
    }

    return `'${value.replace(/'/g, "''")}'`;
  };

  const parseDocumentFieldValue = (value: string, dataType: string, isNull: boolean): unknown => {
    if (isNull) return null;
    if (isBooleanType(dataType)) return value.toLowerCase() === "true";
    if (isNumericType(dataType)) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : value;
    }
    if (isJsonType(dataType)) {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  };

  const handleSaveInlineRow = async () => {
    if (!selectedTable || !selectedOriginalRecord || !allColumns.length || !connectionId) return;
    if (!hasInlineChanges) return;

    if (isMongoDB) {
      const docId = selectedOriginalRecord["_id"];
      if (!docId) {
        toast.error("Cannot update: document has no _id");
        return;
      }

      const nextDocument: Record<string, unknown> = {};
      allColumns.forEach((col) => {
        if (col.name === "_id") return;
        nextDocument[col.name] = parseDocumentFieldValue(
          editedForm[col.name] ?? "",
          col.data_type,
          rowNullFields.has(col.name),
        );
      });

      setIsSavingInline(true);
      try {
        await updateDocument.mutateAsync({
          schema: selectedTable.schema,
          collection: selectedTable.name,
          filter: JSON.stringify({ _id: docId }),
          update: JSON.stringify(nextDocument),
        });
        toast.success("Document updated");
        handleRefresh();
        clearSelectedRow();
      } catch (error) {
        toast.error(`Update failed: ${error}`);
      } finally {
        setIsSavingInline(false);
      }
      return;
    }

    const pkColumns = allColumns.filter((c) => c.is_primary_key);
    if (pkColumns.length === 0) {
      toast.error("Cannot update: table has no primary key");
      return;
    }

    const setClauses: string[] = [];
    allColumns.forEach((col) => {
      const name = col.name;
      const nowNull = rowNullFields.has(name);
      const wasNull = originalNullFields.has(name);
      const newValue = editedForm[name] ?? "";
      const oldValue = originalForm[name] ?? "";

      if (nowNull === wasNull && (nowNull || newValue === oldValue)) {
        return;
      }

      if (nowNull) {
        setClauses.push(`${quoteIdentifier(name, connection?.db_type ?? "postgres")} = NULL`);
        return;
      }

      setClauses.push(
        `${quoteIdentifier(name, connection?.db_type ?? "postgres")} = ${formatValueForSQL(
          newValue,
          col.data_type,
          col.is_nullable,
        )}`,
      );
    });

    if (!setClauses.length) {
      toast.info("No changes to save");
      return;
    }

    const dbType = connection?.db_type ?? "postgres";
    const whereClauses = pkColumns.map((col) => {
      const value = selectedOriginalRecord[col.name];
      if (value === null || value === undefined) {
        return `${quoteIdentifier(col.name, dbType)} IS NULL`;
      }
      return `${quoteIdentifier(col.name, dbType)} = ${formatValueForSQL(
        String(value),
        col.data_type,
        col.is_nullable,
      )}`;
    });

    const query = `UPDATE ${quoteTableRef(selectedTable.schema, selectedTable.name, dbType)} SET ${setClauses.join(", ")} WHERE ${whereClauses.join(" AND ")}`;

    setIsSavingInline(true);
    try {
      await updateRow.mutateAsync({
        schema: selectedTable.schema,
        table: selectedTable.name,
        query,
      });
      toast.success("Row updated");
      handleRefresh();
      clearSelectedRow();
    } catch (error) {
      toast.error(`Update failed: ${error}`);
    } finally {
      setIsSavingInline(false);
    }
  };

  const toggleColumnVisibility = (columnName: string, checked: boolean | "indeterminate") => {
    const isChecked = checked === true;
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (isChecked) {
        next.delete(columnName);
        return next;
      }

      // Keep at least one visible column.
      const visibleCount = (allColumns.length || 0) - next.size;
      if (visibleCount <= 1) return prev;
      next.add(columnName);
      return next;
    });
  };

  const renderedRows = useMemo(
    () =>
      filteredRows.map((row) => visibleColumnIndexes.map((index) => formatCellValue(row[index]))),
    [filteredRows, visibleColumnIndexes],
  );

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="border-b border-border/55 bg-gradient-to-b from-background to-card/20 px-3 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-lg font-semibold text-foreground">
                {selectedTable.schema}.{selectedTable.name}
              </h2>
              <Badge variant="secondary" className="h-6 rounded-full px-2.5 text-[11px]">
                {hasTotalCount ? `${normalizedTotalCount.toLocaleString()} rows` : "Rows"}
              </Badge>
              {selectedRowRaw && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearSelectedRow}
                  className="h-6 rounded-full border-border/60 px-2 text-[11px]"
                >
                  <X className="mr-1 h-3 w-3" />
                  Exit row
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {rangeEnd > 0
                ? `${rangeStart.toLocaleString()}-${rangeEnd.toLocaleString()} visible`
                : "No rows visible"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/80" />
              <Input
                value={rowSearch}
                onChange={(e) => setRowSearch(e.target.value)}
                placeholder="Filter visible rows..."
                className="h-9 rounded-xl border-border/60 bg-background/60 pl-8 text-xs shadow-none"
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-xl border-border/60 bg-background/60 px-3"
                >
                  <SlidersHorizontal className="mr-1.5 h-4 w-4" />
                  Density
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel>Row Density</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup
                  value={density}
                  onValueChange={(value) => setDensity(value as DensityMode)}
                >
                  <DropdownMenuRadioItem value="compact">Compact</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="comfortable">Comfortable</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="spacious">Spacious</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-xl border-border/60 bg-background/60 px-3"
                >
                  <Columns3 className="mr-1.5 h-4 w-4" />
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Visible Columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {allColumns.map((col) => (
                  <DropdownMenuCheckboxItem
                    key={col.name}
                    checked={!hiddenColumns.has(col.name)}
                    onCheckedChange={(checked) => toggleColumnVisibility(col.name, checked)}
                  >
                    {col.name}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="h-9 rounded-xl border-border/60 bg-background/60 px-3"
            >
              <RefreshCw className={cn("mr-1.5 h-4 w-4", isRefreshing && "animate-spin")} />
              Refresh
            </Button>

            {connection?.db_type === "redis" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAddRedisKeyOpen(true)}
                className="h-9 rounded-xl border-border/60 bg-background/60 px-3"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Add Key
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAddRowOpen(true)}
                className="h-9 rounded-xl border-border/60 bg-background/60 px-3"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Add Row
              </Button>
            )}

            <div className="ml-1 flex items-center gap-1 rounded-xl border border-border/60 bg-background/60 p-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0 || isLoading}
                className="h-7 w-7 rounded-lg"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-2 text-xs text-muted-foreground">
                Page {page + 1} of {totalPages || 1}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages - 1 || isLoading}
                className="h-7 w-7 rounded-lg"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden p-2">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/55 bg-card/20">
          <div className="sticky top-0 z-30 border-b border-border/55 bg-background">
            <div className="flex h-9 items-center gap-1.5 overflow-x-auto px-2.5 text-[11px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <span className="shrink-0 rounded-md border border-border/60 bg-muted/35 px-2 py-0.5 font-medium text-foreground/90">
                {connection?.name || "DB"}
              </span>
              <span className="shrink-0 rounded-md border border-border/60 bg-background/50 px-2 py-0.5 text-muted-foreground">
                {selectedTable.schema}.{selectedTable.name}
              </span>
              <span className="shrink-0 rounded-md border border-border/60 bg-background/50 px-2 py-0.5 text-muted-foreground">
                {rowSearch.trim() ? `Filter: "${rowSearch.trim()}"` : "Filter: none"}
              </span>
              <span className="shrink-0 rounded-md border border-border/60 bg-background/50 px-2 py-0.5 text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <ArrowUpDown className="h-3 w-3" />
                  Sort: none
                </span>
              </span>
              <span className="shrink-0 rounded-md border border-border/60 bg-background/50 px-2 py-0.5 text-muted-foreground">
                {visibleColumns.length}/{allColumns.length || 0} columns
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            <motion.div
              key={`${selectedTable.schema}.${selectedTable.name}-${page}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="min-w-max"
            >
              <Table className="text-[13px]">
                <TableHeader>
                  <TableRow className="border-border/55 bg-background hover:bg-background">
                    {visibleColumns.map((col) => (
                      <TableHead
                        key={col.name}
                        className="sticky top-0 z-20 h-11 whitespace-nowrap border-r border-border/55 bg-background px-3 last:border-r-0"
                      >
                        <div className="flex items-center gap-2">
                          {col.is_primary_key && <Key className="h-3 w-3 text-yellow-500" />}
                          <span className="font-semibold text-foreground">{col.name}</span>
                          <span className="rounded-md bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {col.data_type}
                          </span>
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 10 }).map((_, i) => (
                      <TableRow key={i} className="border-border/45">
                        {Array.from({ length: Math.max(visibleColumns.length, 1) }).map((_, j) => (
                          <TableCell
                            key={j}
                            className={cn(
                              "border-r border-border/45 px-3 last:border-r-0",
                              getDensityCellPadding(density),
                            )}
                          >
                            <Skeleton className="h-4 w-full" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : filteredRows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={Math.max(visibleColumns.length, 1)}
                        className="h-36 text-center text-sm text-muted-foreground"
                      >
                        {tableData?.rows.length
                          ? "No rows match current filter"
                          : "No data in this table"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRows.map((row, i) => (
                      <TableRow
                        key={`${page}-${i}`}
                        data-row-key={`${page}-${i}`}
                        className={cn(
                          "border-border/45 hover:bg-muted/15",
                          i % 2 === 0 ? "bg-background/10" : "bg-background/20",
                          selectedRowKey === `${page}-${i}` && "bg-primary/10 hover:bg-primary/12",
                          "cursor-pointer",
                        )}
                        onClick={() => handleSelectRow(row, `${page}-${i}`)}
                        onDoubleClick={() => handleSelectRow(row, `${page}-${i}`)}
                      >
                        {visibleColumnIndexes.map((index, j) => {
                          const cell = row[index];
                          const displayValue = renderedRows[i]?.[j] ?? formatCellValue(cell);
                          const isNull = cell === null;
                          return (
                            <ContextMenu key={`${index}-${j}`}>
                              <ContextMenuTrigger asChild>
                                <TableCell
                                  className={cn(
                                    "max-w-sm truncate border-r border-border/45 px-3 font-mono text-xs text-foreground last:border-r-0 cursor-default",
                                    getDensityCellPadding(density),
                                    isNull && "text-muted-foreground italic",
                                  )}
                                  title={displayValue}
                                >
                                  {displayValue}
                                </TableCell>
                              </ContextMenuTrigger>
                              <ContextMenuContent>
                                <ContextMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopyCell(cell);
                                  }}
                                >
                                  <Copy className="h-4 w-4" />
                                  Copy cell content
                                </ContextMenuItem>
                                {connection?.db_type !== "redis" && (
                                  <>
                                    <ContextMenuSeparator />
                                    <ContextMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleSelectRow(row, `${page}-${i}`);
                                      }}
                                    >
                                      <Search className="h-4 w-4" />
                                      Open row editor
                                    </ContextMenuItem>
                                    <ContextMenuItem
                                      variant="destructive"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteRowClick(row);
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      Delete row
                                    </ContextMenuItem>
                                  </>
                                )}
                              </ContextMenuContent>
                            </ContextMenu>
                          );
                        })}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </motion.div>
          </div>
        </div>
      </div>

      <Sheet
        open={Boolean(selectedRecord)}
        onOpenChange={(open) => {
          if (!open) {
            clearSelectedRow();
          }
        }}
      >
        <SheetContent
          side="right"
          className="w-[92vw] gap-0 border-border/55 bg-card/85 p-0 backdrop-blur sm:max-w-xl"
        >
          <SheetHeader className="border-b border-border/55 p-3 pr-10">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <SheetTitle className="text-sm font-semibold text-foreground">
                  Selected Row
                </SheetTitle>
                <SheetDescription className="text-[11px] text-muted-foreground">
                  {selectedTable.schema}.{selectedTable.name}
                </SheetDescription>
              </div>
              <Badge variant="outline" className="text-[10px]">
                {selectedFieldEntries.length} fields
              </Badge>
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-lg px-2.5 text-xs"
                onClick={handleCopySelectedRow}
              >
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                Copy JSON
              </Button>
              {connection?.db_type !== "redis" && selectedRowRaw && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-lg border-red-500/35 px-2.5 text-xs text-red-200 hover:bg-red-500/10 hover:text-red-100"
                  onClick={() => handleDeleteRowClick(selectedRowRaw)}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Delete
                </Button>
              )}
            </div>
          </SheetHeader>

          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {allColumns.map((field) => {
              const isNull = rowNullFields.has(field.name);
              const value = editedForm[field.name] ?? "";
              const inputType = getInputType(field.data_type);
              const fieldIsBoolean = isBooleanType(field.data_type);
              const fieldIsTextarea = shouldUseTextarea(field.data_type) && !fieldIsBoolean;
              const boolValue = value.toLowerCase() === "true";

              return (
                <div
                  key={field.name}
                  className="rounded-lg border border-border/50 bg-background/40 p-2.5"
                >
                  <div className="mb-1 flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-medium text-foreground">{field.name}</p>
                      <Badge variant="outline" className="h-4 px-1.5 text-[9px] font-normal">
                        {field.data_type}
                      </Badge>
                      {field.is_primary_key && (
                        <Badge variant="secondary" className="h-4 px-1.5 text-[9px]">
                          PK
                        </Badge>
                      )}
                    </div>
                    {field.is_nullable && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground">NULL</span>
                        <Switch
                          checked={isNull}
                          onCheckedChange={(checked) => toggleInlineNull(field.name, checked)}
                        />
                      </div>
                    )}
                  </div>
                  {fieldIsBoolean ? (
                    <div className="flex items-center justify-between rounded-md border border-input bg-background px-3 py-2">
                      <span className={cn("text-xs", isNull && "text-muted-foreground")}>
                        {isNull ? "NULL" : boolValue ? "True" : "False"}
                      </span>
                      <Switch
                        checked={boolValue}
                        onCheckedChange={(checked) =>
                          handleInlineFieldChange(field.name, checked ? "true" : "false")
                        }
                        disabled={isNull}
                      />
                    </div>
                  ) : fieldIsTextarea ? (
                    <Textarea
                      value={isNull ? "" : value}
                      onChange={(e) => handleInlineFieldChange(field.name, e.target.value)}
                      disabled={isNull}
                      placeholder={isNull ? "NULL" : `Enter ${field.data_type}`}
                      className="min-h-20 font-mono text-xs"
                    />
                  ) : (
                    <Input
                      type={inputType}
                      value={isNull ? "" : value}
                      onChange={(e) => handleInlineFieldChange(field.name, e.target.value)}
                      disabled={isNull}
                      placeholder={isNull ? "NULL" : `Enter ${field.data_type}`}
                      step={inputType === "number" ? "any" : undefined}
                      className="h-8 font-mono text-xs"
                    />
                  )}
                </div>
              );
            })}
          </div>

          <div className="border-t border-border/55 p-3">
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-lg px-2.5 text-xs"
                onClick={() => {
                  setEditedForm({ ...originalForm });
                  setRowNullFields(new Set(originalNullFields));
                }}
                disabled={!hasInlineChanges || isSavingInline}
              >
                Reset
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 rounded-lg px-2.5 text-xs"
                  onClick={clearSelectedRow}
                >
                  Close
                </Button>
                <Button
                  size="sm"
                  className="h-8 rounded-lg px-2.5 text-xs"
                  onClick={() => void handleSaveInlineRow()}
                  disabled={!hasInlineChanges || isSavingInline}
                >
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                  {isSavingInline ? "Saving..." : "Save Row"}
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {connectionId && allColumns.length > 0 && (
        <>
          <AddRowSheet
            open={addRowOpen}
            onOpenChange={setAddRowOpen}
            connectionId={connectionId}
            dbType={connection?.db_type ?? "postgres"}
            schema={selectedTable.schema}
            table={selectedTable.name}
            columns={allColumns}
            onDirtyChange={setIsAddFormDirty}
          />
          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {isMongoDB ? "Document" : "Row"}</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this {isMongoDB ? "document" : "row"}? This action
                  cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteConfirm}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {deleteRow.isPending || deleteDocument.isPending ? "Deleting..." : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <AddRedisKeyDialog
            connectionId={connectionId}
            open={addRedisKeyOpen}
            onOpenChange={setAddRedisKeyOpen}
            onSuccess={handleRefresh}
          />
        </>
      )}
    </div>
  );
});
