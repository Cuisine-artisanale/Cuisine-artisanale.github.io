"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import "./SideBarAdminPanel.css";

const NAV_ITEMS = [
  { href: "/admin-panel", label: "🏠 Dashboard", exact: true },
  { href: "/admin-panel/users", label: "👤 Utilisateurs" },
  { href: "/admin-panel/posts", label: "📝 Posts" },
  { href: "/admin-panel/recettes", label: "🍲 Recettes" },
  { href: "/admin-panel/ingredients", label: "🥦 Ingrédients" },
  { href: "/admin-panel/units", label: "📏 Unités" },
];

const Sidebar: React.FC = () => {
  const pathname = usePathname();

  return (
	<nav className="sidebar">
	  <ul>
		{NAV_ITEMS.map((item) => {
		  const isActive = item.exact
			? pathname === item.href
			: pathname.startsWith(item.href);

		  return (
			<li key={item.href}>
			  <Link href={item.href} className={`sidebar-link ${isActive ? "active" : ""}`}>
				{item.label}
			  </Link>
			</li>
		  );
		})}
	  </ul>
	</nav>
  );
};

export default Sidebar;
