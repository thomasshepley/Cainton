"use client";

import { useState } from "react";

interface PasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  /** Classes for the wrapping <div> (e.g. width) */
  wrapperClassName?: string;
  /** Classes for the <input> itself — match your existing input styling */
  inputClassName?: string;
  /** Set true for centered text inputs so the toggle doesn't crowd it */
  center?: boolean;
}

/** Eye icon that also renders the eye-off variant when `off` is set */
function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M2 2l20 20" />}
    </svg>
  );
}

/** A password field with a "show/hide" eye-icon toggle */
export function PasswordInput({
  value,
  onChange,
  placeholder,
  autoComplete,
  autoFocus,
  disabled,
  wrapperClassName = "",
  inputClassName = "",
  center = false,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={`relative ${wrapperClassName}`}>
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        disabled={disabled}
        className={`${inputClassName} ${center ? "pr-9" : "pr-10"}`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex items-center px-2.5 text-ink-soft transition-colors hover:text-sage-dark"
      >
        <EyeIcon off={visible} />
      </button>
    </div>
  );
}
