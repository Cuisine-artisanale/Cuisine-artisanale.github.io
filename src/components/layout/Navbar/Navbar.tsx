"use client";
import React, { useContext, useEffect, useState, useRef } from 'react';
import './Navbar.css';

import { useAuth } from '@/contexts/AuthContext/AuthContext';
import { Button } from 'primereact/button';
import { Avatar } from 'primereact/avatar';
import { OverlayPanel } from 'primereact/overlaypanel';
import { ThemeContext } from '@/contexts/ThemeContext/ThemeContext';
import { ButtonLinkNav } from '@/components/ui';
import { usePathname, useRouter } from 'next/navigation';
import { useScroll } from '@/hooks';

const Navbar: React.FC = () => {
  const { user, logout, signInWithGoogle, role, displayName } = useAuth();
  const { theme, toggleTheme } = useContext(ThemeContext);
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isNavbarVisible, setIsNavbarVisible] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const overlayPanelRef = useRef<OverlayPanel>(null);

  // Utiliser le hook useScroll
  const { scrollY, isScrolled, direction } = useScroll({
	threshold: 20,
	onScroll: (currentScrollY) => {
	  const isMobile = window.innerWidth <= 768;
	  if (isMobile) {
		// Hide navbar when scrolling down, show when scrolling up
		if (direction === 'down' && currentScrollY > 100) {
		  setIsNavbarVisible(false);
		} else if (direction === 'up') {
		  setIsNavbarVisible(true);
		}
	  }
	}
  });

  useEffect(() => {
	setIsMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
	setIsMounted(true);
  }, []);

  const handleProfileClick = () => {
	overlayPanelRef.current?.hide();
	router.push('/account');
  };

  const handleMyRecipesClick = () => {
	overlayPanelRef.current?.hide();
	router.push('/account/mes-recettes');
  };

  const handleAdminClick = () => {
	overlayPanelRef.current?.hide();
	router.push('/admin-panel');
  };

  const handleLogout = async () => {
	try {
	  overlayPanelRef.current?.hide();
	  await logout();
	  router.push('/');
	} catch (error) {
	  console.error('Erreur lors de la déconnexion:', error);
	}
  };

  const menuItems = [
	{ label: 'Mon Profil', icon: 'pi pi-user', onClick: handleProfileClick },
	{ label: 'Mes Recettes', icon: 'pi pi-book', onClick: handleMyRecipesClick },
	...(role === 'admin' ? [
	  { label: 'Administration', icon: 'pi pi-cog', onClick: handleAdminClick }
	] : []),
	{ type: 'separator' },
	{ label: 'Déconnexion', icon: 'pi pi-power-off', onClick: handleLogout }
  ];

  const handleLogin = () => {
	// Get current path to redirect back after login
	const currentPath = pathname || '/';
	const redirectUrl = encodeURIComponent(currentPath);
	router.push(`/login?redirect=${redirectUrl}`);
  };

  const handleMobileMenuToggle = () => {
	setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleMobileMenuClose = () => {
	setIsMobileMenuOpen(false);
  };

  return (
	<>
	  <nav className={`navbar ${isScrolled ? 'navbar-scrolled' : ''} ${!isNavbarVisible ? 'navbar-hidden' : ''}`}>
		<div className="navbar-container">
		  <div className="navbar-brand">
			<h1 className="site-title">Cuisine Artisanale</h1>
		  </div>

		  <div className="navbar-navigation">
			<ButtonLinkNav />
		  </div>

		  <div className="navbar-actions">
			<Button
			  icon={isMounted ? (theme === "dark" ? "pi pi-sun" : "pi pi-moon") : "pi pi-moon"}
			  className="theme-toggle"
			  onClick={toggleTheme}
			  tooltip={isMounted ? (theme === "dark" ? "Mode clair" : "Mode sombre") : "Mode sombre"}
			  tooltipOptions={{ position: 'bottom' }}
			/>

			{user ? (
			  <div className="user-menu">
				<Button
				  className="user-menu-trigger"
				  onClick={(e) => overlayPanelRef.current?.toggle(e)}
				>
				  {user.photoURL ? (
					<Avatar image={user.photoURL} shape="circle" />
				  ) : (
					<Avatar
					  label={displayName?.charAt(0) || "U"}
					  shape="circle"
					  style={{ backgroundColor: 'var(--primary-color)' }}
					/>
				  )}
				  <span className="user-name">{displayName || "Utilisateur"}</span>
				  {role === 'admin' && (
					<span className="user-role">Admin</span>
				  )}
				  <i className="pi pi-chevron-down" />
				</Button>
				<OverlayPanel
				  ref={overlayPanelRef}
				  className="user-menu-panel"
				  showCloseIcon={false}
				  dismissable
				>
				  <div className="user-menu-content">
					{menuItems.map((item, index) => (
					  item.type === 'separator' ? (
						<div key={index} className="menu-separator" />
					  ) : (
						<Button
						  key={index}
						  className="menu-item"
						  onClick={item.onClick}
						>
						  <i className={item.icon} />
						  <span>{item.label}</span>
						</Button>
					  )
					))}
				  </div>
				</OverlayPanel>
			  </div>
			) : (
			  <div className="auth-buttons">
				<Button
				  label="Se connecter"
				  icon="pi pi-sign-in"
				  className="p-button-outlined login-btn"
				  onClick={handleLogin}
				/>
			  </div>
			)}

			<Button
			  icon={isMobileMenuOpen ? "pi pi-times" : "pi pi-bars"}
			  className="mobile-menu-toggle"
			  onClick={handleMobileMenuToggle}
			  aria-label={isMobileMenuOpen ? "Fermer le menu" : "Ouvrir le menu"}
			/>
		  </div>
		</div>
	  </nav>

	  {/* Mobile Menu Overlay */}
	  <div className={`mobile-menu-overlay ${isMobileMenuOpen ? 'show' : ''}`}>
		<div className="mobile-menu-content">
		  <ButtonLinkNav isMobile onClick={handleMobileMenuClose} />
		  {user ? (
			<div className="mobile-user-menu">
			  {menuItems.map((item, index) => (
				item.type === 'separator' ? (
				  <div key={index} className="menu-separator" />
				) : (
				  <Button
					key={index}
					className="menu-item"
					onClick={() => {
					  if (item.onClick) {
						item.onClick();
						handleMobileMenuClose();
					  }
					}}
				  >
					<i className={item.icon} />
					<span>{item.label}</span>
				  </Button>
				)
			  ))}
			</div>
		  ) : (
			<div className="mobile-auth-buttons">
			  <Button
				label="Se connecter"
				icon="pi pi-sign-in"
				className="p-button-outlined login-btn"
				onClick={() => {
				  handleLogin();
				  handleMobileMenuClose();
				}}
			  />
			</div>
		  )}
		</div>
	  </div>
	</>
  );
};

export default Navbar;
