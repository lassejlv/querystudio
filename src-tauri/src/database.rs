use crate::providers::{
    create_provider, ColumnInfo, ConnectionParams, DatabaseProvider, DatabaseType, QueryResult,
    TableInfo,
};
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionConfig {
    #[serde(default)]
    pub db_type: DatabaseType,
    #[serde(flatten)]
    pub params: ConnectionParams,
}

pub struct ConnectionManager {
    connections: RwLock<HashMap<String, Arc<Box<dyn DatabaseProvider>>>>,
}

impl ConnectionManager {
    pub fn new() -> Self {
        Self {
            connections: RwLock::new(HashMap::new()),
        }
    }

    pub fn connection_count(&self) -> usize {
        self.connections.read().len()
    }

    pub async fn connect(&self, id: String, config: ConnectionConfig) -> Result<(), String> {
        let provider = create_provider(config.db_type, config.params)
            .await
            .map_err(|e| e.to_string())?;

        self.connections.write().insert(id, Arc::new(provider));
        Ok(())
    }

    pub fn disconnect(&self, id: &str) -> Result<(), String> {
        self.connections
            .write()
            .remove(id)
            .ok_or_else(|| "Connection not found".to_string())?;
        Ok(())
    }

    fn get_provider(&self, id: &str) -> Result<Arc<Box<dyn DatabaseProvider>>, String> {
        self.connections
            .read()
            .get(id)
            .cloned()
            .ok_or_else(|| "Connection not found".to_string())
    }

    pub async fn list_tables(&self, connection_id: &str) -> Result<Vec<TableInfo>, String> {
        let provider = self.get_provider(connection_id)?;
        provider.list_tables().await.map_err(|e| e.to_string())
    }

    pub async fn get_table_columns(
        &self,
        connection_id: &str,
        schema: &str,
        table: &str,
    ) -> Result<Vec<ColumnInfo>, String> {
        let provider = self.get_provider(connection_id)?;
        provider
            .get_table_columns(schema, table)
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn get_table_data(
        &self,
        connection_id: &str,
        schema: &str,
        table: &str,
        limit: i64,
        offset: i64,
    ) -> Result<QueryResult, String> {
        let provider = self.get_provider(connection_id)?;
        provider
            .get_table_data(schema, table, limit, offset)
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn execute_query(
        &self,
        connection_id: &str,
        query: &str,
    ) -> Result<QueryResult, String> {
        let provider = self.get_provider(connection_id)?;
        provider
            .execute_query(query)
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn get_table_count(
        &self,
        connection_id: &str,
        schema: &str,
        table: &str,
    ) -> Result<i64, String> {
        let provider = self.get_provider(connection_id)?;
        provider
            .get_table_count(schema, table)
            .await
            .map_err(|e| e.to_string())
    }
}

pub async fn test_connection(config: ConnectionConfig) -> Result<(), String> {
    create_provider(config.db_type, config.params)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}
