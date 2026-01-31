import * as React from "react";
import { Database, Copy, Play, RefreshCw, Settings2 } from "lucide-react";
import { faker } from "@faker-js/faker";
import type { TabContentProps, TabPluginRegistration } from "@/lib/tab-sdk";
import type { LocalPluginModule } from "@/lib/local-plugins";
import { usePluginSDK } from "@/lib/plugin-sdk";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

interface ColumnConfig {
  name: string;
  dataType: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
  hasDefault: boolean;
  fakerType: FakerType;
  skip: boolean;
}

type FakerType =
  | "fullName"
  | "firstName"
  | "lastName"
  | "email"
  | "phone"
  | "company"
  | "jobTitle"
  | "streetAddress"
  | "city"
  | "zipCode"
  | "country"
  | "url"
  | "uuid"
  | "int"
  | "intSmall"
  | "float"
  | "boolean"
  | "dateRecent"
  | "datePast"
  | "dateFuture"
  | "loremWord"
  | "loremSentence"
  | "loremParagraph"
  | "auto"
  | "skip";

// ============================================================================
// Faker Type Detection
// ============================================================================

const fakerTypes: { value: FakerType; label: string }[] = [
  { value: "auto", label: "Auto-detect" },
  { value: "fullName", label: "Full Name" },
  { value: "firstName", label: "First Name" },
  { value: "lastName", label: "Last Name" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "company", label: "Company" },
  { value: "jobTitle", label: "Job Title" },
  { value: "streetAddress", label: "Street Address" },
  { value: "city", label: "City" },
  { value: "zipCode", label: "Zip Code" },
  { value: "country", label: "Country" },
  { value: "url", label: "URL" },
  { value: "uuid", label: "UUID" },
  { value: "int", label: "Integer (0-1000)" },
  { value: "intSmall", label: "Small Int (0-100)" },
  { value: "float", label: "Decimal (0-100)" },
  { value: "boolean", label: "Boolean" },
  { value: "dateRecent", label: "Date (Recent)" },
  { value: "datePast", label: "Date (Past)" },
  { value: "dateFuture", label: "Date (Future)" },
  { value: "loremWord", label: "Word" },
  { value: "loremSentence", label: "Sentence" },
  { value: "loremParagraph", label: "Paragraph" },
  { value: "skip", label: "Skip (NULL)" },
];

function detectFakerType(columnName: string, dataType: string): FakerType {
  const name = columnName.toLowerCase();
  const type = dataType.toLowerCase();

  // Detect by column name patterns
  if (name.includes("email")) return "email";
  if (name.includes("phone") || name.includes("mobile")) return "phone";
  if (name.includes("first_name") || name === "firstname") return "firstName";
  if (name.includes("last_name") || name === "lastname") return "lastName";
  if (name.includes("name") && !name.includes("user") && !name.includes("file")) return "fullName";
  if (name.includes("company") || name.includes("organization")) return "company";
  if (name.includes("job") || name.includes("title")) return "jobTitle";
  if (name.includes("address") && !name.includes("email")) return "streetAddress";
  if (name === "city" || name.includes("_city")) return "city";
  if (name.includes("zip") || name.includes("postal")) return "zipCode";
  if (name.includes("country")) return "country";
  if (name.includes("url") || name.includes("link") || name.includes("website")) return "url";
  if (name.includes("uuid") || name === "id") return "uuid";
  if (name.includes("description")) return "loremSentence";
  if (name.includes("content") || name.includes("body") || name.includes("text")) return "loremParagraph";
  if (name.includes("created") || name.includes("updated") || name.includes("date")) {
    if (name.includes("at")) return "dateRecent";
  }

  // Detect by data type
  if (type.includes("bool")) return "boolean";
  if (type.includes("int")) {
    if (name.includes("age")) return "intSmall";
    return "int";
  }
  if (type.includes("float") || type.includes("decimal") || type.includes("numeric")) return "float";
  if (type.includes("uuid")) return "uuid";
  if (type.includes("timestamp") || type.includes("datetime")) return "dateRecent";
  if (type.includes("date")) return "dateRecent";
  if (type.includes("text") || type.includes("varchar")) return "loremSentence";

  return "loremWord";
}

function generateValue(fakerType: FakerType): string | number | boolean | null {
  switch (fakerType) {
    case "fullName":
      return faker.person.fullName();
    case "firstName":
      return faker.person.firstName();
    case "lastName":
      return faker.person.lastName();
    case "email":
      return faker.internet.email();
    case "phone":
      return faker.phone.number();
    case "company":
      return faker.company.name();
    case "jobTitle":
      return faker.person.jobTitle();
    case "streetAddress":
      return faker.location.streetAddress();
    case "city":
      return faker.location.city();
    case "zipCode":
      return faker.location.zipCode();
    case "country":
      return faker.location.country();
    case "url":
      return faker.internet.url();
    case "uuid":
      return faker.string.uuid();
    case "int":
      return faker.number.int({ min: 0, max: 1000 });
    case "intSmall":
      return faker.number.int({ min: 0, max: 100 });
    case "float":
      return faker.number.float({ min: 0, max: 100, fractionDigits: 2 });
    case "boolean":
      return faker.datatype.boolean();
    case "dateRecent":
      return faker.date.recent().toISOString();
    case "datePast":
      return faker.date.past().toISOString();
    case "dateFuture":
      return faker.date.future().toISOString();
    case "loremWord":
      return faker.lorem.word();
    case "loremSentence":
      return faker.lorem.sentence();
    case "loremParagraph":
      return faker.lorem.paragraph();
    case "skip":
      return null;
    case "auto":
      return faker.lorem.word();
    default:
      return faker.lorem.word();
  }
}

function escapeSQLValue(value: string | number | boolean | null): string {
  if (value === null) return "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}

// ============================================================================
// Plugin Definition
// ============================================================================

export const plugin: TabPluginRegistration = {
  type: "data-generator",
  displayName: "Data Generator",
  icon: Database,
  getDefaultTitle: () => "Data Generator",
  canCreate: true,
  allowMultiple: false,
  priority: 60,
  experimental: false,
  supportedDatabases: ["postgres", "mysql", "sqlite", "mssql", "oracle", "mariadb"],
};

// ============================================================================
// Component
// ============================================================================

export function Component({ tabId, paneId, connectionId }: TabContentProps) {
  const sdk = usePluginSDK(connectionId, tabId, paneId);
  const [selectedTable, setSelectedTable] = React.useState<string>("");
  const [rowCount, setRowCount] = React.useState<number>(5);
  const [columns, setColumns] = React.useState<ColumnConfig[]>([]);
  const [generatedSQL, setGeneratedSQL] = React.useState<string>("");
  const [isLoading, setIsLoading] = React.useState(false);

  // Load columns when table is selected
  const loadColumns = React.useCallback(
    async (tableName: string) => {
      if (!tableName || !sdk.connection.isConnected) return;

      setIsLoading(true);
      try {
        const table = sdk.connection.tables.find((t) => t.name === tableName);
        if (!table) return;

        const cols = await sdk.api.getTableColumns(table.schema, table.name);
        const configs: ColumnConfig[] = cols.map((col) => ({
          name: col.name,
          dataType: col.data_type,
          isNullable: col.is_nullable,
          isPrimaryKey: col.is_primary_key,
          hasDefault: col.has_default,
          fakerType: col.is_primary_key ? "skip" : detectFakerType(col.name, col.data_type),
          skip: col.is_primary_key,
        }));

        setColumns(configs);
        sdk.utils.toast.success(`Loaded ${configs.length} columns`);
      } catch (error) {
        sdk.utils.toast.error("Failed to load columns");
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    },
    [sdk.connection.tables, sdk.connection.isConnected, sdk.api, sdk.utils.toast]
  );

  // Handle table selection
  const handleTableChange = (value: string) => {
    setSelectedTable(value);
    setGeneratedSQL("");
    if (value) {
      loadColumns(value);
    } else {
      setColumns([]);
    }
  };

  // Update column config
  const updateColumnConfig = (index: number, updates: Partial<ColumnConfig>) => {
    setColumns((prev) =>
      prev.map((col, i) => (i === index ? { ...col, ...updates } : col))
    );
  };

  // Generate SQL
  const generateSQL = React.useCallback(() => {
    if (!selectedTable || columns.length === 0) {
      sdk.utils.toast.info("Select a table first");
      return;
    }

    const activeColumns = columns.filter((col) => !col.skip);
    if (activeColumns.length === 0) {
      sdk.utils.toast.error("No columns selected for insert");
      return;
    }

    const columnNames = activeColumns.map((col) => `"${col.name}"`).join(", ");
    const values: string[] = [];

    for (let i = 0; i < rowCount; i++) {
      const rowValues = activeColumns
        .map((col) => escapeSQLValue(generateValue(col.fakerType)))
        .join(", ");
      values.push(`(${rowValues})`);
    }

    const sql = `INSERT INTO "${selectedTable}" (${columnNames}) VALUES\n  ${values.join(",\n  ")};`;

    setGeneratedSQL(sql);
    sdk.utils.toast.success(`Generated ${rowCount} rows`);
  }, [selectedTable, columns, rowCount, sdk.utils.toast]);

  // Copy to clipboard
  const handleCopy = React.useCallback(async () => {
    if (!generatedSQL) {
      sdk.utils.toast.info("Generate SQL first");
      return;
    }

    const success = await sdk.utils.clipboard.copy(generatedSQL);
    if (success) {
      sdk.utils.toast.success("Copied to clipboard");
    } else {
      sdk.utils.toast.error("Failed to copy");
    }
  }, [generatedSQL, sdk.utils.clipboard, sdk.utils.toast]);

  // Execute SQL
  const handleExecute = React.useCallback(async () => {
    if (!generatedSQL) {
      sdk.utils.toast.info("Generate SQL first");
      return;
    }

    if (!sdk.connection.isConnected) {
      sdk.utils.toast.error("Not connected to database");
      return;
    }

    try {
      const loadingId = sdk.utils.toast.loading("Executing...");
      await sdk.api.executeQuery(generatedSQL);
      sdk.utils.toast.dismiss(loadingId);
      sdk.utils.toast.success(`Inserted ${rowCount} rows`);
    } catch (error) {
      sdk.utils.toast.error(`Failed to execute: ${error}`);
    }
  }, [generatedSQL, sdk.connection.isConnected, sdk.api, sdk.utils.toast, rowCount]);

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <Label className="text-sm font-medium">Table</Label>
          <Select value={selectedTable} onValueChange={handleTableChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a table..." />
            </SelectTrigger>
            <SelectContent>
              {sdk.connection.tables.map((table) => (
                <SelectItem key={table.name} value={table.name}>
                  {table.schema}.{table.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-32">
          <Label className="text-sm font-medium">Rows</Label>
          <Input
            type="number"
            min={1}
            max={100}
            value={rowCount}
            onChange={(e) => setRowCount(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
          />
        </div>

        <div className="pt-6">
          <Button onClick={generateSQL} disabled={!selectedTable || isLoading} className="gap-2">
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            Generate
          </Button>
        </div>
      </div>

      {/* Columns Configuration */}
      {columns.length > 0 && (
        <div className="flex-1 min-h-0 overflow-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-muted sticky top-0">
              <tr>
                <th className="text-left p-2 font-medium">Column</th>
                <th className="text-left p-2 font-medium">Type</th>
                <th className="text-left p-2 font-medium">Generator</th>
                <th className="text-center p-2 font-medium w-16">Skip</th>
              </tr>
            </thead>
            <tbody>
              {columns.map((col, index) => (
                <tr key={col.name} className="border-t">
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs">{col.name}</span>
                      {col.isPrimaryKey && (
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-1 rounded">PK</span>
                      )}
                      {!col.isNullable && (
                        <span className="text-xs bg-red-100 text-red-800 px-1 rounded">NOT NULL</span>
                      )}
                    </div>
                  </td>
                  <td className="p-2 text-muted-foreground text-xs">{col.dataType}</td>
                  <td className="p-2">
                    <Select
                      value={col.fakerType}
                      onValueChange={(value) =>
                        updateColumnConfig(index, { fakerType: value as FakerType })
                      }
                      disabled={col.skip}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {fakerTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-2 text-center">
                    <Switch
                      checked={col.skip}
                      onCheckedChange={(checked) =>
                        updateColumnConfig(index, { skip: checked })
                      }
                      disabled={!col.isNullable && !col.hasDefault}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Output */}
      {generatedSQL && (
        <div className="flex-1 min-h-0 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Generated SQL</Label>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCopy} className="gap-2">
                <Copy className="h-4 w-4" />
                Copy
              </Button>
              <Button variant="outline" size="sm" onClick={handleExecute} className="gap-2">
                <Play className="h-4 w-4" />
                Execute
              </Button>
            </div>
          </div>
          <Textarea
            value={generatedSQL}
            readOnly
            className="flex-1 font-mono text-xs resize-none"
            spellCheck={false}
          />
        </div>
      )}

      {/* Empty State */}
      {!selectedTable && (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <Settings2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Select a table to generate data</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Export
// ============================================================================

const dataGeneratorPlugin: LocalPluginModule = { plugin, Component };
export default dataGeneratorPlugin;
