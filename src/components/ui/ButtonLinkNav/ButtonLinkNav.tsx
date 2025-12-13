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
	{ path: '/', label: 'Accueil' },
	{ path: '/recettes', label: 'Recettes' },
	{ path: '/map', label: 'Map' },
	{ path: '/about', label: 'À propos' }
  ];

  return (
	<div className={`ButtonLinkNav ${isMobile ? 'mobile' : ''}`}>
	  <nav>
		<ul className="menu">
		  {navItems.map((item) => (
			<li key={item.path} className="menu-item">
			  <Link
				href={item.path}
				onClick={onClick}
				className={`nav-link ${pathname === item.path ? 'active' : ''}`}
			  >
				{item.label}
			  </Link>
			</li>
		  ))}
		</ul>
	  </nav>
	</div>
  );
};

export default ButtonLinkNav;
