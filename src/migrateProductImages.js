import { decode } from "base64-arraybuffer";
import { supabase } from "./lib/supabase";

const BUCKET = "product-images";

function readDataUrl(dataUrl) {
  const match = dataUrl.match(
    /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/
  );

  if (!match) return null;

  const mimeType = match[1];

  return {
    mimeType,
    base64: match[2],
    extension:
      mimeType === "image/jpeg"
        ? "jpg"
        : mimeType.split("/")[1] || "png"
  };
}

export async function migrateProductImages() {
  alert("Photo migration started. Please keep this page open.");

  try {
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError) throw userError;
    if (!user) throw new Error("Please log in first.");

    const { data: productList, error: listError } =
      await supabase
        .from("products")
        .select("id, name")
        .eq("user_id", user.id)
        .order("name");

    if (listError) throw listError;

    let migrated = 0;
    let skipped = 0;
    let failed = 0;

    for (const product of productList || []) {
      const { data, error: imageError } =
        await supabase
          .from("products")
          .select("image")
          .eq("id", product.id)
          .eq("user_id", user.id)
          .single();

      if (imageError) {
        console.error(product.name, imageError);
        failed += 1;
        continue;
      }

      if (
        !data?.image ||
        !data.image.startsWith("data:image/")
      ) {
        skipped += 1;
        continue;
      }

      const imageInfo = readDataUrl(data.image);

      if (!imageInfo) {
        failed += 1;
        continue;
      }

      const filePath =
        `${user.id}/${product.id}.${imageInfo.extension}`;

      const { error: uploadError } =
        await supabase.storage
          .from(BUCKET)
          .upload(
            filePath,
            decode(imageInfo.base64),
            {
              contentType: imageInfo.mimeType,
              cacheControl: "3600",
              upsert: true
            }
          );

      if (uploadError) {
        console.error(product.name, uploadError);
        failed += 1;
        continue;
      }

      const { data: publicUrlData } =
        supabase.storage
          .from(BUCKET)
          .getPublicUrl(filePath);

      const { error: updateError } =
        await supabase
          .from("products")
          .update({
            image: publicUrlData.publicUrl
          })
          .eq("id", product.id)
          .eq("user_id", user.id);

      if (updateError) {
        console.error(product.name, updateError);
        failed += 1;
        continue;
      }

      migrated += 1;
      console.log(`Migrated ${product.name}`);
    }

    alert(
      `Migration finished!\n\n` +
      `Migrated: ${migrated}\n` +
      `Skipped: ${skipped}\n` +
      `Failed: ${failed}`
    );
  } catch (error) {
    console.error("Migration failed:", error);

    alert(
      `Migration failed:\n\n${
        error.message || "Unknown error"
      }`
    );
  }
}