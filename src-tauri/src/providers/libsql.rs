use super::{
    async_trait, ColumnInfo, ConnectionParams, DatabaseProvider, DatabaseType, ProviderError,
    QueryResult, TableInfo,
};
use libsql::{Builder, Connection, Database};
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
    AND name NOT LIKE '_litestream_%'
    AND name NOT LIKE 'libsql_%'
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

#[allow(dead_code)]
pub struct LibsqlProvider {
    db: Database,
    conn: Arc<Mutex<Connection>>,
}

impl LibsqlProvider {
    pub async fn connect(params: ConnectionParams) -> Result<Self, ProviderError> {
        let (url, auth_token) = params.to_libsql_url();

        let url = if url.starts_with("libsql://")
            || url.starts_with("https://")
            || url.starts_with("http://")
        {
            url
        } else {
            format!("libsql://{}", url)
        };

        let token = auth_token.unwrap_or_default();

        let db = Builder::new_remote(url, token)
            .build()
            .await
            .map_err(|e| ProviderError::new(format!("Failed to connect to Turso: {}", e)))?;

        let conn = db
            .connect()
            .map_err(|e| ProviderError::new(format!("Failed to create connection: {}", e)))?;

        Ok(Self {
            db,
            conn: Arc::new(Mutex::new(conn)),
        })
    }

    fn format_error(e: libsql::Error) -> ProviderError {
        ProviderError::new(e.to_string())
    }
}

#[async_trait]
impl DatabaseProvider for LibsqlProvider {
    fn database_type(&self) -> DatabaseType {
        DatabaseType::Libsql
    }

    async fn list_tables(&self) -> Result<Vec<TableInfo>, ProviderError> {
        let conn = self.conn.lock().await;
        let mut rows = conn
            .query(queries::LIST_TABLES, ())
            .await
            .map_err(Self::format_error)?;

        let mut tables = Vec::new();
        while let Some(row) = rows.next().await.map_err(Self::format_error)? {
            let schema: String = row.get(0).map_err(Self::format_error)?;
            let name: String = row.get(1).map_err(Self::format_error)?;

            let count_query = queries::count_table_rows(&name);
            let row_count = match conn.query(&count_query, ()).await {
                Ok(mut count_rows) => {
                    if let Ok(Some(count_row)) = count_rows.next().await {
                        count_row.get::<i64>(0).unwrap_or(0)
                    } else {
                        0
                    }
                }
                Err(_) => 0,
            };

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
        let mut rows = conn
            .query(queries::GET_TABLE_COLUMNS, [table])
            .await
            .map_err(Self::format_error)?;

        let mut columns = Vec::new();
        while let Some(row) = rows.next().await.map_err(Self::format_error)? {
            columns.push(ColumnInfo {
                name: row.get(0).map_err(Self::format_error)?,
                data_type: row.get(1).map_err(Self::format_error)?,
                is_nullable: row.get::<i64>(2).map_err(Self::format_error)? != 0,
                is_primary_key: row.get::<i64>(3).map_err(Self::format_error)? != 0,
                has_default: row.get::<i64>(4).map_err(Self::format_error)? != 0,
            });
        }

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
        let mut rows = conn.query(query, ()).await.map_err(Self::format_error)?;

        let mut result_rows: Vec<Vec<serde_json::Value>> = Vec::new();
        let mut columns: Vec<String> = Vec::new();
        let mut first_row = true;

        while let Some(row) = rows.next().await.map_err(Self::format_error)? {
            if first_row {
                let col_count = row.column_count();
                for i in 0..col_count {
                    let name = row
                        .column_name(i as i32)
                        .map(|s| s.to_string())
                        .unwrap_or_else(|| format!("column_{}", i));
                    columns.push(name);
                }
                first_row = false;
            }

            let mut row_values: Vec<serde_json::Value> = Vec::new();
            for i in 0..row.column_count() {
                let value = libsql_value_to_json(&row, i as i32);
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
        let mut rows = conn.query(&query, ()).await.map_err(Self::format_error)?;

        if let Some(row) = rows.next().await.map_err(Self::format_error)? {
            let count: i64 = row.get(0).map_err(Self::format_error)?;
            Ok(count)
        } else {
            Ok(0)
        }
    }
}

fn libsql_value_to_json(row: &libsql::Row, idx: i32) -> serde_json::Value {
    if let Ok(val) = row.get::<i64>(idx) {
        return serde_json::Value::Number(val.into());
    }

    if let Ok(val) = row.get::<f64>(idx) {
        if let Some(num) = serde_json::Number::from_f64(val) {
            return serde_json::Value::Number(num);
        }
        return serde_json::Value::Null;
    }

    if let Ok(val) = row.get::<String>(idx) {
        return serde_json::Value::String(val);
    }

    if let Ok(val) = row.get::<Vec<u8>>(idx) {
        use base64::Engine;
        let encoded = base64::engine::general_purpose::STANDARD.encode(&val);
        return serde_json::Value::String(encoded);
    }

    if row
        .get::<libsql::Value>(idx)
        .map(|v| matches!(v, libsql::Value::Null))
        .unwrap_or(true)
    {
        return serde_json::Value::Null;
    }

    serde_json::Value::Null
}
