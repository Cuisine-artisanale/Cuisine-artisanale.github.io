import React from 'react';
import './LienUtiles.css';

const LienUtiles: React.FC = () => {
  return (
	<div className="LienUtiles">
	  <ul>
		<li>
		  <a href="mailto:ssabatieraymeric@gmail.com" target="_blank" rel="noopener noreferrer">
			<i className="pi pi-envelope"></i> Email
		  </a>
		</li>
		<li>
		  <a href="https://www.linkedin.com/in/aymeric-sabatier-916613279" target="_blank" rel="noopener noreferrer">
			<i className="pi pi-linkedin"></i> LinkedIn
		  </a>
		</li>
		<li>
		  <a href="https://www.aymeric-sabatier.fr/" target="_blank" rel="noopener noreferrer">
			<i className="pi pi-github"></i> Portfolio
		  </a>
		</li>
	  </ul>
	</div>
  );
};

export default LienUtiles;
