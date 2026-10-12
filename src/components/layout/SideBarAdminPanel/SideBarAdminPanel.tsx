"use client";
import React, { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import "./SideBarAdminPanel.css";

const NAV_ITEMS = [
	{ href: "/admin-panel", label: "Vue d'ensemble", icon: "pi-th-large", exact: true },
	{ href: "/admin-panel/recettes", label: "Recettes à valider", icon: "pi-inbox" },
	{ href: "/admin-panel/ingredients", label: "Ingrédients", icon: "pi-shopping-bag" },
	{ href: "/admin-panel/units", label: "Unités", icon: "pi-calculator" },
	{ href: "/admin-panel/posts", label: "Posts", icon: "pi-comments" },
	{ href: "/admin-panel/users", label: "Utilisateurs", icon: "pi-users" },
];

/** Menu de l'administration : colonne à gauche sur ordinateur, bandeau défilant sur téléphone. */
const Sidebar: React.FC = () => {
	const pathname = usePathname();
	const navRef = useRef<HTMLElement>(null);

	// Sur téléphone, le menu est un bandeau défilant : la page courante doit rester visible
	useEffect(() => {
		navRef.current?.querySelector('.is-active')?.scrollIntoView({ block: 'nearest', inline: 'center' });
	}, [pathname]);

	return (
		<nav className="admin-sidebar" aria-label="Administration" ref={navRef}>
			<p className="admin-sidebar-title">Administration</p>
			<ul>
				{NAV_ITEMS.map((item) => {
					const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);

					return (
						<li key={item.href}>
							<Link
								href={item.href}
								className={`admin-sidebar-link${isActive ? " is-active" : ""}`}
								aria-current={isActive ? "page" : undefined}
							>
								<span className={`pi ${item.icon}`} aria-hidden="true"></span>
								{item.label}
							</Link>
						</li>
					);
				})}
			</ul>
			<Link href="/" className="admin-sidebar-link admin-sidebar-back">
				<span className="pi pi-arrow-left" aria-hidden="true"></span>
				Retour au site
			</Link>
		</nav>
	);
};

export default Sidebar;
