import { randomUUID } from "crypto";
import path from "path";
import { S3Client, DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const region = process.env.AWS_REGION;
const bucket = process.env.AWS_S3_BUCKET;
const prefix = String(process.env.AWS_S3_REFERENCIAS_PREFIX || "maquinas/referencias").replace(/^\/+|\/+$/g, "");

const s3Client = new S3Client({ region });

function sanitizeSegment(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function extensionFromFile(file) {
  const original = sanitizeSegment(path.extname(file?.originalname || ""));
  if (original) return original.toLowerCase();

  const mime = String(file?.mimetype || "").toLowerCase();
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/png") return ".png";
  if (mime === "image/webp") return ".webp";
  return "";
}

export function buildReferenciaKey({ tipoMaquinaId, file }) {
  const suffix = extensionFromFile(file);
  return `${prefix}/tipo-${tipoMaquinaId}/${Date.now()}-${randomUUID()}${suffix}`;
}

function assertS3Config() {
  if (!region) {
    throw new Error("AWS_REGION no configurado");
  }

  if (!bucket) {
    throw new Error("AWS_S3_BUCKET no configurado");
  }
}

export async function uploadReferenciaToS3({ key, body, contentType }) {
  assertS3Config();

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

export async function deleteReferenciaFromS3(key) {
  assertS3Config();

  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
}

export async function getReferenciaSignedUrl(key, expiresIn = 60 * 60 * 6) {
  assertS3Config();

  return getSignedUrl(
    s3Client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
    { expiresIn }
  );
}
