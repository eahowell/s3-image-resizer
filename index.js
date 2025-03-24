import sharp from "sharp";
import S3 from "aws-sdk/clients/s3";

const bucketName = "cc-image-resizer";

exports.handler = async (event) => {
  // Read data from event object
  const region = event.Records[0].awsRegion;
  const sourceBucket = event.Records[0].s3.bucket.name;
  const sourceKey = event.Records[0].s3.object.key;
  const decodedSourceKey = decodeURIComponent(sourceKey.replace(/\+/g, " "));

  // Only process images in the original-images folder
  if (!decodedSourceKey.startsWith("original-images/")) {
    return { statusCode: 200, body: "File skipped" };
  }
  try {
    // Instantiate a new S3 client
    const s3 = new S3({
      region: region,
    });

    //  Get image from the source S3 bucket
    const image = await s3
      .getObject({
        Bucket: sourceBucket,
        Key: decodedSourceKey,
      })
      .promise();

    // Resize the image using sharp
    const resizedImage = await sharp(image.Body)
      .resize(300, 300, {
        fit: sharp.fit.inside,
        withoutEnlargement: true,
      })
      .toFormat("jpeg")
      .toBuffer();

    // Upload the resized image to resized-images folder in the same bucket
    const destinationKey = `resized-images/${decodedSourceKey
      .split("/")
      .pop()}`;
    await s3
      .putObject({
        Bucket: bucketName,
        Key: destinationKey,
        Body: resizedImage,
        ContentType: "image/jpeg",
      })
      .promise();
    return { statusCode: 200, body: "Image resized and uploaded successfully" };
  } catch (error) {
    console.error("Error processing image:", error);
    return { statusCode: 500, body: `Error resizing image: ${error.message}` };
  }
};
