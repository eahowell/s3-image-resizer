import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import sharp from "sharp";

const bucketName = "cc-image-resizer";
const s3 = new S3Client({ region: "us-east-1" });

// Helper function to convert stream to buffer
const streamToBuffer = (stream) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });

export const handler = async (event) => {
  const region = event.Records[0].awsRegion;
  const sourceBucket = event.Records[0].s3.bucket.name;
  const sourceKey = event.Records[0].s3.object.key;
  const decodedSourceKey = decodeURIComponent(sourceKey.replace(/\+/g, " "));
  console.log(`Decoded S3 key: ${decodedSourceKey}`);

  try {
    console.log(`Fetching image from bucket: ${sourceBucket}`);
    const image = await s3.send(
      new GetObjectCommand({
        Bucket: sourceBucket,
        Key: decodedSourceKey,
      })
    );

    if (!image.ContentLength === 0) {
      console.log("Image data read successfully");
    }

    // Convert the stream to a buffer
    const imageBuffer = await streamToBuffer(image.Body);

    // Resize the image using sharp
    console.log("Resizing image...");
    const resizedImage = await sharp(imageBuffer)
      .rotate()
      .resize(300, 300, { fit: sharp.fit.inside, withoutEnlargement: true })
      .toBuffer();
    // Upload the resized image using the PutObjectCommand
    const destinationKey = `resized-images/${decodedSourceKey
      .split("/")
      .pop()}`;
    console.log(`Uploading resized image...`);
    await s3.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: destinationKey,
        Body: resizedImage,
        ContentType: "image/jpeg",
      })
    );
    console.log("Successfully uploaded");

    return { statusCode: 200, body: "Image resized and uploaded successfully" };
  } catch (error) {
    console.error("Error processing image:", error);
    return { statusCode: 500, body: `Error resizing image: ${error.message}` };
  }
};
