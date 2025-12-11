"use client";
import React, { ReactNode, useEffect } from "react";
import "./AdminPanel.css";
import { useAuth } from "@/contexts/AuthContext/AuthContext";
import { SideBarAdminPanel as Sidebar } from "@/components/layout";
import { Card } from "primereact/card";
import { Message } from "primereact/message";
import { useRouter } from "next/navigation";
import { Breadcrumb } from "@/components/layout";

type AdminPanelProps = {
  children: ReactNode;
};

const AdminPanel: React.FC<AdminPanelProps> = ({ children }) => {
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
		<Message
		  severity="error"
		  text="Accès refusé. Cette page est réservée aux administrateurs."
		/>
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

		<Card className="admin-content">{children}</Card>
	  </div>
	</div>
  );
};

export default AdminPanel;
