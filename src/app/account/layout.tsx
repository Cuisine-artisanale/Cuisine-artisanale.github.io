"use client";
import type { ReactNode } from "react";
import React from 'react';
import './account.css';
import { useAuth } from '@/contexts/AuthContext/AuthContext';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Breadcrumb } from '@/components/layout';

export default function AccountSectionLayout({ children }: { children: ReactNode }) {
	const { user, logout } = useAuth();
	const pathname = usePathname();

	const navigationItems = [
		{
			href: '/account',
			label: 'Mon Profil',
			icon: 'pi pi-user'
		},
		{
			href: '/account/mes-recettes',
			label: 'Mes Recettes',
			icon: 'pi pi-book'
		},
		{
			href: '/account/mes-favoris',
			label: 'Mes Favoris',
			icon: 'pi pi-heart'
		}
	];

	if (!user) {
		return (
			<div className="account-loading">
				<h2>Vous n'êtes pas connecté</h2>
			</div>
		);
	}

	return (
		<div className="account-page">
			<Breadcrumb />
			<div className="account-container">
				<div className="panel-left">
					<div className="user-profile">
						{user.photoURL ? (
							<img
								src={user.photoURL}
								alt={user.displayName || "Avatar"}
								className="user-avatar"
							/>
						) : (
							<div
								className="user-avatar user-avatar-placeholder"
								style={{ backgroundColor: 'var(--primary-color)' }}
							>
								{user.displayName?.charAt(0) || "U"}
							</div>
						)}
						<h2>{user.displayName || "Utilisateur"}</h2>
						<p className="user-email">{user.email}</p>
						<button
							className="logout-button"
							onClick={logout}
						>
							Déconnexion
						</button>
					</div>

					<nav className="account-navigation">
						{navigationItems.map((item) => (
							<Link
								key={item.href}
								href={item.href}
								className={`nav-item ${
									item.href === '/account'
										? pathname === '/account'
											? 'active'
											: ''
										: pathname.startsWith(item.href)
											? 'active'
											: ''
								}`}
							>
								<i className={item.icon}></i>
								<span>{item.label}</span>
							</Link>
						))}
					</nav>
				</div>

				<div className="panel-right">
					{children}
				</div>
			</div>
		</div>
	);
}
