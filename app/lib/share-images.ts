import crypto from "node:crypto";
import { Binary } from "mongodb";
import { getMongoDb } from "./mongodb";

const SHARE_IMAGE_TTL_MS = 10 * 60 * 1000;
const SHARE_IMAGES_COLLECTION = process.env.SHARE_IMAGES_COLLECTION ?? "shareimages";

type ShareImage = {
  bytes: Buffer;
  contentType: string;
};

type ShareImageDocument = {
  _id: string;
  bytes: Binary;
  contentType: string;
  expiresAt: Date;
};

let indexPromise: Promise<string> | undefined;

async function getShareImagesCollection() {
  const db = await getMongoDb();
  const collection = db.collection<ShareImageDocument>(SHARE_IMAGES_COLLECTION);

  indexPromise ??= collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await indexPromise;

  return collection;
}

export async function saveShareImage(file: File) {
  const id = crypto.randomUUID();
  const bytes = Buffer.from(await file.arrayBuffer());
  const collection = await getShareImagesCollection();

  await collection.insertOne({
    _id: id,
    bytes: new Binary(bytes),
    contentType: file.type || "image/png",
    expiresAt: new Date(Date.now() + SHARE_IMAGE_TTL_MS)
  });

  return id;
}

export async function getShareImage(id: string): Promise<ShareImage | undefined> {
  const collection = await getShareImagesCollection();
  const image = await collection.findOne({
    _id: id,
    expiresAt: { $gt: new Date() }
  });

  if (!image) {
    return undefined;
  }

  return {
    bytes: Buffer.from(image.bytes.buffer),
    contentType: image.contentType
  };
}
