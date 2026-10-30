/** Minimal object storage abstraction so ingestion and API logic can be unit tested without S3. */
export interface StoredObject {
  body: string;
  etag: string;
}

export interface PutOptions {
  /** Only write if the current object still has this ETag (optimistic concurrency). */
  ifMatch?: string;
  /** Only write if the object does not exist yet (never overwrite). */
  ifNoneMatch?: "*";
  contentType?: string;
  cacheControl?: string;
}

export interface ObjectStore {
  /** Returns null when the object does not exist. */
  get(key: string): Promise<StoredObject | null>;
  /** Returns "not-modified" when the object's ETag still equals `etag`. */
  getIfChanged(key: string, etag: string): Promise<StoredObject | null | "not-modified">;
  /** Returns the new ETag. Throws PreconditionFailedError when a condition does not hold. */
  put(key: string, body: string, options?: PutOptions): Promise<string>;
}

export class PreconditionFailedError extends Error {
  constructor(key: string) {
    super(`Write precondition failed for ${key}`);
    this.name = "PreconditionFailedError";
  }
}

/** In-memory store used by tests and the local development server. */
export class MemoryObjectStore implements ObjectStore {
  readonly objects = new Map<string, StoredObject>();
  private version = 0;

  async get(key: string): Promise<StoredObject | null> {
    return this.objects.get(key) ?? null;
  }

  async getIfChanged(key: string, etag: string): Promise<StoredObject | null | "not-modified"> {
    const obj = this.objects.get(key);
    if (obj && obj.etag === etag) return "not-modified";
    return obj ?? null;
  }

  async put(key: string, body: string, options: PutOptions = {}): Promise<string> {
    const current = this.objects.get(key);
    if (options.ifNoneMatch === "*" && current) throw new PreconditionFailedError(key);
    if (options.ifMatch !== undefined && current?.etag !== options.ifMatch) throw new PreconditionFailedError(key);
    this.version += 1;
    const etag = `"v${this.version}"`;
    this.objects.set(key, { body, etag });
    return etag;
  }
}
