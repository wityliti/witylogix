/**
 * MongoDB Connection Adapter
 * Provides connection management, querying, and document streaming for MongoDB
 * with automatic type conversion (ObjectId → string, Date → ISO, nested docs → JSON)
 */

/**
 * Represents a MongoDB ObjectId
 */
interface ObjectIdLike {
  _id?: string | { $oid: string };
  toString?(): string;
}

/**
 * MongoDB Adapter for data source operations
 */
export class MongoDBAdapter {
  private mongoUri: string;
  private connection: any = null;
  private db: any = null;

  /**
   * Initialize adapter with connection URI
   */
  constructor(mongoUri: string) {
    this.mongoUri = mongoUri;
  }

  /**
   * Establish connection to MongoDB
   */
  async connect(): Promise<void> {
    try {
      // Dynamically import mongodb to avoid compile-time dependency
      const { MongoClient } = await import("mongodb");
      const client = new MongoClient(this.mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: 10,
        minPoolSize: 2,
      });

      await client.connect();
      this.connection = client;
      this.db = client.db();
      console.log("[MongoDB] Connected successfully");
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`[MongoDB] Connection failed: ${msg}`);
    }
  }

  /**
   * Close MongoDB connection
   */
  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
      this.db = null;
      console.log("[MongoDB] Disconnected");
    }
  }

  /**
   * Get collection from database
   */
  getCollection(name: string): any {
    if (!this.db) {
      throw new Error("[MongoDB] Not connected");
    }
    return this.db.collection(name);
  }

  /**
   * Query collection with optional filter, returning async iterable of documents
   */
  async *query(
    collectionName: string,
    filter: Record<string, any> = {},
    options: any = {},
  ): AsyncIterableIterator<any> {
    const collection = this.getCollection(collectionName);
    const cursor = collection.find(filter, {
      batchSize: options.batchSize || 1000,
      ...options,
    });

    try {
      for await (const doc of cursor) {
        yield this.convertDocument(doc);
      }
    } finally {
      await cursor.close();
    }
  }

  /**
   * Get count of documents in collection
   */
  async count(
    collectionName: string,
    filter: Record<string, any> = {},
  ): Promise<number> {
    const collection = this.getCollection(collectionName);
    return await collection.countDocuments(filter);
  }

  /**
   * Get single document by query
   */
  async findOne(
    collectionName: string,
    filter: Record<string, any>,
  ): Promise<any | null> {
    const collection = this.getCollection(collectionName);
    const doc = await collection.findOne(filter);
    return doc ? this.convertDocument(doc) : null;
  }

  /**
   * Batch read documents with cursor
   * Returns documents in chunks
   */
  async *batchRead(
    collectionName: string,
    batchSize: number = 100,
    filter: Record<string, any> = {},
  ): AsyncIterableIterator<any[]> {
    const collection = this.getCollection(collectionName);
    const cursor = collection.find(filter, { batchSize });

    let batch: any[] = [];

    try {
      for await (const doc of cursor) {
        batch.push(this.convertDocument(doc));

        if (batch.length >= batchSize) {
          yield batch;
          batch = [];
        }
      }

      // Yield remaining documents
      if (batch.length > 0) {
        yield batch;
      }
    } finally {
      await cursor.close();
    }
  }

  /**
   * Get collection statistics
   */
  async getStats(collectionName: string): Promise<{
    count: number;
    size: number;
    avgDocSize: number;
  }> {
    const collection = this.getCollection(collectionName);
    const stats = await collection.stats();

    return {
      count: stats.count,
      size: stats.size,
      avgDocSize: stats.avgObjSize,
    };
  }

  /**
   * Convert MongoDB document to PostgreSQL-compatible format
   * - ObjectId → string
   * - Date → ISO string
   * - Nested objects → JSON
   * - Undefined → null
   */
  private convertDocument(doc: any): any {
    if (doc === null || doc === undefined) {
      return null;
    }

    if (typeof doc !== "object") {
      return doc;
    }

    if (Array.isArray(doc)) {
      return doc.map((item) => this.convertDocument(item));
    }

    // Handle MongoDB ObjectId
    if (doc._id) {
      const idValue = this.convertObjectId(doc._id);
      if (typeof idValue === "string") {
        doc.id = idValue;
      }
      // Keep original _id field for reference
      doc._id = idValue;
    }

    const converted: Record<string, any> = {};

    for (const [key, value] of Object.entries(doc)) {
      if (value === undefined) {
        converted[key] = null;
      } else if (value === null) {
        converted[key] = null;
      } else if (value instanceof Date) {
        // Convert Date to ISO string
        converted[key] = value.toISOString();
      } else if (typeof value === "object") {
        // Recursively convert nested objects
        if (this.isMongoDBObjectId(value)) {
          converted[key] = this.convertObjectId(value);
        } else if (Array.isArray(value)) {
          converted[key] = value.map((item) =>
            typeof item === "object" ? this.convertDocument(item) : item,
          );
        } else {
          converted[key] = this.convertDocument(value);
        }
      } else {
        converted[key] = value;
      }
    }

    return converted;
  }

  /**
   * Convert MongoDB ObjectId to string
   */
  private convertObjectId(id: any): string | any {
    if (!id) {
      return null;
    }

    // Handle native MongoDB ObjectId
    if (id.toString && typeof id.toString === "function") {
      return id.toString();
    }

    // Handle string representation
    if (typeof id === "string") {
      return id;
    }

    // Handle { $oid: "..." } format
    if (typeof id === "object" && id.$oid) {
      return id.$oid;
    }

    // Handle { _id: "..." } format
    if (typeof id === "object" && id._id) {
      return this.convertObjectId(id._id);
    }

    return id;
  }

  /**
   * Check if value is a MongoDB ObjectId
   */
  private isMongoDBObjectId(value: any): boolean {
    if (!value || typeof value !== "object") {
      return false;
    }

    // Check for native ObjectId
    if (value.constructor?.name === "ObjectId") {
      return true;
    }

    // Check for { $oid: ... } format
    if (value.$oid && Object.keys(value).length === 1) {
      return true;
    }

    return false;
  }

  /**
   * List all collections in database
   */
  async listCollections(): Promise<string[]> {
    if (!this.db) {
      throw new Error("[MongoDB] Not connected");
    }
    const collections = await this.db.listCollections().toArray();
    return collections.map((c: any) => c.name);
  }

  /**
   * Drop entire collection (destructive, for rollback)
   */
  async dropCollection(collectionName: string): Promise<boolean> {
    const collection = this.getCollection(collectionName);
    return await collection.drop();
  }

  /**
   * Check if connection is alive
   */
  async ping(): Promise<boolean> {
    try {
      if (this.db) {
        await this.db.admin().ping();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}

export default MongoDBAdapter;
