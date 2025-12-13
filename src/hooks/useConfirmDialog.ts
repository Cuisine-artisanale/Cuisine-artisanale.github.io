import { useState, useCallback } from 'react';

interface ConfirmDialogOptions {
  message: string;
  header?: string;
  icon?: string;
  acceptLabel?: string;
  rejectLabel?: string;
  onAccept: () => void;
  onReject?: () => void;
}

export const useConfirmDialog = () => {
  const [dialogState, setDialogState] = useState<ConfirmDialogOptions | null>(null);
  const [visible, setVisible] = useState(false);

  const confirm = useCallback((options: ConfirmDialogOptions) => {
    setDialogState(options);
    setVisible(true);
  }, []);

  const hide = useCallback(() => {
    setVisible(false);
    setDialogState(null);
  }, []);

  const handleAccept = useCallback(() => {
    if (dialogState?.onAccept) {
      dialogState.onAccept();
    }
    hide();
  }, [dialogState, hide]);

  const handleReject = useCallback(() => {
    if (dialogState?.onReject) {
      dialogState.onReject();
    }
    hide();
  }, [dialogState, hide]);

  return {
    confirm,
    hide,
    visible,
    dialogState,
    handleAccept,
    handleReject
  };
};

