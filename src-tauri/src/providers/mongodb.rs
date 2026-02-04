use super::{
    async_trait, ColumnInfo, ConnectionParams, DatabaseProvider, DatabaseType, ProviderError,
    QueryResult, TableInfo,
};
use mongodb::{
    bson::{doc, oid::ObjectId, Bson, Document},
    options::ClientOptions,
    Client, Collection,
};
use std::collections::HashSet;

pub struct MongoDbProvider {
    client: Client,
    database: String,
}

impl MongoDbProvider {
    pub async fn connect(params: ConnectionParams) -> Result<Self, ProviderError> {
        let (url, database) = match &params {
            ConnectionParams::ConnectionString { connection_string } => {
                // Parse database name from connection string
                let db_name = Self::extract_database_from_url(connection_string)
                    .unwrap_or_else(|| "test".to_string());
                (connection_string.clone(), db_name)
            }
            ConnectionParams::Parameters {
                host,
                port,
                database,
                username,
                password,
            } => {
                let url = if !username.is_empty() && !password.is_empty() {
                    format!(
                        "mongodb://{}:{}@{}:{}/{}",
                        username, password, host, port, database
                    )
                } else {
                    format!("mongodb://{}:{}/{}", host, port, database)
                };
                (url, database.clone())
            }
        };

        let client_options = ClientOptions::parse(&url)
            .await
            .map_err(|e| ProviderError::new(format!("Failed to parse MongoDB URL: {}", e)))?;

        let client = Client::with_options(client_options)
            .map_err(|e| ProviderError::new(format!("Failed to create MongoDB client: {}", e)))?;

        // Test connection by listing databases
        client
            .list_database_names()
            .await
            .map_err(|e| ProviderError::new(format!("Failed to connect to MongoDB: {}", e)))?;

        Ok(Self {
            client,
            database: if database.is_empty() {
                "test".to_string()
            } else {
                database
            },
        })
    }

    fn extract_database_from_url(url: &str) -> Option<String> {
        // MongoDB URL format: mongodb://[user:pass@]host[:port]/database[?options]
        let url = url.strip_prefix("mongodb://")?;
        let url = url.strip_prefix("mongodb+srv://").unwrap_or(url);

        // Remove user:pass@ if present
        let url = if let Some(at_pos) = url.find('@') {
            &url[at_pos + 1..]
        } else {
            url
        };

        // Find the database part after host:port/
        let url = if let Some(slash_pos) = url.find('/') {
            &url[slash_pos + 1..]
        } else {
            return None;
        };

        // Remove query parameters
        let db_name = if let Some(question_pos) = url.find('?') {
            &url[..question_pos]
        } else {
            url
        };

        if db_name.is_empty() {
            None
        } else {
            Some(db_name.to_string())
        }
    }

    fn get_database(&self) -> mongodb::Database {
        self.client.database(&self.database)
    }

    fn bson_to_json(bson: &Bson) -> serde_json::Value {
        match bson {
            Bson::Null => serde_json::Value::Null,
            Bson::Boolean(b) => serde_json::Value::Bool(*b),
            Bson::Int32(i) => serde_json::Value::Number((*i).into()),
            Bson::Int64(i) => serde_json::Value::Number((*i).into()),
            Bson::Double(f) => serde_json::Number::from_f64(*f)
                .map(serde_json::Value::Number)
                .unwrap_or(serde_json::Value::Null),
            Bson::String(s) => serde_json::Value::String(s.clone()),
            Bson::Array(arr) => {
                serde_json::Value::Array(arr.iter().map(Self::bson_to_json).collect())
            }
            Bson::Document(doc) => {
                let obj: serde_json::Map<String, serde_json::Value> = doc
                    .iter()
                    .map(|(k, v)| (k.clone(), Self::bson_to_json(v)))
                    .collect();
                serde_json::Value::Object(obj)
            }
            Bson::ObjectId(oid) => serde_json::Value::String(oid.to_hex()),
            Bson::DateTime(dt) => serde_json::Value::String(dt.to_string()),
            Bson::Binary(bin) => {
                use base64::Engine;
                serde_json::Value::String(
                    base64::engine::general_purpose::STANDARD.encode(&bin.bytes),
                )
            }
            Bson::RegularExpression(regex) => {
                serde_json::json!({
                    "$regex": regex.pattern.clone(),
                    "$options": regex.options.clone()
                })
            }
            Bson::Timestamp(ts) => {
                serde_json::json!({
                    "t": ts.time,
                    "i": ts.increment
                })
            }
            Bson::Symbol(s) => serde_json::Value::String(s.clone()),
            Bson::Undefined => serde_json::Value::Null,
            Bson::MaxKey => serde_json::Value::String("MaxKey".to_string()),
            Bson::MinKey => serde_json::Value::String("MinKey".to_string()),
            Bson::Decimal128(d) => serde_json::Value::String(d.to_string()),
            Bson::JavaScriptCode(code) => serde_json::Value::String(code.clone()),
            Bson::JavaScriptCodeWithScope(code) => {
                serde_json::json!({
                    "$code": code.code.clone(),
                    "$scope": Self::bson_to_json(&Bson::Document(code.scope.clone()))
                })
            }
            Bson::DbPointer(_ptr) => {
                serde_json::json!({
                    "$dbPointer": "<dbPointer>"
                })
            }
        }
    }

    async fn get_collection_count(&self, collection_name: &str) -> Result<i64, ProviderError> {
        let db = self.get_database();
        let collection: Collection<Document> = db.collection(collection_name);

        collection
            .estimated_document_count()
            .await
            .map(|c| c as i64)
            .map_err(|e| ProviderError::new(format!("Failed to count documents: {}", e)))
    }

    async fn infer_schema(
        &self,
        collection_name: &str,
    ) -> Result<Vec<(String, String)>, ProviderError> {
        let db = self.get_database();
        let collection: Collection<Document> = db.collection(collection_name);

        // Sample a few documents to infer schema
        let mut cursor = collection
            .find(doc! {})
            .limit(100)
            .await
            .map_err(|e| ProviderError::new(format!("Failed to query collection: {}", e)))?;

        let mut field_types: std::collections::HashMap<String, std::collections::HashSet<String>> =
            std::collections::HashMap::new();

        use futures_util::StreamExt;
        while let Some(result) = cursor.next().await {
            if let Ok(doc) = result {
                for (key, value) in doc.iter() {
                    let type_name = Self::bson_type_name(value);
                    field_types
                        .entry(key.clone())
                        .or_insert_with(std::collections::HashSet::new)
                        .insert(type_name);
                }
            }
        }

        // Convert to sorted list
        let mut fields: Vec<(String, String)> = field_types
            .into_iter()
            .map(|(name, types)| {
                let type_str = if types.len() == 1 {
                    types.into_iter().next().unwrap()
                } else {
                    let mut sorted: Vec<_> = types.into_iter().collect();
                    sorted.sort();
                    sorted.join(" | ")
                };
                (name, type_str)
            })
            .collect();

        fields.sort_by(|a, b| {
            // Put _id first
            if a.0 == "_id" {
                std::cmp::Ordering::Less
            } else if b.0 == "_id" {
                std::cmp::Ordering::Greater
            } else {
                a.0.cmp(&b.0)
            }
        });

        Ok(fields)
    }

    fn bson_type_name(bson: &Bson) -> String {
        match bson {
            Bson::Null => "null".to_string(),
            Bson::Boolean(_) => "boolean".to_string(),
            Bson::Int32(_) => "int32".to_string(),
            Bson::Int64(_) => "int64".to_string(),
            Bson::Double(_) => "double".to_string(),
            Bson::String(_) => "string".to_string(),
            Bson::Array(_) => "array".to_string(),
            Bson::Document(_) => "object".to_string(),
            Bson::ObjectId(_) => "objectId".to_string(),
            Bson::DateTime(_) => "date".to_string(),
            Bson::Binary(_) => "binary".to_string(),
            Bson::RegularExpression(_) => "regex".to_string(),
            Bson::Timestamp(_) => "timestamp".to_string(),
            Bson::Symbol(_) => "symbol".to_string(),
            Bson::Undefined => "undefined".to_string(),
            Bson::MaxKey => "maxKey".to_string(),
            Bson::MinKey => "minKey".to_string(),
            Bson::Decimal128(_) => "decimal128".to_string(),
            Bson::JavaScriptCode(_) => "javascript".to_string(),
            Bson::JavaScriptCodeWithScope(_) => "javascriptWithScope".to_string(),
            Bson::DbPointer(_) => "dbPointer".to_string(),
        }
    }
}

#[async_trait]
impl DatabaseProvider for MongoDbProvider {
    fn database_type(&self) -> DatabaseType {
        DatabaseType::Mongodb
    }

    fn as_any(&self) -> &dyn std::any::Any {
        self
    }

    async fn list_tables(&self) -> Result<Vec<TableInfo>, ProviderError> {
        let db = self.get_database();

        let collection_names = db
            .list_collection_names()
            .await
            .map_err(|e| ProviderError::new(format!("Failed to list collections: {}", e)))?;

        let mut tables = Vec::new();

        for name in collection_names {
            let count = self.get_collection_count(&name).await.unwrap_or(0);
            tables.push(TableInfo {
                schema: self.database.clone(),
                name,
                row_count: count,
            });
        }

        // Sort by name
        tables.sort_by(|a, b| a.name.cmp(&b.name));

        Ok(tables)
    }

    async fn get_table_columns(
        &self,
        _schema: &str,
        table: &str,
    ) -> Result<Vec<ColumnInfo>, ProviderError> {
        let fields = self.infer_schema(table).await?;

        Ok(fields
            .into_iter()
            .map(|(name, data_type)| ColumnInfo {
                name: name.clone(),
                data_type,
                is_nullable: name != "_id", // _id is always required
                is_primary_key: name == "_id",
                has_default: name == "_id", // _id gets auto-generated
            })
            .collect())
    }

    async fn get_table_data(
        &self,
        _schema: &str,
        table: &str,
        limit: i64,
        offset: i64,
    ) -> Result<QueryResult, ProviderError> {
        let db = self.get_database();
        let collection: Collection<Document> = db.collection(table);

        let mut cursor = collection
            .find(doc! {})
            .skip(offset as u64)
            .limit(limit)
            .await
            .map_err(|e| ProviderError::new(format!("Failed to query collection: {}", e)))?;

        let mut rows: Vec<Vec<serde_json::Value>> = Vec::new();
        let mut all_columns_set: HashSet<String> = HashSet::new();
        let mut all_columns_order: Vec<String> = Vec::new();

        // First pass: collect all documents and track all field names
        let mut documents: Vec<Document> = Vec::new();

        use futures_util::StreamExt;
        while let Some(result) = cursor.next().await {
            match result {
                Ok(doc) => {
                    for key in doc.keys() {
                        if !all_columns_set.contains(key) {
                            all_columns_set.insert(key.clone());
                            all_columns_order.push(key.clone());
                        }
                    }
                    documents.push(doc);
                }
                Err(e) => {
                    return Err(ProviderError::new(format!("Error reading document: {}", e)));
                }
            }
        }

        // Ensure _id is first if present
        let mut columns: Vec<String> = Vec::new();
        if all_columns_set.contains("_id") {
            columns.push("_id".to_string());
        }
        for col in all_columns_order {
            if col != "_id" {
                columns.push(col);
            }
        }

        // Second pass: convert documents to rows with consistent column order
        for doc in documents {
            let mut row: Vec<serde_json::Value> = Vec::new();
            for col in &columns {
                let value = doc
                    .get(col)
                    .map(Self::bson_to_json)
                    .unwrap_or(serde_json::Value::Null);
                row.push(value);
            }
            rows.push(row);
        }

        let row_count = rows.len();

        Ok(QueryResult {
            columns,
            rows,
            row_count,
        })
    }

    async fn execute_query(&self, _query: &str) -> Result<QueryResult, ProviderError> {
        // MongoDB doesn't support SQL queries directly
        // This would require implementing a MongoDB query parser or using aggregation pipelines
        Err(ProviderError::new(
            "Direct query execution is not supported for MongoDB. Use the data browser to explore collections.",
        ).with_hint("MongoDB uses its own query language. Support for MongoDB queries is coming soon."))
    }

    async fn get_table_count(&self, _schema: &str, table: &str) -> Result<i64, ProviderError> {
        self.get_collection_count(table).await
    }

    async fn insert_document(
        &self,
        collection: &str,
        document: &str,
    ) -> Result<String, ProviderError> {
        let db = self.get_database();
        let coll: Collection<Document> = db.collection(collection);

        // Parse the JSON document
        let doc: Document = serde_json::from_str(document)
            .map_err(|e| ProviderError::new(format!("Invalid JSON document: {}", e)))?;

        // Insert the document
        let result = coll
            .insert_one(doc)
            .await
            .map_err(|e| ProviderError::new(format!("Failed to insert document: {}", e)))?;

        // Return the inserted ID as a string
        let id = match result.inserted_id {
            Bson::ObjectId(oid) => oid.to_hex(),
            other => Self::bson_to_json(&other).to_string(),
        };

        Ok(id)
    }

    async fn update_document(
        &self,
        collection: &str,
        filter: &str,
        update: &str,
    ) -> Result<u64, ProviderError> {
        let db = self.get_database();
        let coll: Collection<Document> = db.collection(collection);

        // Parse the filter JSON
        let filter_doc: Document = serde_json::from_str(filter)
            .map_err(|e| ProviderError::new(format!("Invalid filter JSON: {}", e)))?;

        // Convert _id string to ObjectId if present
        let filter_doc = Self::convert_id_field(filter_doc)?;

        // Parse the update JSON
        let update_doc: Document = serde_json::from_str(update)
            .map_err(|e| ProviderError::new(format!("Invalid update JSON: {}", e)))?;

        // Wrap in $set if not already using update operators
        let update_doc = if update_doc.keys().any(|k| k.starts_with('$')) {
            update_doc
        } else {
            doc! { "$set": update_doc }
        };

        // Update the document
        let result = coll
            .update_one(filter_doc, update_doc)
            .await
            .map_err(|e| ProviderError::new(format!("Failed to update document: {}", e)))?;

        Ok(result.modified_count)
    }

    async fn delete_document(&self, collection: &str, filter: &str) -> Result<u64, ProviderError> {
        let db = self.get_database();
        let coll: Collection<Document> = db.collection(collection);

        // Parse the filter JSON
        let filter_doc: Document = serde_json::from_str(filter)
            .map_err(|e| ProviderError::new(format!("Invalid filter JSON: {}", e)))?;

        // Convert _id string to ObjectId if present
        let filter_doc = Self::convert_id_field(filter_doc)?;

        // Delete the document
        let result = coll
            .delete_one(filter_doc)
            .await
            .map_err(|e| ProviderError::new(format!("Failed to delete document: {}", e)))?;

        Ok(result.deleted_count)
    }
}

impl MongoDbProvider {
    /// Convert _id field from string to ObjectId if it looks like a valid ObjectId
    fn convert_id_field(mut doc: Document) -> Result<Document, ProviderError> {
        if let Some(id_value) = doc.get("_id") {
            if let Bson::String(id_str) = id_value {
                // Try to parse as ObjectId (24 hex characters)
                if id_str.len() == 24 {
                    if let Ok(oid) = ObjectId::parse_str(id_str) {
                        doc.insert("_id", Bson::ObjectId(oid));
                    }
                }
            }
        }
        Ok(doc)
    }
}
