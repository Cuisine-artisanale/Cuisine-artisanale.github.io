"use client";
import React, { useState } from 'react';
import './Password.css';

interface PasswordProps {
  id?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
  autoComplete?: string;
  feedback?: boolean;
  toggleMask?: boolean;
}

export const Password: React.FC<PasswordProps> = ({
  id,
  value,
  onChange,
  placeholder,
  className = '',
  autoComplete,
  feedback = false,
  toggleMask = false,
}) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className={`password-wrapper ${className}`}>
      <input
        id={id}
        type={showPassword ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="password-input"
      />
      {toggleMask && (
        <button
          type="button"
          className="password-toggle"
          onClick={() => setShowPassword(!showPassword)}
          aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        >
          <i className={showPassword ? 'pi pi-eye-slash' : 'pi pi-eye'}></i>
        </button>
      )}
    </div>
  );
};

