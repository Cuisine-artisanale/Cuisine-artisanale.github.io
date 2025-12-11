import React, { useState } from 'react';
import './AddUnit.css';
import { Button } from 'primereact/button';
import { AddUnitForm } from '@/components/features';

const AddUnit: React.FC = () => {
  const [dialogVisible, setDialogVisible] = useState(false);

  return (
	<div className="add-unit">
	  <Button
		label="Ajouter une unité"
		icon="pi pi-plus"
		className="p-button-success"
		onClick={() => setDialogVisible(true)}
	  />

	  <AddUnitForm
		visible={dialogVisible}
		onHide={() => setDialogVisible(false)}
	  />
	</div>
  );
};

export default AddUnit;
