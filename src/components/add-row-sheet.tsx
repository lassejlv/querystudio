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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useInsertRow } from "@/lib/hooks";
import { toast } from "sonner";
import type { ColumnInfo } from "@/lib/types";

interface AddRowSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionId: string;
  schema: string;
  table: string;
  columns: ColumnInfo[];
  onSuccess?: () => void;
}

export function AddRowSheet({
  open,
  onOpenChange,
  connectionId,
  schema,
  table,
  columns,
  onSuccess,
}: AddRowSheetProps) {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [nullFields, setNullFields] = useState<Set<string>>(new Set());
  const insertRow = useInsertRow(connectionId);

  // Reset form when sheet opens/closes or columns change
  useEffect(() => {
    if (open) {
      const initial: Record<string, string> = {};
      const initialDefaults = new Set<string>();
      columns.forEach((col) => {
        initial[col.name] = "";
        // Default to "use default" for columns with defaults (like SERIAL) or nullable columns
        if (col.has_default || col.is_nullable) {
          initialDefaults.add(col.name);
        }
      });
      setFormData(initial);
      setNullFields(initialDefaults);
    }
  }, [open, columns]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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

      insertColumns.push(`"${col.name}"`);
      insertValues.push(formatValueForSQL(value, col.data_type));
    });

    if (insertColumns.length === 0) {
      toast.error("Please fill in at least one field");
      return;
    }

    const query = `INSERT INTO "${schema}"."${table}" (${insertColumns.join(", ")}) VALUES (${insertValues.join(", ")})`;

    try {
      await insertRow.mutateAsync({ schema, table, query });
      toast.success("Row inserted successfully");
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(`Insert failed: ${error}`);
    }
  };

  const formatValueForSQL = (value: string, dataType: string): string => {
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

    // Default - string with escaped quotes
    return `'${value.replace(/'/g, "''")}'`;
  };

  const updateField = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
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
    if (lower.includes("int") || lower.includes("numeric") || lower.includes("decimal") || lower.includes("float") || lower.includes("double") || lower.includes("real")) {
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
    return lower === "text" || lower === "json" || lower === "jsonb" || lower.includes("character varying");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg flex flex-col overflow-hidden">
        <SheetHeader>
          <SheetTitle>Add New Row</SheetTitle>
          <SheetDescription>
            Insert a new row into {schema}.{table}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col min-h-0">
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4 py-4 pl-4">
              {columns.map((col) => {
                const useDefault = nullFields.has(col.name);
                const inputType = getInputType(col.data_type);
                const useTextarea = shouldUseTextarea(col.data_type);
                const canUseDefault = col.has_default || col.is_nullable;

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
                          <Badge variant="outline" className="text-[10px] text-blue-400 border-blue-400/50">
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
                    {useTextarea ? (
                      <Textarea
                        id={col.name}
                        value={useDefault ? "" : formData[col.name] || ""}
                        onChange={(e) => updateField(col.name, e.target.value)}
                        disabled={useDefault}
                        placeholder={useDefault ? (col.has_default ? "DEFAULT" : "NULL") : `Enter ${col.data_type}`}
                        className="min-h-[80px] font-mono text-sm"
                      />
                    ) : (
                      <Input
                        id={col.name}
                        type={inputType}
                        value={useDefault ? "" : formData[col.name] || ""}
                        onChange={(e) => updateField(col.name, e.target.value)}
                        disabled={useDefault}
                        placeholder={useDefault ? (col.has_default ? "DEFAULT" : "NULL") : `Enter ${col.data_type}`}
                        step={inputType === "number" ? "any" : undefined}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          <SheetFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={insertRow.isPending}>
              {insertRow.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Insert Row
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
