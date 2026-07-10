import { useState } from "react";

export interface PopupState {
  isOpen: boolean;
  type: "alert" | "confirm" | "error" | "success" | "warning";
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

export function useConfirmDialog() {
  const [popupState, setPopupState] = useState<PopupState>({
    isOpen: false,
    type: "alert",
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const showCustomAlert = (
    title: string,
    message: string,
    type: "alert" | "error" | "success" | "warning" = "alert"
  ) => {
    return new Promise<void>((resolve) => {
      setPopupState({
        isOpen: true,
        type,
        title,
        message,
        confirmText: "OK",
        onConfirm: () => {
          setPopupState((prev) => ({ ...prev, isOpen: false }));
          resolve();
        },
      });
    });
  };

  const showCustomConfirm = (title: string, message: string, isDestructive = false) => {
    return new Promise<boolean>((resolve) => {
      setPopupState({
        isOpen: true,
        type: "confirm",
        title,
        message,
        confirmText: isDestructive ? "Delete" : "Confirm",
        cancelText: "Cancel",
        isDestructive,
        onConfirm: () => {
          setPopupState((prev) => ({ ...prev, isOpen: false }));
          resolve(true);
        },
        onCancel: () => {
          setPopupState((prev) => ({ ...prev, isOpen: false }));
          resolve(false);
        },
      });
    });
  };

  return {
    popupState,
    setPopupState,
    showCustomAlert,
    showCustomConfirm,
  };
}
