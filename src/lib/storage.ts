import Database from "@tauri-apps/plugin-sql";
import type { SavedConnection, SavedConnectionConfig, DatabaseType } from "./types";

const DB_PATH = "sqlite:connections.db";

let db: Database | null = null;

/**
 * Get or initialize the database connection
 */
async function getDb(): Promise<Database> {
  if (!db) {
    db = await Database.load(DB_PATH);
  }
  return db;
}

/**
 * Database row type for connections table
 */
interface ConnectionRow {
  id: string;
  name: string;
  db_type: string;
  config_type: string;
  connection_string: string | null;
  host: string | null;
  port: number | null;
  database: string | null;
  username: string | null;
}

/**
 * Convert a database row to a SavedConnection
 */
function rowToConnection(row: ConnectionRow): SavedConnection {
  let config: SavedConnectionConfig;

  if (row.config_type === "connection_string" && row.connection_string) {
    config = { connection_string: row.connection_string };
  } else {
    config = {
      host: row.host || "",
      port: row.port || 5432,
      database: row.database || "",
      username: row.username || "",
    };
  }

  return {
    id: row.id,
    name: row.name,
    db_type: row.db_type as DatabaseType,
    config,
  };
}

/**
 * Storage API using SQLite
 */
export const storage = {
  /**
   * Get all saved connections
   */
  async getSavedConnections(): Promise<{ connections: SavedConnection[] }> {
    const database = await getDb();
    const rows = await database.select<ConnectionRow[]>(
      "SELECT id, name, db_type, config_type, connection_string, host, port, database, username FROM connections ORDER BY name"
    );
    return {
      connections: rows.map(rowToConnection),
    };
  },

  /**
   * Save a connection (insert or update)
   */
  async saveConnection(connection: SavedConnection): Promise<void> {
    const database = await getDb();
    const config = connection.config;

    const isConnectionString = "connection_string" in config;
    const configType = isConnectionString ? "connection_string" : "parameters";

    // Use INSERT OR REPLACE for upsert behavior
    await database.execute(
      `INSERT OR REPLACE INTO connections 
       (id, name, db_type, config_type, connection_string, host, port, database, username)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        connection.id,
        connection.name,
        connection.db_type,
        configType,
        isConnectionString ? config.connection_string : null,
        isConnectionString ? null : config.host,
        isConnectionString ? null : config.port,
        isConnectionString ? null : config.database,
        isConnectionString ? null : config.username,
      ]
    );
  },

  /**
   * Delete a saved connection
   */
  async deleteSavedConnection(id: string): Promise<void> {
    const database = await getDb();
    await database.execute("DELETE FROM connections WHERE id = $1", [id]);
  },

  /**
   * Get the count of saved connections
   */
  async getSavedConnectionCount(): Promise<number> {
    const database = await getDb();
    const result = await database.select<{ count: number }[]>(
      "SELECT COUNT(*) as count FROM connections"
    );
    return result[0]?.count ?? 0;
  },

  /**
   * Get a single connection by ID
   */
  async getConnection(id: string): Promise<SavedConnection | null> {
    const database = await getDb();
    const rows = await database.select<ConnectionRow[]>(
      "SELECT id, name, db_type, config_type, connection_string, host, port, database, username FROM connections WHERE id = $1",
      [id]
    );

    if (rows.length === 0) {
      return null;
    }

    return rowToConnection(rows[0]);
  },
};
