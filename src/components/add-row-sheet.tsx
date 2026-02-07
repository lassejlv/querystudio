import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
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
import { useInsertRow, useInsertDocument } from "@/lib/hooks";
import { toast } from "sonner";
import { quoteIdentifier, quoteTableRef } from "@/lib/utils";
import type { ColumnInfo, DatabaseType } from "@/lib/types";

interface AddRowSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionId: string;
  dbType: DatabaseType;
  schema: string;
  table: string;
  columns: ColumnInfo[];
  onSuccess?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

function isBooleanType(dataType: string): boolean {
  const lower = dataType.toLowerCase();
  return lower === "boolean" || lower === "bool";
}

export function AddRowSheet({
  open,
  onOpenChange,
  connectionId,
  dbType,
  schema,
  table,
  columns,
  onSuccess,
  onDirtyChange,
}: AddRowSheetProps) {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [nullFields, setNullFields] = useState<Set<string>>(new Set());
  const [mongoDocument, setMongoDocument] = useState<string>("{\n  \n}");
  const [isDirty, setIsDirty] = useState(false);
  const insertRow = useInsertRow(connectionId);
  const insertDocument = useInsertDocument(connectionId);

  const isMongoDB = dbType === "mongodb";

  // Reset form when sheet opens/closes or columns change
  useEffect(() => {
    if (open) {
      const initial: Record<string, string> = {};
      const initialDefaults = new Set<string>();
      columns.forEach((col) => {
        initial[col.name] = isBooleanType(col.data_type) ? "false" : "";
        // Default to "use default" for columns with defaults (like SERIAL) or nullable columns
        if (col.has_default || col.is_nullable) {
          initialDefaults.add(col.name);
        }
      });
      setFormData(initial);
      setNullFields(initialDefaults);
      setMongoDocument("{\n  \n}");
      setIsDirty(false);
      onDirtyChange?.(false);
    }
  }, [open, columns, onDirtyChange]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // MongoDB uses a different insert flow
    if (isMongoDB) {
      try {
        // Validate JSON
        JSON.parse(mongoDocument);
      } catch {
        toast.error("Invalid JSON document");
        return;
      }

      try {
        await insertDocument.mutateAsync({
          schema,
          collection: table,
          document: mongoDocument,
        });
        toast.success("Document inserted successfully");
        setIsDirty(false);
        onDirtyChange?.(false);
        onOpenChange(false);
        onSuccess?.();
      } catch (error) {
        toast.error(`Insert failed: ${error}`);
      }
      return;
    }

    // Validate non-nullable timestamp/date/time fields
    for (const col of columns) {
      const isNull = nullFields.has(col.name);
      const value = formData[col.name];
      const lowerType = col.data_type.toLowerCase();
      const isTimestampType =
        lowerType.includes("timestamp") || lowerType.includes("date") || lowerType.includes("time");

      if (isTimestampType && !col.is_nullable && !col.has_default && !isNull && value === "") {
        toast.error(`Column "${col.name}" cannot be empty (NOT NULL constraint)`);
        return;
      }
    }

    // Build column/value arrays for non-null fields
    const insertColumns: string[] = [];
    const insertValues: string[] = [];

    columns.forEach((col) => {
      if (nullFields.has(col.name)) {
        // Skip - will use default or NULL
        return;
      }

      const value = formData[col.name];
      if (value === "" && col.is_nullable) {
        // Empty and nullable - skip
        return;
      }

      insertColumns.push(quoteIdentifier(col.name, dbType));
      insertValues.push(formatValueForSQL(value, col.data_type, col.is_nullable));
    });

    if (insertColumns.length === 0) {
      toast.error("Please fill in at least one field");
      return;
    }

    const query = `INSERT INTO ${quoteTableRef(schema, table, dbType)} (${insertColumns.join(", ")}) VALUES (${insertValues.join(", ")})`;

    try {
      await insertRow.mutateAsync({ schema, table, query });
      toast.success("Row inserted successfully");
      setIsDirty(false);
      onDirtyChange?.(false);
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(`Insert failed: ${error}`);
    }
  };

  const formatValueForSQL = (value: string, dataType: string, isNullable: boolean): string => {
    const lowerType = dataType.toLowerCase();

    // Numeric types - no quotes
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

    // Boolean
    if (lowerType === "boolean" || lowerType === "bool") {
      return value.toLowerCase() === "true" ? "true" : "false";
    }

    // JSON/JSONB - validate and quote
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

    // Default - string with escaped quotes
    return `'${value.replace(/'/g, "''")}'`;
  };

  const updateField = (name: string, value: string) => {
    setFormData((prev) => {
      if (prev[name] !== value) {
        if (!isDirty) {
          setIsDirty(true);
          onDirtyChange?.(true);
        }
      }
      return { ...prev, [name]: value };
    });
    // If user types something, unmark as null
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
      const wasNull = next.has(name);
      if (isNull) {
        next.add(name);
      } else {
        next.delete(name);
      }
      if (wasNull !== isNull && !isDirty) {
        setIsDirty(true);
        onDirtyChange?.(true);
      }
      return next;
    });
  };

  const handleSheetOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setIsDirty(false);
      onDirtyChange?.(false);
    }
    onOpenChange(nextOpen);
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

  const isPending = insertRow.isPending || insertDocument.isPending;

  return (
    <Sheet open={open} onOpenChange={handleSheetOpenChange}>
      <SheetContent className="sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle>Add New {isMongoDB ? "Document" : "Row"}</SheetTitle>
          <SheetDescription>
            Insert a new {isMongoDB ? "document" : "row"} into {schema}.{table}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden min-h-0">
          <div className="flex-1 overflow-y-auto min-h-0">
            {isMongoDB ? (
              <div className="space-y-4 py-4 px-1">
                <div className="space-y-2">
                  <Label htmlFor="mongo-document">JSON Document</Label>
                  <Textarea
                    id="mongo-document"
                    value={mongoDocument}
                    onChange={(e) => setMongoDocument(e.target.value)}
                    placeholder='{"field": "value"}'
                    className="min-h-[300px] font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter a valid JSON document. The _id field will be auto-generated if not
                    provided.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 py-4 px-1">
                {columns.map((col) => {
                  const useDefault = nullFields.has(col.name);
                  const inputType = getInputType(col.data_type);
                  const useTextarea = shouldUseTextarea(col.data_type);
                  const canUseDefault = col.has_default || col.is_nullable;
                  const isBoolean = isBooleanType(col.data_type);
                  const boolValue = (formData[col.name] || "false").toLowerCase() === "true";

                  return (
                    <div key={col.name} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor={col.name} className="flex items-center gap-2">
                          {col.name}
                          <Badge variant="outline" className="text-[10px] font-normal">
                            {col.data_type}
                          </Badge>
                          {col.is_primary_key && (
                            <Badge variant="secondary" className="text-[10px]">
                              PK
                            </Badge>
                          )}
                          {col.has_default && (
                            <Badge
                              variant="outline"
                              className="text-[10px] text-blue-400 border-blue-400/50"
                            >
                              auto
                            </Badge>
                          )}
                        </Label>
                        {canUseDefault && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {col.has_default ? "DEFAULT" : "NULL"}
                            </span>
                            <Switch
                              checked={useDefault}
                              onCheckedChange={(checked) => toggleNull(col.name, checked)}
                            />
                          </div>
                        )}
                      </div>
                      {isBoolean ? (
                        <div className="flex items-center justify-between rounded-md border border-input bg-background px-3 py-2.5">
                          <span
                            className={useDefault ? "text-sm text-muted-foreground" : "text-sm"}
                          >
                            {boolValue ? "True" : "False"}
                          </span>
                          <Switch
                            checked={boolValue}
                            onCheckedChange={(checked) =>
                              updateField(col.name, checked ? "true" : "false")
                            }
                            disabled={useDefault}
                          />
                        </div>
                      ) : useTextarea ? (
                        <Textarea
                          id={col.name}
                          value={useDefault ? "" : formData[col.name] || ""}
                          onChange={(e) => updateField(col.name, e.target.value)}
                          disabled={useDefault}
                          placeholder={
                            useDefault
                              ? col.has_default
                                ? "DEFAULT"
                                : "NULL"
                              : `Enter ${col.data_type}`
                          }
                          className="min-h-[80px] font-mono text-sm"
                        />
                      ) : (
                        <Input
                          id={col.name}
                          type={inputType}
                          value={useDefault ? "" : formData[col.name] || ""}
                          onChange={(e) => updateField(col.name, e.target.value)}
                          disabled={useDefault}
                          placeholder={
                            useDefault
                              ? col.has_default
                                ? "DEFAULT"
                                : "NULL"
                              : `Enter ${col.data_type}`
                          }
                          step={inputType === "number" ? "any" : undefined}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <SheetFooter className="flex-shrink-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Insert {isMongoDB ? "Document" : "Row"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
