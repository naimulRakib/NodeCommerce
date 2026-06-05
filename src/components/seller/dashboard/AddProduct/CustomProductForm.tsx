"use client";

import { useState } from "react";
import { supabaseClient } from "@/lib/supabase";
import { CATEGORIES } from "@/data/categories";

const COUNTRIES = [
  "Bangladesh", "India", "China", "Vietnam", "Pakistan", 
  "USA", "UK", "Japan", "South Korea", "Thailand", 
  "Malaysia", "Indonesia", "Taiwan", "Germany", "Italy", 
  "France", "Turkey", "UAE", "Saudi Arabia", "Sri Lanka"
];

export default function CustomProductForm({ onSubmit, onBack, initialData = null }) {
  const [form, setForm] = useState({
    customName: initialData?.customName || "",
    brand: initialData?.brand || "",
    category: initialData?.category || "",
    subCategory: initialData?.subCategory || "",
    description: initialData?.description || "",
    features: initialData?.features || [""],
    images: initialData?.images || [], // URLs
    weight: initialData?.weight || "",
    weightUnit: initialData?.weightUnit || "g",
    length: initialData?.length || "",
    width: initialData?.width || "",
    height: initialData?.height || "",
    origin: initialData?.origin || "",
    sku: initialData?.sku || "",
    tags: initialData?.tags || [],
    stock: initialData?.stock || "",
    price: initialData?.price || "",
  });

  const [tagInput, setTagInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<any>({});

  const setField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    // Clear error when user types
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const handleAddFeature = () => {
    if (form.features.length < 5) {
      setForm(prev => ({ ...prev, features: [...prev.features, ""] }));
    }
  };

  const handleFeatureChange = (index, value) => {
    const newFeatures = [...form.features];
    newFeatures[index] = value;
    setField("features", newFeatures);
  };

  const handleRemoveFeature = (index) => {
    const newFeatures = form.features.filter((_, i) => i !== index);
    setField("features", newFeatures);
  };

  const handleTagKeyDown = (e) => {
    if (e.key === "," || e.key === "Enter") {
      e.preventDefault();
      const val = tagInput.trim().replace(/,/g, "");
      if (val && !form.tags.includes(val)) {
        setField("tags", [...form.tags, val]);
      }
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag) => {
    setField("tags", form.tags.filter(t => t !== tag));
  };

  const handleImageUpload = async (e) => {
    const files: any[] = Array.from(e.target.files);
    if (!files.length) return;

    if (form.images.length + files.length > 5) {
      alert("You can only upload up to 5 images in total.");
      return;
    }

    setUploading(true);
    const uploadedUrls = [];

    try {
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (!user) throw new Error("Must be logged in to upload images");

      for (const file of files) {
        if (!file.type.startsWith("image/")) continue;
        const ext = file.name.split(".").pop();
        const path = `${user.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
        
        const { error } = await supabaseClient.storage
          .from("product-images")
          .upload(path, file);
          
        if (error) throw error;

        const { data: { publicUrl } } = supabaseClient.storage
          .from("product-images")
          .getPublicUrl(path);
          
        uploadedUrls.push(publicUrl);
      }
      
      setField("images", [...form.images, ...uploadedUrls]);
    } catch (err) {
      console.error(err);
      alert("Failed to upload images. Please try again.");
    } finally {
      setUploading(false);
      e.target.value = null; // reset input
    }
  };

  const handleRemoveImage = (index) => {
    const newImages = form.images.filter((_, i) => i !== index);
    setField("images", newImages);
  };

  const validate = () => {
    const newErrors: any = {};
    if (!form.customName.trim()) newErrors.customName = "Product Name is required.";
    else if (form.customName.length > 200) newErrors.customName = "Name cannot exceed 200 characters.";
    
    if (!form.brand.trim()) newErrors.brand = "Brand is required.";
    if (!form.category) newErrors.category = "Category is required.";
    
    if (!form.description.trim()) newErrors.description = "Description is required.";
    else if (form.description.length < 50) newErrors.description = "Description must be at least 50 characters.";
    else if (form.description.length > 2000) newErrors.description = "Description cannot exceed 2000 characters.";

    if (!form.stock || Number(form.stock) < 1) newErrors.stock = "Valid stock quantity is required.";
    if (!form.price || Number(form.price) < 1) newErrors.price = "Valid base price is required.";

    setErrors(newErrors);
    
    // Scroll to first error
    if (Object.keys(newErrors).length > 0) {
      const firstError = document.querySelector(".error-text");
      if (firstError) firstError.scrollIntoView({ behavior: "smooth", block: "center" });
      return false;
    }
    return true;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(form);
    }
  };

  return (
    <div className="max-w-3xl mx-auto bg-white rounded-md shadow-sm border border-gray-200 p-6">
      <div className="flex items-center mb-6 border-b pb-4">
        <button
          type="button"
          onClick={onBack}
          className="mr-4 text-gray-500 hover:text-gray-900"
        >
          ← Back
        </button>
        <h2 className="text-2xl font-bold text-gray-900">Product Details</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Info */}
        <section>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Basic Info</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Product Name*</label>
              <input
                type="text"
                value={form.customName}
                onChange={(e) => setField("customName", e.target.value)}
                className={`w-full border rounded-md px-3 py-2 focus:ring-orange-500 focus:border-orange-500 ${errors.customName ? "border-red-500" : "border-gray-300"}`}
                maxLength={200}
              />
              <div className="flex justify-between mt-1">
                {errors.customName ? (
                  <p className="text-xs text-red-500 error-text">{errors.customName}</p>
                ) : <span />}
                <p className="text-xs text-gray-500">{form.customName.length}/200</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Brand*</label>
                <input
                  type="text"
                  value={form.brand}
                  onChange={(e) => setField("brand", e.target.value)}
                  className={`w-full border rounded-md px-3 py-2 focus:ring-orange-500 focus:border-orange-500 ${errors.brand ? "border-red-500" : "border-gray-300"}`}
                />
                {errors.brand && <p className="text-xs text-red-500 mt-1 error-text">{errors.brand}</p>}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category*</label>
                <select
                  value={form.category}
                  onChange={(e) => setField("category", e.target.value)}
                  className={`w-full border rounded-md px-3 py-2 focus:ring-orange-500 focus:border-orange-500 bg-white ${errors.category ? "border-red-500" : "border-gray-300"}`}
                >
                  <option value="">Select Category</option>
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                {errors.category && <p className="text-xs text-red-500 mt-1 error-text">{errors.category}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sub-category (Optional)</label>
              <input
                type="text"
                value={form.subCategory}
                onChange={(e) => setField("subCategory", e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
          </div>
        </section>

        {/* Description */}
        <section>
          <h3 className="text-lg font-semibold text-gray-800 mb-4 border-t pt-6">Description</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Detailed Description*</label>
              <textarea
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                rows={5}
                className={`w-full border rounded-md px-3 py-2 focus:ring-orange-500 focus:border-orange-500 ${errors.description ? "border-red-500" : "border-gray-300"}`}
                maxLength={2000}
              />
              <div className="flex justify-between mt-1">
                {errors.description ? (
                  <p className="text-xs text-red-500 error-text">{errors.description}</p>
                ) : <span />}
                <p className="text-xs text-gray-500">{form.description.length}/2000</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Key Features (Up to 5)</label>
              <div className="space-y-2">
                {form.features.map((feature, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <span className="text-gray-400">•</span>
                    <input
                      type="text"
                      value={feature}
                      onChange={(e) => handleFeatureChange(idx, e.target.value)}
                      className="flex-1 border border-gray-300 rounded-md px-3 py-1 text-sm focus:ring-orange-500 focus:border-orange-500"
                      placeholder="e.g. 1 Year Official Warranty"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveFeature(idx)}
                      className="text-gray-400 hover:text-red-500"
                      title="Remove"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              {form.features.length < 5 && (
                <button
                  type="button"
                  onClick={handleAddFeature}
                  className="mt-2 text-sm text-blue-600 hover:underline font-medium"
                >
                  + Add Feature
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Media */}
        <section>
          <h3 className="text-lg font-semibold text-gray-800 mb-4 border-t pt-6">Media</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Product Images (Max 5)</label>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {form.images.map((url, idx) => (
                <div key={idx} className="relative w-24 h-24 flex-shrink-0 border rounded-md group">
                  <img src={url} alt="" className="w-full h-full object-cover rounded-md" />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(idx)}
                    className="absolute top-1 right-1 bg-white bg-opacity-75 text-red-500 rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
                  >
                    ×
                  </button>
                </div>
              ))}
              {form.images.length < 5 && (
                <label className="w-24 h-24 flex-shrink-0 border-2 border-dashed border-gray-300 rounded-md flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 hover:border-orange-400 transition-colors">
                  <span className="text-gray-400 text-2xl">+</span>
                  <span className="text-xs text-gray-500 mt-1">Upload</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={uploading}
                  />
                </label>
              )}
            </div>
            {uploading && <p className="text-sm text-blue-600 mt-2">Uploading images...</p>}
          </div>
        </section>

        {/* Physical Details */}
        <section>
          <h3 className="text-lg font-semibold text-gray-800 mb-4 border-t pt-6">Physical Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Weight</label>
              <div className="flex">
                <input
                  type="number"
                  step="any"
                  value={form.weight}
                  onChange={(e) => setField("weight", e.target.value)}
                  className="w-full border-y border-l border-gray-300 rounded-l-md px-3 py-2 focus:ring-orange-500 focus:border-orange-500"
                />
                <select
                  value={form.weightUnit}
                  onChange={(e) => setField("weightUnit", e.target.value)}
                  className="border border-gray-300 rounded-r-md bg-gray-50 px-2 text-gray-700 focus:ring-orange-500 focus:border-orange-500"
                >
                  <option value="g">g</option>
                  <option value="kg">kg</option>
                  <option value="lb">lb</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dimensions (L x W x H in cm)</label>
              <div className="flex gap-2">
                <input type="number" placeholder="L" value={form.length} onChange={e => setField("length", e.target.value)} className="w-1/3 border border-gray-300 rounded-md px-2 py-2 text-center" />
                <input type="number" placeholder="W" value={form.width} onChange={e => setField("width", e.target.value)} className="w-1/3 border border-gray-300 rounded-md px-2 py-2 text-center" />
                <input type="number" placeholder="H" value={form.height} onChange={e => setField("height", e.target.value)} className="w-1/3 border border-gray-300 rounded-md px-2 py-2 text-center" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Country of Origin</label>
              <select
                value={form.origin}
                onChange={(e) => setField("origin", e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="">Select Country</option>
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </section>

        {/* Other */}
        <section>
          <h3 className="text-lg font-semibold text-gray-800 mb-4 border-t pt-6">Other</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SKU / Barcode (Optional)</label>
              <input
                type="text"
                value={form.sku}
                onChange={(e) => setField("sku", e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma separated)</label>
              <div className="border border-gray-300 rounded-md p-2 flex flex-wrap gap-2 min-h-[42px] focus-within:border-orange-500 focus-within:ring-1 focus-within:ring-orange-500 bg-white">
                {form.tags.map(tag => (
                  <span key={tag} className="bg-gray-100 text-gray-700 px-2 py-1 rounded-sm text-xs flex items-center gap-1 border">
                    {tag}
                    <button type="button" onClick={() => handleRemoveTag(tag)} className="hover:text-red-500">×</button>
                  </span>
                ))}
                <input
                  type="text"
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  placeholder={form.tags.length === 0 ? "e.g. fast charge, wireless..." : ""}
                  className="flex-1 outline-none text-sm min-w-[100px] bg-transparent"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Pricing & Stock */}
        <section className="bg-gray-50 -mx-6 px-6 py-6 border-t mt-8 rounded-b-md">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Pricing & Stock</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stock Quantity*</label>
              <input
                type="number"
                min="1"
                value={form.stock}
                onChange={(e) => setField("stock", e.target.value)}
                className={`w-full border rounded-md px-3 py-2 focus:ring-orange-500 focus:border-orange-500 ${errors.stock ? "border-red-500" : "border-gray-300"}`}
              />
              {errors.stock && <p className="text-xs text-red-500 mt-1 error-text">{errors.stock}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Base Price (BDT)*</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 font-medium">৳</span>
                </div>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={form.price}
                  onChange={(e) => setField("price", e.target.value)}
                  className={`w-full border rounded-md pl-8 pr-3 py-2 focus:ring-orange-500 focus:border-orange-500 ${errors.price ? "border-red-500" : "border-gray-300"}`}
                />
              </div>
              {errors.price && <p className="text-xs text-red-500 mt-1 error-text">{errors.price}</p>}
            </div>
          </div>
          
          <div className="mt-8 flex justify-end">
            <button
              type="submit"
              disabled={uploading}
              className="bg-orange-500 text-white px-8 py-3 rounded-md font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              Submit Product →
            </button>
          </div>
        </section>
      </form>
    </div>
  );
}
