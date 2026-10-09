"use client";
import React, { useState } from 'react';
import './AddIngredient.css';
import { Button } from 'primereact/button';
import AddIngredientForm from '@/components/features/AddIngredientForm/AddIngredientForm';

const AddIngredient: React.FC = () => {
  const [dialogVisible, setDialogVisible] = useState(false);

  return (
	<div className="add-ingredient">
	  <Button
		label="Ajouter un ingrédient"
		icon="pi pi-plus"
		className="p-button-success"
		onClick={() => setDialogVisible(true)}
	  />

	  <AddIngredientForm
		visible={dialogVisible}
		onHide={() => setDialogVisible(false)}
	  />
	</div>
  );
};

export default AddIngredient;
