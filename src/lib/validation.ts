// Email validation
export const validateEmail = (email: string): string | null => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !email.trim()) {
    return "Email is required";
  }
  if (!emailRegex.test(email)) {
    return "Please enter a valid email address";
  }
  return null;
};

// Password validation
export const validatePassword = (password: string): string | null => {
  if (!password) {
    return "Password is required";
  }
  if (password.length < 8) {
    return "Password must be at least 8 characters long";
  }
  return null;
};

// Confirm password validation
export const validatePasswordMatch = (
  password: string,
  confirmPassword: string
): string | null => {
  if (!confirmPassword) {
    return "Please confirm your password";
  }
  if (password !== confirmPassword) {
    return "Passwords do not match";
  }
  return null;
};

// Store name validation
export const validateStoreName = (name: string): string | null => {
  if (!name || !name.trim()) {
    return "Store name is required";
  }
  if (name.trim().length < 2) {
    return "Store name must be at least 2 characters";
  }
  return null;
};

// Latitude validation
export const validateLatitude = (lat: string | number): string | null => {
  if (lat === "" || lat === null || lat === undefined) {
    return "Latitude is required";
  }
  const latNum = typeof lat === "string" ? parseFloat(lat) : lat;
  if (isNaN(latNum)) {
    return "Latitude must be a valid number";
  }
  if (latNum < -90 || latNum > 90) {
    return "Latitude must be between -90 and 90";
  }
  return null;
};

// Longitude validation
export const validateLongitude = (lng: string | number): string | null => {
  if (lng === "" || lng === null || lng === undefined) {
    return "Longitude is required";
  }
  const lngNum = typeof lng === "string" ? parseFloat(lng) : lng;
  if (isNaN(lngNum)) {
    return "Longitude must be a valid number";
  }
  if (lngNum < -180 || lngNum > 180) {
    return "Longitude must be between -180 and 180";
  }
  return null;
};

// District validation (stored in the city field for DB compatibility)
export const validateCity = (city: string): string | null => {
  if (!city || !city.trim()) {
    return "District is required";
  }
  return null;
};

// Upazilla validation
export const validateUpazilla = (upazilla: string): string | null => {
  if (!upazilla || !upazilla.trim()) {
    return "Upazilla is required";
  }
  return null;
};
