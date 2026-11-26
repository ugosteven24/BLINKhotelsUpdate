
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { getCurrentUser } from "@/services/auth.service";
import "./profileImage.css"
import {
  getMyAccount,

} from "@/services/account.service";
export default function UserProfileImage({
  size = 40,
  className = "",
}) {
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(true);

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
      
        setImageUrl(a.photoURL);
   
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

  if (loading) {
    return (
      <div
        className={`profile-image-placeholder ${className}`}
        style={{ width: size, height: size }}
        aria-label="Loading profile image"
      />
    );
  }



  return (
    <img
      src={imageUrl}
      alt="User profile"
      width={size}
      height={size}
      className={`user-profile-image ${className}`}
      referrerPolicy="no-referrer"
      onError={() => setImageUrl("")}
    />
  );
}
