"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabase";

function Toast({ message, type, onClose }) {
  if (!message) return null;

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-lg px-4 py-3 shadow-lg text-sm font-medium ${
        type === "success"
          ? "bg-green-600 text-white"
          : "bg-red-600 text-white"
      }`}
      role="status"
    >
      <span>{message}</span>
      <button
        type="button"
        onClick={onClose}
        className="opacity-80 hover:opacity-100"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}

function FieldRow({ label, children }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 py-3 border-b border-gray-100 last:border-0">
      <dt className="text-sm font-medium text-gray-500 sm:pt-2">{label}</dt>
      <dd className="sm:col-span-2 text-gray-900">{children}</dd>
    </div>
  );
}

const emptyForm = {
  fullName: "",
  phone: "",
  bio: "",
  storeName: "",
  city: "",
  upazilla: "",
  lat: "",
  lng: "",
  avatarUrl: "",
};

export default function ProfileSection() {
  const [email, setEmail] = useState("");
  const [sellerCode, setSellerCode] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [savedForm, setSavedForm] = useState(emptyForm);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState({ message: "", type: "success" });

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    window.setTimeout(() => setToast({ message: "", type }), 4000);
  }, []);

  const profileToForm = (profile) => ({
    fullName: profile.fullName ?? "",
    phone: profile.phone ?? "",
    bio: profile.bio ?? "",
    storeName: profile.storeName ?? "",
    city: profile.city ?? "",
    upazilla: profile.upazilla ?? "",
    lat: profile.lat != null ? String(profile.lat) : "",
    lng: profile.lng != null ? String(profile.lng) : "",
    avatarUrl: profile.avatarUrl ?? "",
  });

  const loadProfile = useCallback(async (isMounted: boolean = true) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/seller/profile");
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load profile");
      }

      if (isMounted) {
        const nextForm = profileToForm(data.profile);
        setForm(nextForm);
        setSavedForm(nextForm);
        setEmail(data.email ?? "");
        setSellerCode(data.profile.sellerCode ?? "");
        setAvatarPreview(data.profile.avatarUrl || null);
      }
    } catch (err) {
      if (isMounted) setError(err instanceof Error ? err.message : "Failed to load profile");
    } finally {
      if (isMounted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    loadProfile(isMounted);
    return () => { isMounted = false; };
  }, [loadProfile]);

  const setField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCancel = () => {
    setForm(savedForm);
    setAvatarPreview(savedForm.avatarUrl || null);
    setEditing(false);
  };

  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      showToast("Geolocation is not supported in this browser", "error");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setField("lat", String(position.coords.latitude));
        setField("lng", String(position.coords.longitude));
      },
      () => {
        showToast("Could not get your location. Check browser permissions.", "error");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast("Please select an image file", "error");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast("Image must be under 5MB", "error");
      return;
    }

    setUploadingAvatar(true);
    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);

    try {
      const {
        data: { user },
      } = await supabaseClient.auth.getUser();

      if (!user) {
        throw new Error("You must be signed in to upload a photo");
      }

      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabaseClient.storage
        .from("seller-avatars")
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const {
        data: { publicUrl },
      } = supabaseClient.storage.from("seller-avatars").getPublicUrl(path);

      setField("avatarUrl", publicUrl);
      setAvatarPreview(publicUrl);
      URL.revokeObjectURL(previewUrl);
    } catch (err) {
      setAvatarPreview(savedForm.avatarUrl || null);
      showToast(
        err instanceof Error ? err.message : "Avatar upload failed",
        "error"
      );
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        fullName: form.fullName,
        phone: form.phone,
        bio: form.bio,
        storeName: form.storeName,
        city: form.city,
        upazilla: form.upazilla,
        lat: parseFloat(form.lat),
        lng: parseFloat(form.lng),
        avatarUrl: form.avatarUrl || null,
      };

      const res = await fetch("/api/seller/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save profile");
      }

      const nextForm = profileToForm(data.profile);
      setForm(nextForm);
      setSavedForm(nextForm);
      setSellerCode(data.profile.sellerCode ?? sellerCode);
      setAvatarPreview(data.profile.avatarUrl || null);
      setEditing(false);
      showToast("Profile updated successfully", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to save profile",
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  const copySellerCode = async () => {
    if (!sellerCode) return;
    try {
      await navigator.clipboard.writeText(sellerCode);
      showToast("Seller code copied to clipboard", "success");
    } catch {
      showToast("Could not copy to clipboard", "error");
    }
  };

  const inputClass =
    "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-orange-500 text-gray-900";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-700 mb-4">{error}</p>
        <button
          type="button"
          onClick={() => loadProfile()}
          className="text-orange-600 font-medium hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <section className="bg-white rounded-lg shadow-sm border border-gray-200">
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: "", type: "success" })}
      />

      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">Store Profile</h2>
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-md hover:bg-orange-600 transition"
          >
            Edit Profile
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCancel}
              disabled={saving}
              className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || uploadingAvatar}
              className="px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-md hover:bg-orange-600 disabled:bg-gray-400 flex items-center gap-2"
            >
              {saving && (
                <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        )}
      </div>

      <dl className="px-6 py-2">
        <FieldRow label="Full Name">
          {editing ? (
            <input
              type="text"
              value={form.fullName}
              onChange={(e) => setField("fullName", e.target.value)}
              className={inputClass}
              placeholder="Your full name"
            />
          ) : (
            <span>{form.fullName || "—"}</span>
          )}
        </FieldRow>

        <FieldRow label="Email">
          <span className="text-gray-600">{email || "—"}</span>
        </FieldRow>

        <FieldRow label="Phone">
          {editing ? (
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setField("phone", e.target.value)}
              className={inputClass}
              placeholder="01XXXXXXXXX"
            />
          ) : (
            <span>{form.phone || "—"}</span>
          )}
        </FieldRow>

        <FieldRow label="Profile Photo">
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <div className="h-20 w-20 rounded-full bg-gray-100 border border-gray-200 overflow-hidden flex-shrink-0">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Profile"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-gray-400 text-xs">
                  No photo
                </div>
              )}
            </div>
            {editing && (
              <div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  disabled={uploadingAvatar}
                  className="text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-orange-50 file:text-orange-700 file:font-medium hover:file:bg-orange-100"
                />
                {uploadingAvatar && (
                  <p className="text-xs text-gray-500 mt-1">Uploading...</p>
                )}
              </div>
            )}
          </div>
        </FieldRow>

        <FieldRow label="Store Name">
          {editing ? (
            <input
              type="text"
              value={form.storeName}
              onChange={(e) => setField("storeName", e.target.value)}
              className={inputClass}
              required
            />
          ) : (
            <span className="font-medium">{form.storeName || "—"}</span>
          )}
        </FieldRow>

        <FieldRow label="City">
          {editing ? (
            <input
              type="text"
              value={form.city}
              onChange={(e) => setField("city", e.target.value)}
              className={inputClass}
              required
            />
          ) : (
            <span>{form.city || "—"}</span>
          )}
        </FieldRow>

        <FieldRow label="Upazilla">
          {editing ? (
            <input
              type="text"
              value={form.upazilla}
              onChange={(e) => setField("upazilla", e.target.value)}
              className={inputClass}
              required
            />
          ) : (
            <span>{form.upazilla || "—"}</span>
          )}
        </FieldRow>

        <FieldRow label="Location (Lat / Lng)">
          {editing ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={form.lat}
                    onChange={(e) => setField("lat", e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={form.lng}
                    onChange={(e) => setField("lng", e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleUseLocation}
                className="text-sm text-orange-600 font-medium hover:text-orange-700"
              >
                Use My Location
              </button>
            </div>
          ) : (
            <span>
              {form.lat && form.lng
                ? `${form.lat}, ${form.lng}`
                : "—"}
            </span>
          )}
        </FieldRow>

        <FieldRow label="Bio / Store Description">
          {editing ? (
            <textarea
              value={form.bio}
              onChange={(e) => setField("bio", e.target.value)}
              rows={4}
              className={inputClass}
              placeholder="Tell customers about your store..."
            />
          ) : (
            <p className="whitespace-pre-wrap text-gray-700">
              {form.bio || "—"}
            </p>
          )}
        </FieldRow>
      </dl>

      <div className="mx-6 mb-6 mt-2 rounded-lg border-2 border-dashed border-orange-200 bg-orange-50 px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-orange-700">
              Your Seller Code
            </p>
            <p className="text-2xl font-bold text-gray-900 tracking-widest mt-1 font-mono">
              {sellerCode || "—"}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              Used when generating product QR codes
            </p>
          </div>
          <button
            type="button"
            onClick={copySellerCode}
            disabled={!sellerCode}
            className="px-4 py-2 bg-white border border-orange-300 text-orange-700 text-sm font-medium rounded-md hover:bg-orange-100 disabled:opacity-50 transition"
          >
            Copy Code
          </button>
        </div>
      </div>
    </section>
  );
}
