"use client";
import type { ReactNode } from "react";
import React from "react";
import Link from "next/link";
import "./admin-panel.css";
import "./admin-common.css";
import { useAuth } from "@/contexts/AuthContext/AuthContext";
import Sidebar from '@/components/layout/SideBarAdminPanel/SideBarAdminPanel';

export default function AdminPanelRootLayout({ children }: { children: ReactNode }) {
	const { user, role, loading } = useAuth();

	// Session en cours de lecture : ni contenu ni refus tant qu'on ne sait pas qui est là
	if (loading) {
		return (
			<div className="admin-gate" role="status">
				<span className="pi pi-spin pi-spinner" aria-hidden="true"></span>
				Chargement…
			</div>
		);
	}

	if (!user) {
		return (
			<div className="admin-gate">
				<span className="pi pi-lock" aria-hidden="true"></span>
				<p>Connectez-vous avec un compte administrateur pour accéder à cette page.</p>
				<Link href="/login" className="admin-gate-link">Se connecter</Link>
			</div>
		);
	}

	if (role !== "admin") {
		return (
			<div className="admin-gate">
				<span className="pi pi-exclamation-triangle" aria-hidden="true"></span>
				<p>Cette page est réservée aux administrateurs.</p>
				<Link href="/" className="admin-gate-link">Retour au site</Link>
			</div>
		);
	}

	return (
		<div className="admin-panel">
			<Sidebar />
			<div className="admin-main">
				<div className="admin-content">{children}</div>
			</div>
		</div>
	);
}
