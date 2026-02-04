use super::{
    async_trait, ColumnInfo, ConnectionParams, DatabaseProvider, DatabaseType, ProviderError,
    QueryResult, TableInfo,
};
use rusqlite::{Connection, types::Value};
use std::sync::Arc;
use tokio::sync::Mutex;

mod queries {
    pub const LIST_TABLES: &str = r#"
SELECT
    'main' as schema,
    name,
    0 as row_count
FROM sqlite_master
WHERE type = 'table'
    AND name NOT LIKE 'sqlite_%'
ORDER BY name
"#;

    pub const GET_TABLE_COLUMNS: &str = r#"
SELECT
    name,
    type as data_type,
    "notnull" = 0 as is_nullable,
    pk > 0 as is_primary_key,
    dflt_value IS NOT NULL as has_default
FROM pragma_table_info(?)
ORDER BY cid
"#;

    pub fn select_table_data(table: &str, limit: i64, offset: i64) -> String {
        format!(
            "SELECT * FROM \"{}\" LIMIT {} OFFSET {}",
            table.replace('"', "\"\""),
            limit,
            offset
        )
    }

    pub fn count_table_rows(table: &str) -> String {
        format!(
            "SELECT COUNT(*) as count FROM \"{}\"",
            table.replace('"', "\"\"")
        )
    }
}

pub struct SqliteProvider {
    conn: Arc<Mutex<Connection>>,
}

impl SqliteProvider {
    pub async fn connect(params: ConnectionParams) -> Result<Self, ProviderError> {
        let path = match params {
            ConnectionParams::ConnectionString { connection_string } => connection_string,
            ConnectionParams::Parameters { database, .. } => database,
        };

        let conn = Connection::open(&path)
            .map_err(|e| ProviderError::new(format!("Failed to open SQLite database: {}", e)))?;

        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }

    fn format_error(e: rusqlite::Error) -> ProviderError {
        ProviderError::new(e.to_string())
    }
}

#[async_trait]
impl DatabaseProvider for SqliteProvider {
    fn database_type(&self) -> DatabaseType {
        DatabaseType::Sqlite
    }

    fn as_any(&self) -> &dyn std::any::Any {
        self
    }

    async fn list_tables(&self) -> Result<Vec<TableInfo>, ProviderError> {
        let conn = self.conn.lock().await;

        let mut stmt = conn
            .prepare(queries::LIST_TABLES)
            .map_err(Self::format_error)?;

        let table_names: Vec<(String, String)> = stmt
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(Self::format_error)?
            .filter_map(|r| r.ok())
            .collect();

        drop(stmt);

        let mut tables = Vec::new();
        for (schema, name) in table_names {
            let count_query = queries::count_table_rows(&name);
            let row_count: i64 = conn
                .query_row(&count_query, [], |row| row.get(0))
                .unwrap_or(0);

            tables.push(TableInfo {
                schema,
                name,
                row_count,
            });
        }

        Ok(tables)
    }

    async fn get_table_columns(
        &self,
        _schema: &str,
        table: &str,
    ) -> Result<Vec<ColumnInfo>, ProviderError> {
        let conn = self.conn.lock().await;
        let mut stmt = conn
            .prepare(queries::GET_TABLE_COLUMNS)
            .map_err(Self::format_error)?;

        let columns = stmt
            .query_map([table], |row| {
                Ok(ColumnInfo {
                    name: row.get(0)?,
                    data_type: row.get(1)?,
                    is_nullable: row.get::<_, i64>(2)? != 0,
                    is_primary_key: row.get::<_, i64>(3)? != 0,
                    has_default: row.get::<_, i64>(4)? != 0,
                })
            })
            .map_err(Self::format_error)?
            .filter_map(|r| r.ok())
            .collect();

        Ok(columns)
    }

    async fn get_table_data(
        &self,
        _schema: &str,
        table: &str,
        limit: i64,
        offset: i64,
    ) -> Result<QueryResult, ProviderError> {
        let query = queries::select_table_data(table, limit, offset);
        self.execute_query(&query).await
    }

    async fn execute_query(&self, query: &str) -> Result<QueryResult, ProviderError> {
        let conn = self.conn.lock().await;
        let mut stmt = conn.prepare(query).map_err(Self::format_error)?;

        let column_count = stmt.column_count();
        let columns: Vec<String> = stmt
            .column_names()
            .into_iter()
            .map(|s| s.to_string())
            .collect();

        let mut result_rows: Vec<Vec<serde_json::Value>> = Vec::new();

        let mut rows = stmt.query([]).map_err(Self::format_error)?;

        while let Some(row) = rows.next().map_err(Self::format_error)? {
            let mut row_values: Vec<serde_json::Value> = Vec::new();
            for i in 0..column_count {
                let value = sqlite_value_to_json(row, i);
                row_values.push(value);
            }
            result_rows.push(row_values);
        }

        Ok(QueryResult {
            columns,
            row_count: result_rows.len(),
            rows: result_rows,
        })
    }

    async fn get_table_count(&self, _schema: &str, table: &str) -> Result<i64, ProviderError> {
        let conn = self.conn.lock().await;
        let query = queries::count_table_rows(table);
        let count: i64 = conn
            .query_row(&query, [], |row| row.get(0))
            .map_err(Self::format_error)?;
        Ok(count)
    }
}

fn sqlite_value_to_json(row: &rusqlite::Row, idx: usize) -> serde_json::Value {
    // Try to get the value as different types
    if let Ok(val) = row.get::<_, i64>(idx) {
        return serde_json::Value::Number(val.into());
    }

    if let Ok(val) = row.get::<_, f64>(idx) {
        if let Some(num) = serde_json::Number::from_f64(val) {
            return serde_json::Value::Number(num);
        }
        return serde_json::Value::Null;
    }

    if let Ok(val) = row.get::<_, String>(idx) {
        return serde_json::Value::String(val);
    }

    if let Ok(val) = row.get::<_, Vec<u8>>(idx) {
        use base64::Engine;
        let encoded = base64::engine::general_purpose::STANDARD.encode(&val);
        return serde_json::Value::String(encoded);
    }

    // Check for NULL using Value enum
    if let Ok(val) = row.get::<_, Value>(idx) {
        if matches!(val, Value::Null) {
            return serde_json::Value::Null;
        }
    }

    serde_json::Value::Null
}
