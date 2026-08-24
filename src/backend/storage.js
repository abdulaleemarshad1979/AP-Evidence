const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');

const LOCAL_OBJECT_DIR = path.join(__dirname, '../../data/object_store');
if (!fs.existsSync(LOCAL_OBJECT_DIR)) {
  fs.mkdirSync(LOCAL_OBJECT_DIR, { recursive: true });
}

class EvidenceStorageService {
  constructor() {
    this.bucket = process.env.MINIO_BUCKET || 'ap-evidence-vault';
    this.endpoint = process.env.MINIO_ENDPOINT || 'http://localhost:9000';
    this.accessKey = process.env.MINIO_ACCESS_KEY || 'minioadmin';
    this.secretKey = process.env.MINIO_SECRET_KEY || 'minioadmin';
    
    this.useS3 = Boolean(process.env.USE_REAL_S3 === 'true' || process.env.MINIO_ENDPOINT);

    if (this.useS3) {
      this.s3Client = new S3Client({
        endpoint: this.endpoint,
        region: 'us-east-1',
        credentials: {
          accessKeyId: this.accessKey,
          secretAccessKey: this.secretKey
        },
        forcePathStyle: true
      });
    }
  }

  /**
   * Save payload/stream to object storage and compute SHA-256 on the fly
   */
  async putObject(objectKey, dataBuffer, contentType = 'application/octet-stream') {
    const hash = crypto.createHash('sha256').update(dataBuffer).digest('hex');
    const byteSize = dataBuffer.length;
    const versionId = `v-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    if (this.useS3) {
      try {
        await this.s3Client.send(new PutObjectCommand({
          Bucket: this.bucket,
          Key: objectKey,
          Body: dataBuffer,
          ContentType: contentType
        }));
      } catch (err) {
        console.warn(`[S3 STORAGE] Upload failed to ${this.endpoint}, storing locally:`, err.message);
        const filePath = path.join(LOCAL_OBJECT_DIR, objectKey.replace(/\//g, '_'));
        fs.writeFileSync(filePath, dataBuffer);
      }
    } else {
      const filePath = path.join(LOCAL_OBJECT_DIR, objectKey.replace(/\//g, '_'));
      fs.writeFileSync(filePath, dataBuffer);
    }

    return {
      objectKey,
      sha256: hash,
      byteSize,
      versionId
    };
  }

  /**
   * Retrieve stored object bytes
   */
  async getObject(objectKey) {
    if (this.useS3) {
      try {
        const response = await this.s3Client.send(new GetObjectCommand({
          Bucket: this.bucket,
          Key: objectKey
        }));
        const byteArray = await response.Body.transformToByteArray();
        return Buffer.from(byteArray);
      } catch (err) {
        const filePath = path.join(LOCAL_OBJECT_DIR, objectKey.replace(/\//g, '_'));
        if (fs.existsSync(filePath)) {
          return fs.readFileSync(filePath);
        }
        throw new Error(`Failed to retrieve object '${objectKey}' from S3 or local store: ${err.message}`);
      }
    } else {
      const filePath = path.join(LOCAL_OBJECT_DIR, objectKey.replace(/\//g, '_'));
      if (!fs.existsSync(filePath)) {
        throw new Error(`Object '${objectKey}' not found in evidence vault`);
      }
      return fs.readFileSync(filePath);
    }
  }

  /**
   * Recompute SHA-256 by streaming actual stored bytes from MinIO/S3/local store
   */
  async verifyIntegrity(objectKey, expectedSha256) {
    const buffer = await this.getObject(objectKey);
    const recomputedHash = crypto.createHash('sha256').update(buffer).digest('hex');
    const matches = recomputedHash.toLowerCase() === expectedSha256.toLowerCase();
    return {
      integrityVerified: matches,
      recomputedHash,
      expectedSha256,
      byteSize: buffer.length
    };
  }
}

module.exports = new EvidenceStorageService();
