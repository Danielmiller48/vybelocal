"use client";

import { useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();

  /* ---------- local state ---------- */
  const [name,     setName]     = useState("");
  const [email,    setEmail]    = useState("");
  const [phone,    setPhone]    = useState("");
  const [password, setPassword] = useState("");

  const [errors,   setErrors]   = useState({});
  const [loading,  setLoading]  = useState(false);
  const [done,     setDone]     = useState(false);   // show “check your inbox” banner

  /* ---------- tiny helpers ---------- */
  const formatPhone = (v) => {
    const d = v.replace(/\D/g, "").slice(0, 10);
    if (d.length < 4) return d;
    if (d.length < 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
    return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  };

  const validate = () => {
    const err = {};
    if (!name.trim())                       err.name     = "Name is required";
    if (!/^\S+@\S+\.\S+$/.test(email))       err.email    = "Valid email required";
    if (!/^\d{3}-\d{3}-\d{4}$/.test(phone))  err.phone    = "Use XXX-XXX-XXXX";
    if (password.length < 8)                err.password = "Min 8 characters";
    setErrors(err);
    return Object.keys(err).length === 0;
  };

  /* ---------- submit ---------- */
  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setErrors({});

    /* 1-step sign-up (v2 SDK) */
    const { error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        // 👉 after e-mail click, send user to /login?verified=1
        emailRedirectTo: `${window.location.origin}/login?verified=1`,
        data: { name, phone },
      },
    });

    setLoading(false);

    if (error) {
      setErrors({ submit: error.message });
    } else {
      setDone(true);         // swap form for inbox instructions
    }
  }

  /* ---------- UI ---------- */
  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="p-8 bg-white rounded-xl shadow text-center space-y-4">
          <h1 className="text-2xl font-bold">Almost there!</h1>
          <p>Check your inbox and tap the confirmation link.</p>
          <button
            onClick={() => router.push("/login")}
            className="mt-4 text-blue-600 underline"
          >
            Go to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md p-8 bg-white rounded-xl shadow space-y-5"
      >
        <h1 className="text-2xl font-bold text-center">Create account</h1>

        {errors.submit && (
          <p className="text-red-500 text-center">{errors.submit}</p>
        )}

        {/* name */}
        <input
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`w-full border rounded px-3 py-2 ${
            errors.name ? "border-red-500" : "border-gray-300"
          }`}
        />

        {/* email */}
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={`w-full border rounded px-3 py-2 ${
            errors.email ? "border-red-500" : "border-gray-300"
          }`}
        />

        {/* phone */}
        <input
          placeholder="123-456-7890"
          value={phone}
          onChange={(e) => setPhone(formatPhone(e.target.value))}
          className={`w-full border rounded px-3 py-2 ${
            errors.phone ? "border-red-500" : "border-gray-300"
          }`}
        />

        {/* password */}
        <input
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={`w-full border rounded px-3 py-2 ${
            errors.password ? "border-red-500" : "border-gray-300"
          }`}
        />

        <button
          type="submit"
          disabled={loading}
          className={`w-full py-2 text-white rounded ${
            loading
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {loading ? "Creating…" : "Create Account"}
        </button>

        <p className="text-center text-sm text-gray-500">
          Already verified?{" "}
          <a href="/login" className="text-blue-600 underline">
            Log in
          </a>
        </p>
      </form>
    </div>
  );
}
