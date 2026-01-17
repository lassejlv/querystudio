import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { DatabaseType } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Quote an identifier (table name, column name, schema) based on database type.
 * - PostgreSQL/SQLite uses double quotes: "identifier"
 * - MySQL uses backticks: `identifier`
 */
export function quoteIdentifier(
  identifier: string,
  dbType: DatabaseType,
): string {
  if (dbType === "mysql") {
    return `\`${identifier}\``;
  }
  // PostgreSQL and SQLite use double quotes
  return `"${identifier}"`;
}

/**
 * Quote a schema.table reference based on database type.
 */
export function quoteTableRef(
  schema: string,
  table: string,
  dbType: DatabaseType,
): string {
  return `${quoteIdentifier(schema, dbType)}.${quoteIdentifier(table, dbType)}`;
}
