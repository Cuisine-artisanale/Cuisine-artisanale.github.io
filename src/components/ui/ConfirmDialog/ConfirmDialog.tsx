"use client";
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import './ConfirmDialog.css';

interface ConfirmDialogProps {
  visible: boolean;
  message: string;
  header?: string;
  icon?: string;
  acceptLabel?: string;
  rejectLabel?: string;
  onAccept: () => void;
  onReject: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  visible,
  message,
  header = 'Confirmation',
  icon = 'pi pi-exclamation-triangle',
  acceptLabel = 'Oui',
  rejectLabel = 'Non',
  onAccept,
  onReject
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!visible || !mounted) return null;

  const dialogContent = (
    <div className="confirm-dialog-overlay" onClick={onReject}>
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-dialog-header">
          {icon && <i className={icon}></i>}
          <h3>{header}</h3>
        </div>
        <div className="confirm-dialog-content">
          <p>{message}</p>
        </div>
        <div className="confirm-dialog-footer">
          <button className="btn-reject" onClick={onReject}>
            {rejectLabel}
          </button>
          <button className="btn-accept" onClick={onAccept}>
            {acceptLabel}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(dialogContent, document.body);
};

