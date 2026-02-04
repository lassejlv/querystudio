import { useState, useEffect, memo } from "react";
import { motion } from "framer-motion";
import {
  Key,
  ChevronLeft,
  ChevronRight,
  Plus,
  Copy,
  Pencil,
  Trash2,
  RefreshCw,
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
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { AddRowSheet } from "@/components/add-row-sheet";
import { EditRowSheet } from "@/components/edit-row-sheet";
import { AddRedisKeyDialog } from "@/components/add-redis-key-dialog";
import { useQueryClient } from "@tanstack/react-query";
import { useConnectionStore } from "@/lib/store";
import { quoteIdentifier, quoteTableRef } from "@/lib/utils";
import {
  useTableData,
  useTableColumns,
  useTableCount,
  useDeleteRow,
  useDeleteDocument,
} from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { ColumnInfo } from "@/lib/types";

const PAGE_SIZE = 100;

import type { TabContentProps } from "@/lib/tab-sdk";
import { useLayoutStore } from "@/lib/layout-store";

interface TableViewerProps extends TabContentProps {}

export const TableViewer = memo(function TableViewer({
  tabId,
  paneId,
  connectionId: propsConnectionId,
}: TableViewerProps) {
  const connection = useConnectionStore((s) => s.getActiveConnection());
  const activeConnectionId = useConnectionStore((s) => s.activeConnectionId);
  const globalSelectedTable = useConnectionStore((s) => s.selectedTable);

  // Use connectionId from props or fall back to connection store
  const connectionId = propsConnectionId || activeConnectionId || "";

  // Get tableInfo from the tab's state in the layout store
  const pane = useLayoutStore((s) => s.panes[connectionId]?.[paneId]);
  const tab = pane?.type === "leaf" ? pane.tabs.find((t) => t.id === tabId) : null;
  const tableInfo = tab?.tableInfo;

  // Use tableInfo from tab if provided (for dedicated table tabs), otherwise use global selection
  const selectedTable = tableInfo || globalSelectedTable;
  const [page, setPage] = useState(0);

  // Reset page when table changes
  useEffect(() => {
    setPage(0);
  }, [selectedTable?.schema, selectedTable?.name]);
  const [addRowOpen, setAddRowOpen] = useState(false);
  const [editRowOpen, setEditRowOpen] = useState(false);
  const [editRowData, setEditRowData] = useState<Record<string, unknown> | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteRowData, setDeleteRowData] = useState<Record<string, unknown> | null>(null);
  const [addRedisKeyOpen, setAddRedisKeyOpen] = useState(false);
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

  const isMongoDB = connection?.db_type === "mongodb";

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

  const totalPages = totalCount ? Math.ceil(totalCount / PAGE_SIZE) : 0;
  const isLoading = columnsLoading || dataLoading;
  const isRefreshing = columnsFetching || dataFetching || countFetching;

  const handleRefresh = () => {
    if (!connectionId || !selectedTable) return;

    // Invalidate all queries for this table
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

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return "NULL";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  const rowToRecord = (row: unknown[], cols: ColumnInfo[]): Record<string, unknown> => {
    const record: Record<string, unknown> = {};
    cols.forEach((col, i) => {
      record[col.name] = row[i];
    });
    return record;
  };

  const handleCopyCell = async (value: unknown) => {
    const text = formatValue(value);
    try {
      await navigator.clipboard.writeText(text === "NULL" ? "" : text);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleEditRow = (row: unknown[]) => {
    if (!columns) return;
    const record = rowToRecord(row, columns);
    setEditRowData(record);
    setEditRowOpen(true);
  };

  const handleDeleteRowClick = (row: unknown[]) => {
    if (!columns) return;
    const record = rowToRecord(row, columns);
    setDeleteRowData(record);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteRowData || !columns || !connectionId) return;

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
      } catch (error) {
        toast.error(`Delete failed: ${error}`);
      }
      return;
    }

    const pkColumns = columns.filter((c) => c.is_primary_key);
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
      return `${quoteIdentifier(col.name, dbType)} = ${formatValueForSQL(String(value), col.data_type)}`;
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
    } catch (error) {
      toast.error(`Delete failed: ${error}`);
    }
  };

  const formatValueForSQL = (value: string, dataType: string): string => {
    const lowerType = dataType.toLowerCase();

    if (
      lowerType.includes("int") ||
      lowerType.includes("numeric") ||
      lowerType.includes("decimal") ||
      lowerType.includes("float") ||
      lowerType.includes("double") ||
      lowerType.includes("real")
    ) {
      return value || "0";
    }

    if (lowerType === "boolean" || lowerType === "bool") {
      return value.toLowerCase() === "true" ? "true" : "false";
    }

    return `'${value.replace(/'/g, "''")}'`;
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <h2 className="font-medium text-foreground">
            {selectedTable.schema}.{selectedTable.name}
          </h2>
          {totalCount !== undefined && (
            <Badge variant="secondary" className="text-xs">
              {totalCount.toLocaleString()} rows
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={cn("mr-1 h-4 w-4", isRefreshing && "animate-spin")} />
            Refresh
          </Button>
          {connection?.db_type === "redis" ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setAddRedisKeyOpen(true)}>
                <Plus className="mr-1 h-4 w-4" />
                Add Key
              </Button>
              <div className="mx-2 h-4 w-px bg-secondary" />
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setAddRowOpen(true)}>
                <Plus className="mr-1 h-4 w-4" />
                Add Row
              </Button>
              <div className="mx-2 h-4 w-px bg-secondary" />
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0 || isLoading}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page + 1} of {totalPages || 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= totalPages - 1 || isLoading}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <motion.div
          key={`${selectedTable}-${page}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="min-w-max"
        >
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                {columns?.map((col) => (
                  <TableHead
                    key={col.name}
                    className="whitespace-nowrap border-r border-border last:border-r-0"
                  >
                    <div className="flex items-center gap-2">
                      {col.is_primary_key && <Key className="h-3 w-3 text-yellow-500" />}
                      <span>{col.name}</span>
                      <span className="text-xs text-muted-foreground">{col.data_type}</span>
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i} className="border-border">
                    {Array.from({ length: columns?.length || 5 }).map((_, j) => (
                      <TableCell key={j} className="border-r border-border last:border-r-0">
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : tableData?.rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns?.length || 1}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No data
                  </TableCell>
                </TableRow>
              ) : (
                tableData?.rows.map((row, i) => (
                  <TableRow
                    key={i}
                    className={cn(
                      "border-border hover:bg-card/50",
                      connection?.db_type !== "redis" && "cursor-pointer",
                    )}
                    onClick={() => connection?.db_type !== "redis" && handleEditRow(row)}
                  >
                    {row.map((cell, j) => {
                      const isNull = cell === null;
                      return (
                        <ContextMenu key={j}>
                          <ContextMenuTrigger asChild>
                            <TableCell
                              className={cn(
                                "max-w-xs truncate border-r border-border font-mono text-xs last:border-r-0 cursor-default",
                                isNull && "text-muted-foreground italic",
                              )}
                              title={formatValue(cell)}
                            >
                              {formatValue(cell)}
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
                                    handleEditRow(row);
                                  }}
                                >
                                  <Pencil className="h-4 w-4" />
                                  Edit row
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

      {connectionId && columns && (
        <>
          <AddRowSheet
            open={addRowOpen}
            onOpenChange={setAddRowOpen}
            connectionId={connectionId}
            dbType={connection?.db_type ?? "postgres"}
            schema={selectedTable.schema}
            table={selectedTable.name}
            columns={columns}
          />
          <EditRowSheet
            open={editRowOpen}
            onOpenChange={setEditRowOpen}
            connectionId={connectionId}
            dbType={connection?.db_type ?? "postgres"}
            schema={selectedTable.schema}
            table={selectedTable.name}
            columns={columns}
            rowData={editRowData ?? {}}
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
