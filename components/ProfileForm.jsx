// components/ProfileForm.jsx
"use client";
import { useForm } from "react-hook-form";
import { createSupabaseBrowser } from "@/utils/supabase/client";

export default function ProfileForm({ profile }) {
  const supabase = createSupabaseBrowser();
  const { register, handleSubmit, watch, setValue } = useForm({
    defaultValues: { display_name: profile?.display_name ?? "", bio: profile?.bio ?? "" }
  });
  const avatarFile = watch("avatar_file");

  async function onSubmit(values) {
    let avatar_url = profile?.avatar_url;
    if (values.avatar_file?.[0]) {
      const file = values.avatar_file[0];
      const filePath = `${profile.id}/${crypto.randomUUID()}_${file.name}`;
      const { error } = await supabase.storage
        .from("profile-images")
        .upload(filePath, file, { upsert: true });
      if (error) return alert(error.message);
      avatar_url = filePath;
    }
    await supabase.from("profiles").upsert({ id: profile.id, ...values, avatar_url });
    // optimistic UI...
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* display_name, bio inputs ... */}
      <input type="file" accept="image/*" {...register("avatar_file")} />
      <button className="btn-primary">Save</button>
    </form>
  );
}
