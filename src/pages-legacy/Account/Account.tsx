"use client";
import React, { ReactNode } from 'react';
import './Account.css';
import { useAuth } from '@/contexts/AuthContext/AuthContext';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Avatar } from 'primereact/avatar';
import { Button } from 'primereact/button';
import { Card } from 'primereact/card';
import { Breadcrumb } from '@/components/layout';
import '@/components/Breadcrumb/Breadcrumb.css';

type AccountProps = {
	children: ReactNode;
};

const Account: React.FC<AccountProps> = ({ children }) => {
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
			<Card className="panel-left">
			<div className="user-profile">
				{user.photoURL ? (
				<Avatar image={user.photoURL} size="xlarge" shape="circle" />
				) : (
				<Avatar
					label={user.displayName?.charAt(0) || "U"}
					size="xlarge"
					shape="circle"
					style={{ backgroundColor: 'var(--primary-color)' }}
				/>
				)}
				<h2>{user.displayName || "Utilisateur"}</h2>
				<p className="user-email">{user.email}</p>
				<Button
					className="logout-button"
					onClick={logout}
					style={{
						display: 'block',
						margin: '20px auto'
					}}

				>
					Déconnexion
				</Button>
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
			</Card>

			<Card className="panel-right">
			{children}
			</Card>
		</div>
		</div>
	);
};

export default Account;
