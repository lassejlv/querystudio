import { useState, useEffect } from "react";
import { Loader2, Copy } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

import { Badge } from "@/components/ui/badge";
import { useUpdateRow } from "@/lib/hooks";
import { toast } from "sonner";
import { cn, quoteIdentifier, quoteTableRef } from "@/lib/utils";
import type { ColumnInfo, DatabaseType } from "@/lib/types";

interface EditRowSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionId: string;
  dbType: DatabaseType;
  schema: string;
  table: string;
  columns: ColumnInfo[];
  rowData: Record<string, unknown>;
  onSuccess?: () => void;
}

export function EditRowSheet({
  open,
  onOpenChange,
  connectionId,
  dbType,
  schema,
  table,
  columns,
  rowData,
  onSuccess,
}: EditRowSheetProps) {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [nullFields, setNullFields] = useState<Set<string>>(new Set());
  const [originalData, setOriginalData] = useState<Record<string, unknown>>({});
  const updateRow = useUpdateRow(connectionId);

  // Initialize form with row data when sheet opens
  useEffect(() => {
    if (open && rowData) {
      const initial: Record<string, string> = {};
      const initialNulls = new Set<string>();

      columns.forEach((col) => {
        const value = rowData[col.name];
        if (value === null || value === undefined) {
          initial[col.name] = "";
          if (col.is_nullable) {
            initialNulls.add(col.name);
          }
        } else if (typeof value === "object") {
          initial[col.name] = JSON.stringify(value);
        } else {
          initial[col.name] = String(value);
        }
      });

      setFormData(initial);
      setNullFields(initialNulls);
      setOriginalData(rowData);
    }
  }, [open, rowData, columns]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Find primary key columns for WHERE clause
    const pkColumns = columns.filter((c) => c.is_primary_key);
    if (pkColumns.length === 0) {
      toast.error("Cannot update: table has no primary key");
      return;
    }

    // Validate non-nullable timestamp/date/time fields
    for (const col of columns) {
      const isNull = nullFields.has(col.name);
      const newValue = formData[col.name];
      const lowerType = col.data_type.toLowerCase();
      const isTimestampType =
        lowerType.includes("timestamp") ||
        lowerType.includes("date") ||
        lowerType.includes("time");

      if (isTimestampType && !col.is_nullable && !isNull && newValue === "") {
        toast.error(
          `Column "${col.name}" cannot be empty (NOT NULL constraint)`,
        );
        return;
      }
    }

    // Build SET clause
    const setClauses: string[] = [];
    columns.forEach((col) => {
      const isNull = nullFields.has(col.name);
      const newValue = formData[col.name];
      const oldValue = originalData[col.name];

      // Check if value changed
      const oldStr =
        oldValue === null || oldValue === undefined
          ? null
          : typeof oldValue === "object"
            ? JSON.stringify(oldValue)
            : String(oldValue);
      const newStr = isNull ? null : newValue;

      if (oldStr !== newStr) {
        if (isNull) {
          setClauses.push(`${quoteIdentifier(col.name, dbType)} = NULL`);
        } else {
          setClauses.push(
            `${quoteIdentifier(col.name, dbType)} = ${formatValueForSQL(newValue, col.data_type, col.is_nullable)}`,
          );
        }
      }
    });

    if (setClauses.length === 0) {
      toast.info("No changes to save");
      onOpenChange(false);
      return;
    }

    // Build WHERE clause from primary keys
    const whereClauses = pkColumns.map((col) => {
      const value = originalData[col.name];
      if (value === null || value === undefined) {
        return `${quoteIdentifier(col.name, dbType)} IS NULL`;
      }
      return `${quoteIdentifier(col.name, dbType)} = ${formatValueForSQL(String(value), col.data_type, col.is_nullable)}`;
    });

    const query = `UPDATE ${quoteTableRef(schema, table, dbType)} SET ${setClauses.join(", ")} WHERE ${whereClauses.join(" AND ")}`;

    try {
      await updateRow.mutateAsync({ schema, table, query });
      toast.success("Row updated successfully");
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(`Update failed: ${error}`);
    }
  };

  const formatValueForSQL = (
    value: string,
    dataType: string,
    isNullable: boolean,
  ): string => {
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

    if (lowerType === "json" || lowerType === "jsonb") {
      try {
        JSON.parse(value);
        return `'${value.replace(/'/g, "''")}'`;
      } catch {
        return `'${value.replace(/'/g, "''")}'`;
      }
    }

    // Timestamp/date/time types cannot accept empty strings - use NULL if nullable
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

  const updateField = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (nullFields.has(name) && value !== "") {
      setNullFields((prev) => {
        const next = new Set(prev);
        next.delete(name);
        return next;
      });
    }
  };

  const toggleNull = (name: string, isNull: boolean) => {
    setNullFields((prev) => {
      const next = new Set(prev);
      if (isNull) {
        next.add(name);
      } else {
        next.delete(name);
      }
      return next;
    });
  };

  const getInputType = (dataType: string): string => {
    const lower = dataType.toLowerCase();
    if (
      lower.includes("int") ||
      lower.includes("numeric") ||
      lower.includes("decimal") ||
      lower.includes("float") ||
      lower.includes("double") ||
      lower.includes("real")
    ) {
      return "number";
    }
    if (lower.includes("date") && !lower.includes("time")) {
      return "date";
    }
    if (lower === "time") {
      return "time";
    }
    return "text";
  };

  const shouldUseTextarea = (dataType: string): boolean => {
    const lower = dataType.toLowerCase();
    return (
      lower === "text" ||
      lower === "json" ||
      lower === "jsonb" ||
      lower.includes("character varying")
    );
  };

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle>Edit Row</SheetTitle>
          <SheetDescription>
            Update row in {schema}.{table}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col overflow-hidden min-h-0"
        >
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="space-y-4 py-4 px-1">
              {columns.map((col) => {
                const isNull = nullFields.has(col.name);
                const inputType = getInputType(col.data_type);
                const useTextarea = shouldUseTextarea(col.data_type);

                return (
                  <div key={col.name} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor={col.name}
                        className="flex items-center gap-2"
                      >
                        {col.name}
                        <Badge
                          variant="outline"
                          className="text-[10px] font-normal"
                        >
                          {col.data_type}
                        </Badge>
                        {col.is_primary_key && (
                          <Badge variant="secondary" className="text-[10px]">
                            PK
                          </Badge>
                        )}
                      </Label>
                      {col.is_nullable && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            NULL
                          </span>
                          <Switch
                            checked={isNull}
                            onCheckedChange={(checked) =>
                              toggleNull(col.name, checked)
                            }
                          />
                        </div>
                      )}
                    </div>
                    {useTextarea ? (
                      <div className="group/input relative">
                        <Textarea
                          id={col.name}
                          value={isNull ? "" : formData[col.name] || ""}
                          onChange={(e) =>
                            updateField(col.name, e.target.value)
                          }
                          disabled={isNull}
                          placeholder={
                            isNull ? "NULL" : `Enter ${col.data_type}`
                          }
                          className="min-h-20 font-mono text-sm pr-8"
                        />
                        <button
                          type="button"
                          onClick={() => handleCopy(formData[col.name] || "")}
                          className={cn(
                            "absolute right-2 top-2 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors opacity-0 group-hover/input:opacity-100",
                            isNull && "hidden",
                          )}
                          title="Copy to clipboard"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="group/input relative">
                        <Input
                          id={col.name}
                          type={inputType}
                          value={isNull ? "" : formData[col.name] || ""}
                          onChange={(e) =>
                            updateField(col.name, e.target.value)
                          }
                          disabled={isNull}
                          placeholder={
                            isNull ? "NULL" : `Enter ${col.data_type}`
                          }
                          step={inputType === "number" ? "any" : undefined}
                          className="pr-8"
                        />
                        <button
                          type="button"
                          onClick={() => handleCopy(formData[col.name] || "")}
                          className={cn(
                            "absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors opacity-0 group-hover/input:opacity-100",
                            isNull && "hidden",
                          )}
                          title="Copy to clipboard"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <SheetFooter className="shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateRow.isPending}>
              {updateRow.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Changes
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
