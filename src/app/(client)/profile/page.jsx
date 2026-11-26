"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  UserRound,
  MapPin,
  LockKeyhole,
  Settings,
  Camera,
  Eye,
  EyeOff,
  Check,
  Save,
  ShieldCheck,
} from "lucide-react";
import {
  changePassword,
  getMyAccount,
  saveMyAddress,
  saveMyProfile,
  saveMySettings,
  uploadMyPhoto,
} from "@/services/account.service";

const tabs = [
  { id: "profile", label: "Profile Details", icon: UserRound },
  { id: "address", label: "Address", icon: MapPin },
  { id: "password", label: "Password", icon: LockKeyhole },
  { id: "settings", label: "Account Settings", icon: Settings },
];

const EMPTY_PROFILE = { firstName: "", lastName: "", email: "", phone: "", gender: "", dateOfBirth: "" };
const EMPTY_ADDRESS = { country: "Nigeria", state: "", city: "", street: "", postalCode: "" };
const EMPTY_PASSWORD = { current: "", newPassword: "", confirmPassword: "" };
const DEFAULT_SETTINGS = { emailNotifications: true, bookingUpdates: true, promotionalEmails: false };
const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

const MAX_PHOTO_MB = 6; // keep in step with MAX_AVATAR in services/account.service.js

const initialsOf = (first, last) =>
  `${(first || "").trim().charAt(0)}${(last || "").trim().charAt(0)}`.toUpperCase() || "?";

function InputField({
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  required = false,
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>

      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options }) {
  const list = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  // A value saved earlier must stay selectable even if it isn't one of the listed choices.
  if (value && !list.some((o) => o.value === value)) list.push({ value, label: value });

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-gray-700">
        {label}
      </label>

      <select
        value={value}
        onChange={onChange}
        className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      >
        <option value="">Select {label.toLowerCase()}</option>
        {list.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function SaveButton({ children = "Save Changes", saving = false }) {
  return (
    <button
      type="submit"
      disabled={saving}
      className="inline-flex items-center gap-2 rounded-tr-xs bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Save size={16} />
      {saving ? "Saving..." : children}
    </button>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const routerRef = useRef(router); // lets the load effect use the router without re-running when it changes
  routerRef.current = router;
  const photoInput = useRef(null);

  const [activeTab, setActiveTab] = useState("profile");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [extrasAvailable, setExtrasAvailable] = useState(true);
  const [saving, setSaving] = useState("");     // which form is being saved
  const [notice, setNotice] = useState(null);   // { kind: "success" | "error", text }
  const [photoURL, setPhotoURL] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [memberSince, setMemberSince] = useState(null);

  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [address, setAddress] = useState(EMPTY_ADDRESS);
  const [password, setPassword] = useState(EMPTY_PASSWORD);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  // Load the signed-in guest's real details.
  useEffect(() => {
    let active = true;
    let leaving = false; // true while we send a signed-out visitor to /login: keep showing "Loading"

    (async () => {
      try {
        const res = await getMyAccount();
        if (!active) return;

        if (!res.ok) {
          if (res.code === "auth") {
            leaving = true;
            routerRef.current.replace("/login");
          } else setLoadError(res.message || "We couldn't load your account.");
          return;
        }

        const a = res.account;
        setProfile({
          firstName: a.firstName,
          lastName: a.lastName,
          email: a.email,
          phone: a.phone,
          gender: a.gender,
          dateOfBirth: a.dateOfBirth,
        });
        setAddress(a.address);
        setSettings(a.settings);
        setPhotoURL(a.photoURL);
        setMemberSince(a.memberSince);
        setExtrasAvailable(res.extrasAvailable);
      } catch (err) {
        console.error("Failed to load account:", err);
        if (active) setLoadError("We couldn't load your account. Please refresh the page.");
      } finally {
        if (active && !leaving) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const updateProfile = (field, value) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  const updateAddress = (field, value) => {
    setAddress((prev) => ({ ...prev, [field]: value }));
  };

  // Shows the result of a save. Returns true when it worked.
  const finish = (res, successText) => {
    if (res?.code === "auth") {
      router.replace("/login");
      return false;
    }
    if (res?.ok) {
      setNotice({ kind: "success", text: successText });
      return true;
    }
    setNotice({ kind: "error", text: res?.message || "Something went wrong. Please try again." });
    return false;
  };

  const handleSubmit = async (e, section) => {
    e.preventDefault();
    setNotice(null);

    if (section === "password") {
      if (password.newPassword.length < 8) {
        setNotice({ kind: "error", text: "Password must contain at least 8 characters." });
        return;
      }
      if (password.newPassword !== password.confirmPassword) {
        setNotice({ kind: "error", text: "New password and confirmation do not match." });
        return;
      }
    }

    setSaving(section);
    try {
      if (section === "profile") {
        finish(await saveMyProfile(profile), "Your profile has been updated.");
      } else if (section === "address") {
        finish(await saveMyAddress(address), "Your address has been saved.");
      } else if (section === "password") {
        const ok = finish(
          await changePassword({ current: password.current, next: password.newPassword }),
          "Your password has been changed. Your other devices were signed out."
        );
        if (ok) setPassword(EMPTY_PASSWORD);
      } else if (section === "settings") {
        finish(await saveMySettings(settings), "Your preferences have been saved.");
      }
    } catch (err) {
      console.error(`Saving ${section} failed:`, err);
      setNotice({ kind: "error", text: "Something went wrong. Please try again." });
    } finally {
      setSaving("");
    }
  };

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // lets the same file be chosen again later
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setNotice({ kind: "error", text: "Only JPG, PNG or WebP photos are allowed." });
      return;
    }
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
      setNotice({ kind: "error", text: `Photos must be ${MAX_PHOTO_MB} MB or smaller.` });
      return;
    }

    setNotice(null);
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.set("photo", file);
      const res = await uploadMyPhoto(fd);
      if (finish(res, "Profile photo updated.")) setPhotoURL(res.photoURL);
    } catch (err) {
      console.error("Photo upload failed:", err);
      setNotice({ kind: "error", text: "The photo couldn't be uploaded. Please try again." });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const activeTabData = tabs.find((tab) => tab.id === activeTab);
  const initials = initialsOf(profile.firstName, profile.lastName);
  const fullName = `${profile.firstName} ${profile.lastName}`.trim();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl text-sm text-gray-500" role="status">
          Loading your account...
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 lg:px-8">
        <div
          className="mx-auto max-w-6xl rounded-xl border border-red-100 bg-red-50 p-5 text-sm text-red-700"
          role="alert"
        >
          {loadError}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">

        {/* Page heading */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Account Settings
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Manage your personal information and account preferences.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">

          {/* Sidebar */}
          <aside className="h-fit rounded-xl border border-gray-200 bg-white p-4">
            {/* User summary */}
            <div className="mb-5 flex items-center gap-3 border-b border-gray-100 pb-5">
              {photoURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoURL} alt={fullName} className="h-12 w-12 rounded-full object-cover" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-lg font-bold text-blue-700">
                  {initials}
                </div>
              )}

              <div className="min-w-0">
                <p className="truncate font-semibold text-gray-900">
                  {fullName}
                </p>
                <p className="truncate text-xs text-gray-500">
                  {profile.email}
                </p>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex gap-2 overflow-x-auto lg:flex-col">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setNotice(null);
                    }}
                    className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium transition lg:w-full ${
                      isActive
                        ? "bg-blue-50 text-blue-700"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    <Icon size={18} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="mt-6 hidden rounded-lg bg-gray-50 p-4 lg:block">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                <ShieldCheck size={18} className="text-green-600" />
                Your account is secure
              </div>
              <p className="mt-2 text-xs leading-5 text-gray-500">
                Keep your personal information and password up to date.
              </p>
            </div>
          </aside>

          {/* Main content */}
          <main className="min-w-0 rounded-xl border border-gray-200 bg-white">

            {/* Content heading */}
            <div className="border-b border-gray-100 px-5 py-5 sm:px-7">
              <h2 className="text-lg font-bold text-gray-900">
                {activeTabData.label}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {activeTab === "profile" &&
                  "Update your personal details and contact information."}
                {activeTab === "address" &&
                  "Manage your residential and contact address."}
                {activeTab === "password" &&
                  "Change your password to keep your account secure."}
                {activeTab === "settings" &&
                  "Control how we communicate with you."}
              </p>
            </div>

            <div className="p-5 sm:p-7">

              {notice && (
                <div
                  role={notice.kind === "error" ? "alert" : "status"}
                  className={`mb-6 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
                    notice.kind === "error"
                      ? "border-red-100 bg-red-50 text-red-700"
                      : "border-green-100 bg-green-50 text-green-700"
                  }`}
                >
                  {notice.kind === "success" && <Check size={16} className="mt-0.5 shrink-0" />}
                  <span>{notice.text}</span>
                </div>
              )}

              {!extrasAvailable && (activeTab === "profile" || activeTab === "settings") && (
                <div className="mb-6 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
                  Gender, date of birth and notification preferences can&apos;t be saved yet. Ask the
                  site admin to run the profile database update.
                </div>
              )}

              {/* PROFILE DETAILS */}
              {activeTab === "profile" && (
                <form
                  onSubmit={(e) => handleSubmit(e, "profile")}
                  className="space-y-7"
                >
                  {/* Profile image */}
                  <div className="flex items-center gap-5">
                    <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 text-2xl font-bold text-blue-700">
                      {photoURL ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photoURL} alt={fullName} className="h-20 w-20 rounded-full object-cover" />
                      ) : (
                        initials
                      )}
                      <input
                        ref={photoInput}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={handlePhoto}
                      />
                      <button
                        type="button"
                        aria-label="Change profile photo"
                        disabled={uploadingPhoto}
                        onClick={() => photoInput.current?.click()}
                        className="absolute bottom-0 right-0 rounded-full border-2 border-white bg-blue-600 p-2 text-white hover:bg-blue-700 disabled:opacity-60"
                      >
                        <Camera size={14} />
                      </button>
                    </div>

                    <div>
                      <p className="font-semibold text-gray-900">
                        Profile Photo
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {uploadingPhoto ? "Uploading..." : `JPG, PNG or WebP. Maximum size ${MAX_PHOTO_MB}MB.`}
                      </p>
                      {memberSince && (
                        <p className="mt-1 text-xs text-gray-400">
                          Member since{" "}
                          {new Date(memberSince).toLocaleDateString(undefined, { year: "numeric", month: "long" })}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <InputField
                      label="First Name"
                      value={profile.firstName}
                      onChange={(e) =>
                        updateProfile("firstName", e.target.value)
                      }
                      required
                    />

                    <InputField
                      label="Last Name"
                      value={profile.lastName}
                      onChange={(e) =>
                        updateProfile("lastName", e.target.value)
                      }
                      required
                    />

                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={profile.email}
                        readOnly
                        aria-readonly="true"
                        className="w-full cursor-not-allowed rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500 outline-none"
                      />
                      <p className="mt-1 text-xs text-gray-400">
                        Your email is your sign-in and can&apos;t be changed here.
                      </p>
                    </div>

                    <InputField
                      label="Phone Number"
                      value={profile.phone}
                      onChange={(e) =>
                        updateProfile("phone", e.target.value)
                      }
                    />

                    <SelectField
                      label="Gender"
                      value={profile.gender}
                      onChange={(e) =>
                        updateProfile("gender", e.target.value)
                      }
                      options={GENDER_OPTIONS}
                    />

                    <InputField
                      label="Date of Birth"
                      type="date"
                      value={profile.dateOfBirth}
                      onChange={(e) =>
                        updateProfile("dateOfBirth", e.target.value)
                      }
                    />
                  </div>

                  <div className="border-t border-gray-100 pt-5">
                    <SaveButton saving={saving === "profile"} />
                  </div>
                </form>
              )}

              {/* ADDRESS */}
              {activeTab === "address" && (
                <form
                  onSubmit={(e) => handleSubmit(e, "address")}
                  className="space-y-5"
                >
                  <div className="grid gap-5 sm:grid-cols-2">
                    <SelectField
                      label="Country"
                      value={address.country}
                      onChange={(e) =>
                        updateAddress("country", e.target.value)
                      }
                      options={["Nigeria", "Ghana", "South Africa", "Kenya"]}
                    />

                    <InputField
                      label="State / Region"
                      value={address.state}
                      onChange={(e) =>
                        updateAddress("state", e.target.value)
                      }
                      placeholder="e.g. Lagos"
                    />

                    <InputField
                      label="City"
                      value={address.city}
                      onChange={(e) =>
                        updateAddress("city", e.target.value)
                      }
                      placeholder="Enter your city"
                      required
                    />

                    <InputField
                      label="Postal Code"
                      value={address.postalCode}
                      onChange={(e) =>
                        updateAddress("postalCode", e.target.value)
                      }
                      placeholder="Postal code"
                    />

                    <div className="sm:col-span-2">
                      <InputField
                        label="Street Address"
                        value={address.street}
                        onChange={(e) =>
                          updateAddress("street", e.target.value)
                        }
                        placeholder="House number, street name, area"
                        required
                      />
                    </div>
                  </div>

                  <div className="border-t border-gray-100 pt-5">
                    <SaveButton saving={saving === "address"} />
                  </div>
                </form>
              )}

              {/* PASSWORD */}
              {activeTab === "password" && (
                <form
                  onSubmit={(e) => handleSubmit(e, "password")}
                  className="max-w-xl space-y-5"
                >
                  <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                    <div className="flex gap-3">
                      <ShieldCheck
                        size={20}
                        className="shrink-0 text-blue-600"
                      />
                      <div>
                        <p className="text-sm font-semibold text-blue-900">
                          Password security
                        </p>
                        <p className="mt-1 text-xs leading-5 text-blue-700">
                          Use at least 8 characters. Avoid using a password
                          you have used on another website.
                        </p>
                      </div>
                    </div>
                  </div>

                  {[
                    {
                      id: "current",
                      label: "Current Password",
                      placeholder: "Enter current password",
                    },
                    {
                      id: "newPassword",
                      label: "New Password",
                      placeholder: "Enter new password",
                    },
                    {
                      id: "confirmPassword",
                      label: "Confirm New Password",
                      placeholder: "Confirm new password",
                    },
                  ].map((field) => (
                    <div key={field.id}>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        {field.label}
                      </label>

                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={password[field.id]}
                          onChange={(e) =>
                            setPassword((prev) => ({
                              ...prev,
                              [field.id]: e.target.value,
                            }))
                          }
                          placeholder={field.placeholder}
                          autoComplete={field.id === "current" ? "current-password" : "new-password"}
                          required
                          className="w-full rounded-lg border border-gray-200 px-4 py-3 pr-12 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />

                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label={
                            showPassword ? "Hide password" : "Show password"
                          }
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                        >
                          {showPassword ? (
                            <EyeOff size={18} />
                          ) : (
                            <Eye size={18} />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}

                  <div className="border-t border-gray-100 pt-5">
                    <SaveButton saving={saving === "password"}>Update Password</SaveButton>
                  </div>
                </form>
              )}

              {/* ACCOUNT SETTINGS */}
              {activeTab === "settings" && (
                <form
                  onSubmit={(e) => handleSubmit(e, "settings")}
                  className="space-y-6"
                >
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      Notification Preferences
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Choose which emails you want to receive.
                    </p>
                  </div>

                  {[
                    {
                      id: "emailNotifications",
                      title: "Email Notifications",
                      description:
                        "Receive important account notifications by email.",
                    },
                    {
                      id: "bookingUpdates",
                      title: "Booking Updates",
                      description:
                        "Get updates about your reservations and bookings.",
                    },
                    {
                      id: "promotionalEmails",
                      title: "Promotional Emails",
                      description:
                        "Receive special offers, discounts and promotions.",
                    },
                  ].map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-4 border-b border-gray-100 pb-5"
                    >
                      <div>
                        <p className="text-sm font-semibold text-gray-800">
                          {item.title}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {item.description}
                        </p>
                      </div>

                      <button
                        type="button"
                        role="switch"
                        aria-checked={settings[item.id]}
                        aria-label={item.title}
                        onClick={() =>
                          setSettings((prev) => ({
                            ...prev,
                            [item.id]: !prev[item.id],
                          }))
                        }
                        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                          settings[item.id] ? "bg-blue-600" : "bg-gray-300"
                        }`}
                      >
                        <span
                          className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${
                            settings[item.id]
                              ? "left-6"
                              : "left-1"
                          }`}
                        />
                      </button>
                    </div>
                  ))}

                  <SaveButton saving={saving === "settings"} />
                </form>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
