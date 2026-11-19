# Hosted listing-photo verification

This checklist is a future staging check, not evidence that hosted storage has been verified. Use only the isolated staging project and a test owner account, an owner-controlled test property, and synthetic image data. Never use production credentials or another person's private photos. The existing `listing-media` bucket serves listing photos publicly; do not upload documents, addresses or other private material to it.

1. Confirm the staging environment and signed-in test owner. Upload an expendable GPS-tagged JPEG to the test property using the normal owner flow. The automated fixture in `tests/unit/media-exif.test.ts` generates synthetic GPS metadata and does not use personal data. Do not paste credentials, image bytes or coordinates into issues.
2. Confirm the upload succeeds, the owner editor and published listing display the photo, and the response has the existing `{ data: { url } }` shape. An unauthenticated upload should fail. Verify the returned storage object name starts with the authenticated test user's ID followed by `/` and ends in `.webp`.
3. Download the returned public URL to a temporary local file. With project dependencies installed, inspect only metadata presence, not coordinates:

   ```sh
   node -e 'require("sharp")(process.argv[1]).metadata().then(m => console.log({format:m.format, exifPresent:!!m.exif, xmpPresent:!!m.xmp, orientationPresent:m.orientation !== undefined}))' /path/to/downloaded-test-photo.webp
   ```

   Expected: WebP, with EXIF, XMP and orientation metadata absent. Open the image to confirm it is correctly rotated and readable. If metadata remains, stop the check and report the finding privately to the project security team; do not attach the original photo or coordinates.
4. Try a non-image or unsupported image format, an animated image and an image larger than 3 MB using synthetic files. Confirm they are rejected and no unwanted object is added. Also confirm a different account cannot upload under the test owner's path; test only accounts and resources authorized for this drill.
5. Remove the disposable test listing and image using the normal authorized cleanup process. Record date, staging commit SHA, observed results and any discrepancies on the issue. Do not record the image, object URL containing credentials, account secrets or personal data.

The automated unit test runs the real Sharp pipeline with synthetic GPS EXIF, a real multipart request and a mocked storage boundary. It proves the transformation and handler behavior locally, not hosted bucket access or cross-account authorization. Run `npm test -- --run tests/unit/media-exif.test.ts` from the marketplace repository.
