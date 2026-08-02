import { supabase } from "./lib/supabase";

export async function migrateProductImages() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    alert("Please log in first.");
    return;
  }

  const { data: products, error } = await supabase
    .from("products")
    .select("id,name,image")
    .eq("user_id", user.id);

  if (error) {
    console.error(error);
    return;
  }

  console.log(products);
  alert(
    `Found ${products.length} products.\nOpen the browser console (F12) to see them.`
  );
}