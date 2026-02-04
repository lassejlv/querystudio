use async_trait::async_trait;

// Re-export shared types from the providers crate
pub use querystudio_providers::{ColumnInfo, DatabaseType, QueryResult, TableInfo};

#[async_trait]
pub trait DatabaseOperations: Send + Sync {
    async fn list_tables(&self, connection_id: &str) -> Result<Vec<TableInfo>, String>;
    async fn get_table_columns(
        &self,
        connection_id: &str,
        schema: &str,
        table: &str,
    ) -> Result<Vec<ColumnInfo>, String>;
    async fn execute_query(&self, connection_id: &str, query: &str) -> Result<QueryResult, String>;
    async fn get_table_data(
        &self,
        connection_id: &str,
        schema: &str,
        table: &str,
        limit: i64,
        offset: i64,
    ) -> Result<QueryResult, String>;
}
