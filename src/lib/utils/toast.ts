import { Toast } from 'primereact/toast';
import type { ToastSeverity, ToastOptions } from '@/types';

export const showToast = (toastRef: React.RefObject<Toast | null>, options: ToastOptions) => {
  if (toastRef.current) {
	toastRef.current.show({
	  severity: options.severity,
	  summary: options.summary,
	  detail: options.detail,
	  life: options.life || 1000
	});
  }
};

// Common toast messages
export const toastMessages = {
  success: {
	default: 'Succès',
	create: 'Création réussie',
	update: 'Mise à jour réussie',
	delete: 'Suppression réussie',
	accept: 'Acceptation réussie',
	reject: 'Rejet réussi'
  },
  error: {
	default: 'Erreur',
	create: 'Erreur lors de la création',
	update: 'Erreur lors de la mise à jour',
	delete: 'Erreur lors de la suppression',
	auth: 'Vous devez être connecté',
	accept: 'Erreur lors de l\'acceptation',
	reject: 'Erreur lors du rejet'
  },
  warning: {
	default: 'Attention'
  },
  info: {
	default: 'Information',
	reject: 'Rejet effectué'
  }
};

