import { Pool, PoolClient, types } from "pg"

// Parse PostgreSQL arrays properly (they come as strings like "{value1,value2}")
// This handles enum arrays and text arrays
const parseArray = (value: string): string[] => {
  if (!value || value === '{}') return []
  // Remove braces and split, handling quoted values
  const inner = value.slice(1, -1)
  if (!inner) return []
  // Simple split for unquoted enum values
  return inner.split(',').map(s => s.replace(/^"|"$/g, ''))
}

// Register parser for common array types
// 1009 = text[], 1015 = varchar[], and custom enum arrays typically use the same format
types.setTypeParser(1009 as number, parseArray)  // text[]
types.setTypeParser(1015 as number, parseArray)  // varchar[]

// Validate required environment variables
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required")
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

// Log pool errors
pool.on("error", (err) => {
  console.error("Unexpected database pool error:", err)
})

// Register parsers for custom enum array types (their OIDs are dynamically generated)
let enumArrayParsersRegistered = false
async function registerEnumArrayParsers(client: PoolClient): Promise<void> {
  if (enumArrayParsersRegistered) return
  try {
    // Query all enum array type OIDs
    const result = await client.query(`
      SELECT t.typarray as oid
      FROM pg_type t
      JOIN pg_namespace n ON t.typnamespace = n.oid
      WHERE t.typtype = 'e' AND t.typarray != 0 AND n.nspname = 'public'
    `)
    for (const row of result.rows) {
      types.setTypeParser(row.oid as number, parseArray)
    }
    enumArrayParsersRegistered = true
  } catch {
    // Silently fail - will retry on next query
  }
}

export class DatabaseError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error,
    public readonly query?: string
  ) {
    super(message)
    this.name = "DatabaseError"
  }
}

export async function query<T = unknown>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  let client: PoolClient | null = null
  try {
    client = await pool.connect()
    // Register enum array parsers on first query (finds all enum[] types dynamically)
    await registerEnumArrayParsers(client)
    const result = await client.query(text, params)
    return result.rows as T[]
  } catch (error) {
    const dbError = new DatabaseError(
      `Database query failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      error instanceof Error ? error : undefined,
      text
    )
    console.error("Database error:", {
      message: dbError.message,
      query: text.substring(0, 100),
      params: params?.length,
    })
    throw dbError
  } finally {
    if (client) {
      client.release()
    }
  }
}

export async function queryOne<T = unknown>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, params)
  return rows[0] || null
}

export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    const result = await callback(client)
    await client.query("COMMIT")
    return result
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

export default pool
