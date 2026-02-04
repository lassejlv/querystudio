use super::{
    async_trait, ColumnInfo, ConnectionParams, DatabaseProvider, DatabaseType, ProviderError,
    QueryResult, TableInfo,
};
use native_tls::TlsConnector;
use postgres_native_tls::MakeTlsConnector;
use std::sync::Arc;
use tokio_postgres::Client;

mod queries {
    pub const LIST_TABLES: &str = r#"
SELECT
    t.table_schema as schema,
    t.table_name as name,
    COALESCE(s.n_live_tup, 0)::bigint as row_count
FROM information_schema.tables t
LEFT JOIN pg_stat_user_tables s
    ON s.schemaname = t.table_schema
    AND s.relname = t.table_name
WHERE t.table_type = 'BASE TABLE'
    AND t.table_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY t.table_schema, t.table_name
"#;

    pub const GET_TABLE_COLUMNS: &str = r#"
SELECT
    c.column_name as name,
    c.data_type,
    c.is_nullable = 'YES' as is_nullable,
    COALESCE(pk.is_primary_key, false) as is_primary_key,
    c.column_default IS NOT NULL as has_default
FROM information_schema.columns c
LEFT JOIN (
    SELECT kcu.column_name, true as is_primary_key
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = $1
        AND tc.table_name = $2
) pk ON c.column_name = pk.column_name
WHERE c.table_schema = $1 AND c.table_name = $2
ORDER BY c.ordinal_position
"#;

    pub fn select_table_data(schema: &str, table: &str, limit: i64, offset: i64) -> String {
        format!(
            "SELECT * FROM \"{}\".\"{}\" LIMIT {} OFFSET {}",
            schema, table, limit, offset
        )
    }

    pub fn count_table_rows(schema: &str, table: &str) -> String {
        format!("SELECT COUNT(*) as count FROM \"{}\".\"{}\"", schema, table)
    }
}

pub struct PostgresProvider {
    client: Arc<Client>,
}

impl PostgresProvider {
    pub async fn connect(params: ConnectionParams) -> Result<Self, ProviderError> {
        let conn_string = params.to_postgres_string();

        let client = match Self::connect_with_ssl(&conn_string).await {
            Ok(client) => client,
            Err(_ssl_err) => Self::connect_without_ssl(&conn_string).await?,
        };

        Ok(Self {
            client: Arc::new(client),
        })
    }

    async fn connect_with_ssl(conn_string: &str) -> Result<Client, ProviderError> {
        let tls_connector = TlsConnector::builder()
            .danger_accept_invalid_certs(true)
            .danger_accept_invalid_hostnames(true)
            .build()
            .map_err(|e| ProviderError::new(format!("Failed to create TLS connector: {}", e)))?;

        let connector = MakeTlsConnector::new(tls_connector);

        let ssl_conn_string = if conn_string.contains("sslmode=") {
            conn_string.to_string()
        } else {
            format!("{} sslmode=require", conn_string)
        };

        let (client, connection) = tokio_postgres::connect(&ssl_conn_string, connector)
            .await
            .map_err(|e| ProviderError::new(format!("SSL connection failed: {}", e)))?;

        tokio::spawn(async move {
            if let Err(e) = connection.await {
                eprintln!("PostgreSQL connection error: {}", e);
            }
        });

        Ok(client)
    }

    async fn connect_without_ssl(conn_string: &str) -> Result<Client, ProviderError> {
        let (client, connection) = tokio_postgres::connect(conn_string, tokio_postgres::NoTls)
            .await
            .map_err(|e| ProviderError::new(format!("Connection failed: {}", e)))?;

        tokio::spawn(async move {
            if let Err(e) = connection.await {
                eprintln!("PostgreSQL connection error: {}", e);
            }
        });

        Ok(client)
    }

    fn format_db_error(e: tokio_postgres::Error) -> ProviderError {
        if let Some(db_err) = e.as_db_error() {
            let mut err = ProviderError::new(db_err.message());

            if let Some(detail) = db_err.detail() {
                err = err.with_detail(detail);
            }

            if let Some(hint) = db_err.hint() {
                err = err.with_hint(hint);
            }

            return err;
        }

        ProviderError::new(e.to_string())
    }
}

#[async_trait]
impl DatabaseProvider for PostgresProvider {
    fn database_type(&self) -> DatabaseType {
        DatabaseType::Postgres
    }

    fn as_any(&self) -> &dyn std::any::Any {
        self
    }

    async fn list_tables(&self) -> Result<Vec<TableInfo>, ProviderError> {
        let rows = self
            .client
            .query(queries::LIST_TABLES, &[])
            .await
            .map_err(Self::format_db_error)?;

        let tables = rows
            .iter()
            .map(|row| TableInfo {
                schema: row.get("schema"),
                name: row.get("name"),
                row_count: row.get("row_count"),
            })
            .collect();

        Ok(tables)
    }

    async fn get_table_columns(
        &self,
        schema: &str,
        table: &str,
    ) -> Result<Vec<ColumnInfo>, ProviderError> {
        let rows = self
            .client
            .query(queries::GET_TABLE_COLUMNS, &[&schema, &table])
            .await
            .map_err(Self::format_db_error)?;

        let columns = rows
            .iter()
            .map(|row| ColumnInfo {
                name: row.get("name"),
                data_type: row.get("data_type"),
                is_nullable: row.get("is_nullable"),
                is_primary_key: row.get("is_primary_key"),
                has_default: row.get("has_default"),
            })
            .collect();

        Ok(columns)
    }

    async fn get_table_data(
        &self,
        schema: &str,
        table: &str,
        limit: i64,
        offset: i64,
    ) -> Result<QueryResult, ProviderError> {
        let query = queries::select_table_data(schema, table, limit, offset);
        self.execute_query(&query).await
    }

    async fn execute_query(&self, query: &str) -> Result<QueryResult, ProviderError> {
        let rows = self
            .client
            .query(query, &[])
            .await
            .map_err(Self::format_db_error)?;

        if rows.is_empty() {
            return Ok(QueryResult {
                columns: vec![],
                rows: vec![],
                row_count: 0,
            });
        }

        let columns: Vec<String> = rows[0]
            .columns()
            .iter()
            .map(|c| c.name().to_string())
            .collect();

        let result_rows: Vec<Vec<serde_json::Value>> = rows
            .iter()
            .map(|row| {
                row.columns()
                    .iter()
                    .enumerate()
                    .map(|(i, col)| postgres_value_to_json(row, i, col.type_()))
                    .collect()
            })
            .collect();

        Ok(QueryResult {
            columns,
            row_count: result_rows.len(),
            rows: result_rows,
        })
    }

    async fn get_table_count(&self, schema: &str, table: &str) -> Result<i64, ProviderError> {
        let query = queries::count_table_rows(schema, table);
        let row = self
            .client
            .query_one(&query, &[])
            .await
            .map_err(Self::format_db_error)?;

        Ok(row.get::<_, i64>("count"))
    }
}

fn postgres_value_to_json(
    row: &tokio_postgres::Row,
    idx: usize,
    pg_type: &tokio_postgres::types::Type,
) -> serde_json::Value {
    use tokio_postgres::types::Type;

    match *pg_type {
        Type::BOOL => row
            .try_get::<_, Option<bool>>(idx)
            .ok()
            .flatten()
            .map(serde_json::Value::Bool)
            .unwrap_or(serde_json::Value::Null),
        Type::INT2 => row
            .try_get::<_, Option<i16>>(idx)
            .ok()
            .flatten()
            .map(|v| serde_json::Value::Number(v.into()))
            .unwrap_or(serde_json::Value::Null),
        Type::INT4 => row
            .try_get::<_, Option<i32>>(idx)
            .ok()
            .flatten()
            .map(|v| serde_json::Value::Number(v.into()))
            .unwrap_or(serde_json::Value::Null),
        Type::INT8 => row
            .try_get::<_, Option<i64>>(idx)
            .ok()
            .flatten()
            .map(|v| serde_json::Value::Number(v.into()))
            .unwrap_or(serde_json::Value::Null),
        Type::FLOAT4 => row
            .try_get::<_, Option<f32>>(idx)
            .ok()
            .flatten()
            .and_then(|v| serde_json::Number::from_f64(v as f64))
            .map(serde_json::Value::Number)
            .unwrap_or(serde_json::Value::Null),
        Type::FLOAT8 => row
            .try_get::<_, Option<f64>>(idx)
            .ok()
            .flatten()
            .and_then(serde_json::Number::from_f64)
            .map(serde_json::Value::Number)
            .unwrap_or(serde_json::Value::Null),
        Type::JSON | Type::JSONB => row
            .try_get::<_, Option<serde_json::Value>>(idx)
            .ok()
            .flatten()
            .unwrap_or(serde_json::Value::Null),
        Type::UUID => row
            .try_get::<_, Option<uuid::Uuid>>(idx)
            .ok()
            .flatten()
            .map(|v| serde_json::Value::String(v.to_string()))
            .unwrap_or(serde_json::Value::Null),
        Type::TIMESTAMP | Type::TIMESTAMPTZ => row
            .try_get::<_, Option<chrono::NaiveDateTime>>(idx)
            .ok()
            .flatten()
            .map(|v| serde_json::Value::String(v.to_string()))
            .unwrap_or(serde_json::Value::Null),
        Type::DATE => row
            .try_get::<_, Option<chrono::NaiveDate>>(idx)
            .ok()
            .flatten()
            .map(|v| serde_json::Value::String(v.to_string()))
            .unwrap_or(serde_json::Value::Null),
        Type::TIME => row
            .try_get::<_, Option<chrono::NaiveTime>>(idx)
            .ok()
            .flatten()
            .map(|v| serde_json::Value::String(v.to_string()))
            .unwrap_or(serde_json::Value::Null),
        _ => row
            .try_get::<_, Option<String>>(idx)
            .ok()
            .flatten()
            .map(serde_json::Value::String)
            .unwrap_or(serde_json::Value::Null),
    }
}
