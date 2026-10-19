"use client";
import React from 'react';
import './ButtonLinkNav.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface ButtonLinkNavProps {
  onClick?: () => void;
  isMobile?: boolean;
}

const ButtonLinkNav: React.FC<ButtonLinkNavProps> = ({ onClick, isMobile = false }) => {
  const pathname = usePathname();

  const navItems = [
	{ path: '/', label: 'Accueil', icon: 'pi pi-home' },
	{ path: '/recettes', label: 'Recettes', icon: 'pi pi-book' },
	{ path: '/regions', label: 'Régions', icon: 'pi pi-map-marker' },
	{ path: '/map', label: 'Carte', icon: 'pi pi-map' },
	{ path: '/about', label: 'À propos', icon: 'pi pi-info-circle' }
  ];

  return (
	<div className={`ButtonLinkNav ${isMobile ? 'mobile' : ''}`}>
	  <nav>
		<ul className="menu">
		  {navItems.map((item) => {
			const active = pathname === item.path || (item.path !== '/' && pathname.startsWith(`${item.path}/`));
			return (
			  <li key={item.path} className="menu-item">
				<Link
				  href={item.path}
				  onClick={onClick}
				  className={`nav-link ${active ? 'active' : ''}`}
				  aria-current={active ? 'page' : undefined}
				>
				  {isMobile && <span className={item.icon} aria-hidden="true"></span>}
				  {item.label}
				</Link>
			  </li>
			);
		  })}
		</ul>
	  </nav>
	</div>
  );
};

export default ButtonLinkNav;
