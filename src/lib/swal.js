"use client";

import Swal from "sweetalert2";

const COLORS = { primary: "#0b1630", danger: "#c0261b", muted: "#4a5672" };

export const toast = (icon, title) =>
  Swal.mixin({
    toast: true,
    position: "top-end",
    showConfirmButton: false,
    timer: 3500,
    timerProgressBar: true,
    customClass: { popup: "adm-swal-toast" },
  }).fire({ icon, title });

export const toastSuccess = (title) => toast("success", title);
export const toastError = (title) => toast("error", title);

export const confirmDialog = async ({ title, text, confirmText = "Yes, continue", danger = false }) => {
  const res = await Swal.fire({
    title,
    text,
    icon: danger ? "warning" : "question",
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: "Cancel",
    confirmButtonColor: danger ? COLORS.danger : COLORS.primary,
    cancelButtonColor: COLORS.muted,
    reverseButtons: true,
    focusCancel: danger,
  });
  return res.isConfirmed;
};
