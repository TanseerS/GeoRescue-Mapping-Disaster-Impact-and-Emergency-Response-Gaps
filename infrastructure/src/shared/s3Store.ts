import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { PreconditionFailedError, type ObjectStore, type PutOptions, type StoredObject } from "./storage";

function statusOf(err: unknown): number | undefined {
  return (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
}

function isMissing(err: unknown): boolean {
  const name = (err as { name?: string })?.name;
  return name === "NoSuchKey" || name === "NotFound" || statusOf(err) === 404;
}

/** S3-backed ObjectStore using conditional reads and writes. */
export class S3ObjectStore implements ObjectStore {
  constructor(
    private readonly bucket: string,
    private readonly client: S3Client = new S3Client({}),
  ) {}

  private async read(key: string, ifNoneMatch?: string): Promise<StoredObject | null | "not-modified"> {
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key, IfNoneMatch: ifNoneMatch }));
      const body = (await res.Body?.transformToString("utf-8")) ?? "";
      return { body, etag: res.ETag ?? "" };
    } catch (err) {
      if (statusOf(err) === 304) return "not-modified";
      if (isMissing(err)) return null;
      throw err;
    }
  }

  async get(key: string): Promise<StoredObject | null> {
    const result = await this.read(key);
    return result === "not-modified" ? null : result;
  }

  getIfChanged(key: string, etag: string) {
    return this.read(key, etag);
  }

  async put(key: string, body: string, options: PutOptions = {}): Promise<string> {
    try {
      const res = await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: options.contentType ?? "application/json",
          CacheControl: options.cacheControl,
          IfMatch: options.ifMatch,
          IfNoneMatch: options.ifNoneMatch,
        }),
      );
      return res.ETag ?? "";
    } catch (err) {
      // 412: condition not met. 409: a concurrent conditional write to the same key won the race.
      const status = statusOf(err);
      if (status === 412 || status === 409) throw new PreconditionFailedError(key);
      throw err;
    }
  }
}
