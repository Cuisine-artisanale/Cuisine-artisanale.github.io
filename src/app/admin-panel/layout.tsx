"use client";
import type { ReactNode } from "react";
import React, { useEffect } from "react";
import "./admin-panel.css";
import { useAuth } from "@/contexts/AuthContext/AuthContext";
import { SideBarAdminPanel as Sidebar } from "@/components/layout";
import { useRouter } from "next/navigation";
import { Breadcrumb } from "@/components/layout";

export default function AdminPanelRootLayout({ children }: { children: ReactNode }) {
	const { user, role } = useAuth();
	const router = useRouter();

	useEffect(() => {
		if (role && role !== "admin") {
			router.replace("/");
		}
	}, [role, router]);

	if (role && role !== "admin") {
		return (
			<div className="access-denied">
				<div className="error-message">
					<i className="pi pi-exclamation-triangle"></i>
					<span>Accès refusé. Cette page est réservée aux administrateurs.</span>
				</div>
			</div>
		);
	}

	return (
		<div className="admin-panel">
			<Sidebar />

			<div className="admin-main">
				<div className="admin-header">
					<Breadcrumb className="admin-breadcrumb" />

					<div className="admin-user-info">
						<span className="welcome-text">
							Bienvenue, {user?.displayName || "Administrateur"}
						</span>
					</div>
				</div>

				<div className="admin-content">{children}</div>
			</div>
		</div>
	);
}
