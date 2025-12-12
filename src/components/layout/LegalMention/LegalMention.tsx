"use client";
import React, { useEffect } from 'react';
import './LegalMention.css';
import { LienUtiles } from '@/components/layout';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LegalMention: React.FC = () => {
  const [isAboutPage, setIsAboutPage] = React.useState(false);
  const pathname = usePathname();

  useEffect(() => {
	setIsAboutPage(pathname === '/about');
  }, [pathname]);

  return (
	<div className="LegalMention">
	  <header className="legalMention-header">
		<Link href="/mentions-legales">Mentions légales / ©Aymeric Sabatier</Link>
		<Link href="/politique-confidentialite">Politique de confidentialité / ©Aymeric Sabatier</Link>
		{!isAboutPage && <LienUtiles />}
	  </header>
	</div>
  );
};

export default LegalMention;
